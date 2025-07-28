"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Coffee, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTimeLogsForDay, createTimeLog, updateTimeLog, startBreak, endBreak } from "@/lib/util/time-logs";
import { useUser } from '@clerk/nextjs';
import { dashboardEvents } from "@/lib/events";

type TimeStatus = "idle" | "working" | "lunch" | "overtime_pending";

interface TimeTrackerProps {
  onClockInChange?: (isClockedIn: boolean) => void;
  onLunchChange?: (isOnLunch: boolean) => void;
  onTimeUpdate?: (elapsedSeconds: number, status: TimeStatus) => void;
  onClockOut?: (hoursWorked: number) => void;
  maxHoursBeforeOvertime?: number;
}

interface ActiveSession {
  activeLogId: string | null;
  clockInTime: number | null;
  breakStartTime: number | null;
  totalWorkedToday: number;
  totalBreakToday: number;
  status: TimeStatus;
}

export function TimeTracker({
  onClockInChange,
  onLunchChange,
  onTimeUpdate,
  onClockOut,
  maxHoursBeforeOvertime = 8
}: TimeTrackerProps) {
  const { user } = useUser();
  const { toast } = useToast();
  
  const [session, setSession] = useState<ActiveSession>({
    activeLogId: null,
    clockInTime: null,
    breakStartTime: null,
    totalWorkedToday: 0,
    totalBreakToday: 0,
    status: "idle"
  });

  const [loading, setLoading] = useState(true);
  const [overtimeNotificationShown, setOvertimeNotificationShown] = useState(false);

  // Confirmation dialogs
  const [clockInConfirmOpen, setClockInConfirmOpen] = useState(false);
  const [clockOutConfirmOpen, setClockOutConfirmOpen] = useState(false);
  const [breakStartConfirmOpen, setBreakStartConfirmOpen] = useState(false);
  const [breakEndConfirmOpen, setBreakEndConfirmOpen] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getCurrentDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0]; // Simple YYYY-MM-DD format
  };

  // Single function to calculate all times from logs
  const calculateTimesFromLogs = (logs: any[]) => {
    let totalWorked = 0;
    let totalBreak = 0;
    let activeLog = null;
    let activeClockIn = null;
    let activeBreakStart = null;

    for (const log of logs) {
      // Check for active work session (clocked in but not out)
      if (log.clock_in && !log.clock_out) {
        activeLog = log;
        activeClockIn = new Date(log.clock_in).getTime();
        
        // Check if currently on break within this session
        if (log.break_start && !log.break_end) {
          activeBreakStart = new Date(log.break_start).getTime();
        }
      }
      
      // Check for active break (clocked out but break not ended)
      else if (log.clock_out && log.break_start && !log.break_end) {
        activeLog = log;
        activeBreakStart = new Date(log.break_start).getTime();
      }

      // Calculate completed work time for this log
      if (log.clock_in && log.clock_out) {
        let workTime = (new Date(log.clock_out).getTime() - new Date(log.clock_in).getTime()) / 1000;
        
        // Subtract break time if break was completed
        if (log.break_start && log.break_end) {
          const breakTime = (new Date(log.break_end).getTime() - new Date(log.break_start).getTime()) / 1000;
          workTime -= breakTime;
          totalBreak += breakTime;
        }
        
        totalWorked += Math.max(0, workTime);
      }

      // Add any completed break time to total (even if work session is still active)
      if (log.break_start && log.break_end) {
        const breakTime = (new Date(log.break_end).getTime() - new Date(log.break_start).getTime()) / 1000;
        // Only add if we haven't already counted it above
        if (!(log.clock_in && log.clock_out)) {
          totalBreak += breakTime;
        }
      }
    }

    return {
      totalWorked: Math.floor(totalWorked),
      totalBreak: Math.floor(totalBreak),
      activeLog,
      activeClockIn,
      activeBreakStart
    };
  };

  // Get current display times (including active sessions)
  const getCurrentTimes = () => {
    const now = Date.now();
    
    let currentWorked = session.totalWorkedToday;
    let currentBreak = session.totalBreakToday;

    // Add current work session time
    if (session.status === "working" || session.status === "overtime_pending") {
      if (session.clockInTime) {
        currentWorked = session.totalWorkedToday + Math.floor((now - session.clockInTime) / 1000);
      }
    }

    // Add current break time
    if (session.status === "lunch" && session.breakStartTime) {
      currentBreak = session.totalBreakToday + Math.floor((now - session.breakStartTime) / 1000);
    }

    return { currentWorked, currentBreak };
  };

  const loadSession = useCallback(async () => {
    if (!user?.id) return;

    try {
      const today = getCurrentDate();
      const logs = await getTimeLogsForDay(user.id, today);
      const { totalWorked, totalBreak, activeLog, activeClockIn, activeBreakStart } = calculateTimesFromLogs(logs);

      let newSession: ActiveSession;

      if (!activeLog) {
        // No active session - idle
        newSession = {
          activeLogId: null,
          clockInTime: null,
          breakStartTime: null,
          totalWorkedToday: totalWorked,
          totalBreakToday: totalBreak,
          status: "idle"
        };
      } else if (activeBreakStart && !activeClockIn) {
        // On break (clocked out, break started but not ended)
        newSession = {
          activeLogId: activeLog.id,
          clockInTime: null,
          breakStartTime: activeBreakStart,
          totalWorkedToday: totalWorked,
          totalBreakToday: totalBreak, // This now includes previous breaks
          status: "lunch"
        };
      } else if (activeClockIn) {
        // Currently working
        const currentTotal = totalWorked + Math.floor((Date.now() - activeClockIn) / 1000);
        const hoursWorked = currentTotal / 3600;
        const status: TimeStatus = hoursWorked >= maxHoursBeforeOvertime ? "overtime_pending" : "working";
        
        newSession = {
          activeLogId: activeLog.id,
          clockInTime: activeClockIn,
          breakStartTime: activeBreakStart, // Will be set if on break within work session
          totalWorkedToday: totalWorked,
          totalBreakToday: totalBreak, // This now includes previous breaks
          status: activeBreakStart ? "lunch" : status
        };
      } else {
        // Fallback to idle
        newSession = {
          activeLogId: null,
          clockInTime: null,
          breakStartTime: null,
          totalWorkedToday: totalWorked,
          totalBreakToday: totalBreak,
          status: "idle"
        };
      }

      setSession(newSession);
      onClockInChange?.(newSession.status === "working" || newSession.status === "overtime_pending");
      onLunchChange?.(newSession.status === "lunch");
      setLoading(false);
    } catch (error) {
      console.error('Error loading session:', error);
      setLoading(false);
    }
  }, [user?.id, maxHoursBeforeOvertime, onClockInChange, onLunchChange]);

  useEffect(() => {
    if (user?.id) {
      loadSession();
    }
  }, [user?.id, loadSession]);

  // Simplified timer effect
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (session.status !== "idle") {
      timerRef.current = setInterval(() => {
        const { currentWorked } = getCurrentTimes();
        onTimeUpdate?.(currentWorked, session.status);

        // Check for overtime transition
        if (session.status === "working" && !overtimeNotificationShown) {
          const hoursWorked = currentWorked / 3600;
          if (hoursWorked >= maxHoursBeforeOvertime) {
            setSession(prev => ({ ...prev, status: "overtime_pending" }));
            setOvertimeNotificationShown(true);
          }
        }
      }, 1000);
    } else {
      onTimeUpdate?.(session.totalWorkedToday, session.status);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session.status, session.clockInTime, session.breakStartTime, maxHoursBeforeOvertime, overtimeNotificationShown, onTimeUpdate]);

  const handleClockIn = async () => {
    if (!user?.id) return;
    setClockInConfirmOpen(false);

    try {
      const now = new Date();
      const { data, error } = await createTimeLog({ employeeId: user.id, clockIn: now });

      if (error || !data) {
        throw new Error(error?.message || "Failed to clock in");
      }

      const newLog = Array.isArray(data) ? data[0] : data;
      
      setSession(prev => ({
        ...prev,
        activeLogId: newLog.id,
        clockInTime: now.getTime(),
        status: "working"
      }));

      onClockInChange?.(true);
      dashboardEvents.emit('time_logged');

      toast({
        title: "Clocked In",
        description: `Work timer started at ${now.toLocaleTimeString()}`,
        className: "bg-green-100 text-green-800",
      });
    } catch (error) {
      console.error("Clock in error:", error);
      toast({
        title: "Clock In Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleClockOut = async () => {
    if (!session.activeLogId) return;
    setClockOutConfirmOpen(false);

    try {
      const { currentWorked } = getCurrentTimes();
      
      await updateTimeLog({ logId: session.activeLogId, clockOut: new Date() });

      const finalHours = currentWorked / 3600;
      onClockOut?.(finalHours);
      dashboardEvents.emit('time_logged');

      toast({
        title: "Clocked Out",
        description: `You worked ${formatTime(currentWorked)} today`,
        className: "bg-green-100 text-green-800",
      });

      await loadSession();
    } catch (error) {
      console.error("Clock out error:", error);
      toast({
        title: "Clock Out Failed",
        description: "Failed to clock out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStartBreak = async () => {
    if (!session.activeLogId) return;
    setBreakStartConfirmOpen(false);

    try {
      const now = new Date();
      
      // Calculate the work time that was just completed
      const currentWorkTime = session.clockInTime ? Math.floor((now.getTime() - session.clockInTime) / 1000) : 0;
      
      // End current work session and start break
      await updateTimeLog({ logId: session.activeLogId, clockOut: now });
      await startBreak(session.activeLogId);

      setSession(prev => ({
        ...prev,
        clockInTime: null,
        breakStartTime: now.getTime(),
        totalWorkedToday: prev.totalWorkedToday + currentWorkTime, // Add the work we just completed
        status: "lunch"
      }));

      onLunchChange?.(true);
      dashboardEvents.emit('time_logged');

      toast({
        title: "Break Started",
        description: "Work timer paused for break",
      });
    } catch (error) {
      console.error("Start break error:", error);
      toast({
        title: "Failed to Start Break",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEndBreak = async () => {
    if (!session.activeLogId || !user?.id) return;
    setBreakEndConfirmOpen(false);

    try {
      const now = new Date();
      
      // Calculate the break time that was just completed
      const currentBreakTime = session.breakStartTime ? Math.floor((now.getTime() - session.breakStartTime) / 1000) : 0;
      
      // End break and create new work session
      await endBreak(session.activeLogId);
      const { data, error } = await createTimeLog({ employeeId: user.id, clockIn: now });

      if (error || !data) {
        throw new Error("Failed to resume work after break");
      }

      const newLog = Array.isArray(data) ? data[0] : data;
      
      const newTotalWorked = session.totalWorkedToday;
      const hoursWorked = newTotalWorked / 3600;
      const newStatus: TimeStatus = hoursWorked >= maxHoursBeforeOvertime ? "overtime_pending" : "working";

      setSession(prev => ({
        ...prev,
        activeLogId: newLog.id,
        clockInTime: now.getTime(),
        breakStartTime: null,
        totalBreakToday: prev.totalBreakToday + currentBreakTime, // Add the break we just completed
        status: newStatus
      }));

      onLunchChange?.(false);
      dashboardEvents.emit('time_logged');

      toast({
        title: "Break Ended",
        description: "Work timer resumed",
      });
    } catch (error) {
      console.error("End break error:", error);
      toast({
        title: "Failed to End Break",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
  };

  const getStatusDisplay = (status: TimeStatus, currentTime: number) => {
    switch (status) {
      case "idle": return "Not Clocked In";
      case "lunch": return "On Break";
      case "overtime_pending": return "Overtime Pending";
      case "working": return currentTime / 3600 >= maxHoursBeforeOvertime ? "In Overtime" : "Currently Working";
      default: return "Not Clocked In";
    }
  };

  const getStatusClass = (status: TimeStatus, currentTime: number) => {
    switch (status) {
      case "idle": return "bg-muted text-muted-foreground";
      case "lunch": return "bg-[#f7b97f]/20 text-[#f7b97f]";
      case "overtime_pending": return "bg-amber-100 text-amber-800";
      case "working": 
        return currentTime / 3600 >= maxHoursBeforeOvertime
          ? "bg-red-100 text-red-800"
          : "bg-[#005cb3]/10 text-[#005cb3]";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return <div>Loading time tracker...</div>;
  }

  const { currentWorked, currentBreak } = getCurrentTimes();

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4">
        <Card className="w-full sm:w-auto transition-all duration-300 hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex gap-2 w-full sm:w-auto">
                {session.status === "idle" ? (
                  <Button
                    onClick={() => setClockInConfirmOpen(true)}
                    className="w-full sm:w-auto bg-[#005cb3] hover:bg-[#004a96]"
                  >
                    <Play className="mr-2 h-4 w-4" /> Clock In
                  </Button>
                ) : (
                  <Button
                    onClick={() => setClockOutConfirmOpen(true)}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Square className="mr-2 h-4 w-4" /> Clock Out
                  </Button>
                )}
              </div>

              <div className={cn(
                "px-3 py-1 rounded-full text-sm font-medium flex items-center whitespace-nowrap",
                getStatusClass(session.status, currentWorked)
              )}>
                {getStatusDisplay(session.status, currentWorked)}
                {(session.status !== "idle" || currentWorked > 0) && (
                  <span className="ml-2 font-mono">{formatTime(currentWorked)}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {session.status !== "idle" && (
          <Card className="w-full sm:w-auto">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {session.status !== "lunch" ? (
                  <Button
                    onClick={() => setBreakStartConfirmOpen(true)}
                    disabled={session.status !== "working" && session.status !== "overtime_pending"}
                    className="w-full sm:w-auto bg-[#f7b97f] hover:bg-[#e6a366] text-black"
                  >
                    <Coffee className="mr-2 h-4 w-4" /> Start Break
                  </Button>
                ) : (
                  <Button
                    onClick={() => setBreakEndConfirmOpen(true)}
                    className="w-full sm:w-auto bg-[#005cb3] hover:bg-[#004a96]"
                  >
                    <Check className="mr-2 h-4 w-4" /> End Break
                  </Button>
                )}

                <div className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium flex items-center gap-2",
                  session.status === "lunch"
                    ? "bg-[#f7b97f]/20 text-[#f7b97f]"
                    : "bg-muted text-muted-foreground"
                )}>
                  {session.status === "lunch" ? (
                    <>
                      <Clock className="h-4 w-4" />
                      <span>Total break today: {formatTime(currentBreak)}</span>
                    </>
                  ) : (
                    currentBreak > 0 ? (
                      `Break time today: ${formatTime(currentBreak)}`
                    ) : (
                      "No breaks taken"
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation Dialogs - Unchanged */}
      <Dialog open={clockInConfirmOpen} onOpenChange={setClockInConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Clock In</DialogTitle>
            <DialogDescription>
              Ready to start your workday at {new Date().toLocaleTimeString()}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockInConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleClockIn}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clockOutConfirmOpen} onOpenChange={setClockOutConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Clock Out</DialogTitle>
            <DialogDescription>
              Are you sure you want to end your work session? Your total time today is {formatTime(currentWorked)}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockOutConfirmOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleClockOut}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={breakStartConfirmOpen} onOpenChange={setBreakStartConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Break</DialogTitle>
            <DialogDescription>
              This will pause your work timer. Break time does not count towards your work hours.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBreakStartConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartBreak}>
              Start Break
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={breakEndConfirmOpen} onOpenChange={setBreakEndConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Break</DialogTitle>
            <DialogDescription>
              Ready to get back to work? Your break time was {formatTime(currentBreak)}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBreakEndConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEndBreak}>
              End Break
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}