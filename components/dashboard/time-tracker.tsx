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
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastLoadRef = useRef<number>(0);
  
  // Add force update counter to trigger re-renders for timer display
  const [, forceUpdate] = useState(0);

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
      if (log.clock_in && !log.clock_out) {
        activeLog = log;
        activeClockIn = new Date(log.clock_in).getTime();
        
        if (log.break_start && !log.break_end) {
          activeBreakStart = new Date(log.break_start).getTime();
        }
      } else if (log.clock_out && log.break_start && !log.break_end) {
        activeLog = log;
        activeBreakStart = new Date(log.break_start).getTime();
      }

      if (log.clock_in && log.clock_out) {
        const clockIn = new Date(log.clock_in).getTime();
        const clockOut = new Date(log.clock_out).getTime();
        let workTime = (clockOut - clockIn) / 1000;
        
        if (log.break_start && log.break_end) {
          const breakStart = new Date(log.break_start).getTime();
          const breakEnd = new Date(log.break_end).getTime();
          const overlapStart = Math.max(clockIn, breakStart);
          const overlapEnd = Math.min(clockOut, breakEnd);
          const overlapTime = Math.max(0, overlapEnd - overlapStart) / 1000;
          
          workTime -= overlapTime;
          
          const breakTime = (breakEnd - breakStart) / 1000;
          totalBreak += breakTime;
        }
        
        totalWorked += Math.max(0, workTime);
      }

      if (log.break_start && log.break_end) {
        const breakStart = new Date(log.break_start).getTime();
        const breakEnd = new Date(log.break_end).getTime();
        const breakTime = (breakEnd - breakStart) / 1000;
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

  const getCurrentTimes = () => {
    const now = Date.now();
    
    let currentWorked = session.totalWorkedToday;
    let currentBreak = session.totalBreakToday;

    if ((session.status === "working" || session.status === "overtime_pending") && session.clockInTime) {
      const currentSessionTime = Math.floor((now - session.clockInTime) / 1000);
      currentWorked = session.totalWorkedToday + currentSessionTime;
    }

    if (session.status === "lunch" && session.breakStartTime) {
      const currentBreakSession = Math.floor((now - session.breakStartTime) / 1000);
      currentBreak = session.totalBreakToday + currentBreakSession;
    }

    return { currentWorked, currentBreak };
  };

  const loadSession = useCallback(async () => {
    if (!user?.id) return;

    const now = Date.now();
    if (now - lastLoadRef.current < 2000) return; // Debounce: skip if called within 2 seconds
    lastLoadRef.current = now;

    try {
      setLoading(true);
      const today = getCurrentDate();
      const logs = await getTimeLogsForDay(user.id, today);
      const { totalWorked, totalBreak, activeLog, activeClockIn, activeBreakStart } = calculateTimesFromLogs(logs);

      let newSession: ActiveSession;

      if (!activeLog) {
        newSession = {
          activeLogId: null,
          clockInTime: null,
          breakStartTime: null,
          totalWorkedToday: totalWorked,
          totalBreakToday: totalBreak,
          status: "idle"
        };
      } else if (activeBreakStart && !activeClockIn) {
        newSession = {
          activeLogId: activeLog.id,
          clockInTime: null,
          breakStartTime: activeBreakStart,
          totalWorkedToday: totalWorked,
          totalBreakToday: totalBreak,
          status: "lunch"
        };
      } else if (activeClockIn) {
        const currentTotal = totalWorked + Math.floor((Date.now() - activeClockIn) / 1000);
        const hoursWorked = currentTotal / 3600;
        const status: TimeStatus = hoursWorked >= maxHoursBeforeOvertime ? "overtime_pending" : "working";
        
        newSession = {
          activeLogId: activeLog.id,
          clockInTime: activeClockIn,
          breakStartTime: activeBreakStart,
          totalWorkedToday: totalWorked,
          totalBreakToday: totalBreak,
          status: activeBreakStart ? "lunch" : status
        };
      } else {
        newSession = {
          activeLogId: null,
          clockInTime: null,
          breakStartTime: null,
          totalWorkedToday: totalWorked,
          totalBreakToday: totalBreak,
          status: "idle"
        };
      }

      // Only update if state has actually changed
      setSession(prevSession => {
        if (
          newSession.status !== prevSession.status ||
          newSession.activeLogId !== prevSession.activeLogId ||
          newSession.totalWorkedToday !== prevSession.totalWorkedToday ||
          newSession.totalBreakToday !== prevSession.totalBreakToday ||
          newSession.clockInTime !== prevSession.clockInTime ||
          newSession.breakStartTime !== prevSession.breakStartTime
        ) {
          onClockInChange?.(newSession.status === "working" || newSession.status === "overtime_pending");
          onLunchChange?.(newSession.status === "lunch");
          return newSession;
        }
        return prevSession;
      });
    } catch (error) {
      console.error('Error loading session:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync time tracker state. Please refresh.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, maxHoursBeforeOvertime, onClockInChange, onLunchChange, toast]);

  // Initialize session and set up BroadcastChannel
  useEffect(() => {
    if (user?.id) {
      loadSession();
      channelRef.current = new BroadcastChannel('time_tracker_channel');
      channelRef.current.onmessage = (event) => {
        if (event.data.type === 'state_changed') {
          // Clear debounce to allow immediate load on broadcast
          lastLoadRef.current = 0;
          loadSession();
        }
      };
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
    };
  }, [user?.id, loadSession]);

  // Periodic polling for cross-browser sync
  useEffect(() => {
    if (!user?.id) return;

    const pollInterval = setInterval(() => {
      loadSession();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
  }, [user?.id, loadSession]);

  // Notify other tabs on state change
  const notifyTabs = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'state_changed',
        status: session.status,
        activeLogId: session.activeLogId
      });
    }
  }, [session.status, session.activeLogId]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (session.status !== "idle") {
      timerRef.current = setInterval(() => {
        const { currentWorked, currentBreak } = getCurrentTimes();
        
        // Force re-render to update displayed times
        forceUpdate(prev => prev + 1);
        
        // Update parent component
        onTimeUpdate?.(currentWorked, session.status);

        if (session.status === "working" && !overtimeNotificationShown) {
          const hoursWorked = currentWorked / 3600;
          if (hoursWorked >= maxHoursBeforeOvertime) {
            setSession(prev => ({ ...prev, status: "overtime_pending" }));
            setOvertimeNotificationShown(true);
            toast({
              title: "Overtime Alert",
              description: "You have reached the maximum hours for regular time.",
              className: "bg-amber-100 text-amber-800",
            });
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
  }, [session, maxHoursBeforeOvertime, overtimeNotificationShown, onTimeUpdate, toast]);

  const handleClockIn = async () => {
    if (!user?.id || loading) return;
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
      notifyTabs();

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
    if (!session.activeLogId || loading) return;
    setClockOutConfirmOpen(false);

    try {
      const now = new Date();
      const { currentWorked } = getCurrentTimes();
      
      if (session.status === "lunch" && session.breakStartTime) {
        const currentBreakTime = Math.floor((now.getTime() - session.breakStartTime) / 1000);
        
        await endBreak(session.activeLogId);
        
        setSession(prev => ({
          ...prev,
          breakStartTime: null,
          totalBreakToday: prev.totalBreakToday + currentBreakTime,
          status: "idle"
        }));
        
        onLunchChange?.(false);
      } else {
        await updateTimeLog({ logId: session.activeLogId, clockOut: now });
        
        setSession(prev => ({
          ...prev,
          clockInTime: null,
          activeLogId: null,
          status: "idle"
        }));
        
        onClockInChange?.(false);
      }

      const finalHours = currentWorked / 3600;
      onClockOut?.(finalHours);
      dashboardEvents.emit('time_logged');
      notifyTabs();

      toast({
        title: "Clocked Out",
        description: `You worked ${formatTime(currentWorked)} today`,
        className: "bg-green-100 text-green-800",
      });

      // Clear debounce and reload
      lastLoadRef.current = 0;
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
    if (!session.activeLogId || loading) return;
    setBreakStartConfirmOpen(false);

    try {
      const now = new Date();
      const currentWorkTime = session.clockInTime ? Math.floor((now.getTime() - session.clockInTime) / 1000) : 0;
      
      await updateTimeLog({ logId: session.activeLogId, clockOut: now });
      await startBreak(session.activeLogId);

      setSession(prev => ({
        ...prev,
        clockInTime: null,
        breakStartTime: now.getTime(),
        totalWorkedToday: prev.totalWorkedToday + currentWorkTime,
        status: "lunch"
      }));

      onLunchChange?.(true);
      dashboardEvents.emit('time_logged');
      notifyTabs();

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
    if (!session.activeLogId || !user?.id || loading) return;
    setBreakEndConfirmOpen(false);

    try {
      const now = new Date();
      const currentBreakTime = session.breakStartTime ? Math.floor((now.getTime() - session.breakStartTime) / 1000) : 0;
      
      await endBreak(session.activeLogId);
      const { data, error } = await createTimeLog({ employeeId: user.id, clockIn: now });

      if (error || !data) {
        throw new Error("Failed to resume work after break");
      }

      const newLog = Array.isArray(data) ? data[0] : data;
      const hoursWorked = session.totalWorkedToday / 3600;
      const newStatus: TimeStatus = hoursWorked >= maxHoursBeforeOvertime ? "overtime_pending" : "working";

      setSession(prev => ({
        ...prev,
        activeLogId: newLog.id,
        clockInTime: now.getTime(),
        breakStartTime: null,
        totalBreakToday: prev.totalBreakToday + currentBreakTime,
        status: newStatus
      }));

      onLunchChange?.(false);
      dashboardEvents.emit('time_logged');
      notifyTabs();

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
                    disabled={loading}
                    className="w-full sm:w-auto bg-[#005cb3] hover:bg-[#004a96]"
                  >
                    <Play className="mr-2 h-4 w-4" /> Clock In
                  </Button>
                ) : (
                  <Button
                    onClick={() => setClockOutConfirmOpen(true)}
                    disabled={session.status === "lunch" || loading}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={session.status !== "working" && session.status !== "overtime_pending" || loading}
                    className="w-full sm:w-auto bg-[#f7b97f] hover:bg-[#e6a366] text-black"
                  >
                    <Coffee className="mr-2 h-4 w-4" /> Start Break
                  </Button>
                ) : (
                  <Button
                    onClick={() => setBreakEndConfirmOpen(true)}
                    disabled={loading}
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

      <Dialog open={clockInConfirmOpen && !loading} onOpenChange={setClockInConfirmOpen}>
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

      <Dialog open={clockOutConfirmOpen && !loading} onOpenChange={setClockOutConfirmOpen}>
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

      <Dialog open={breakStartConfirmOpen && !loading} onOpenChange={setBreakStartConfirmOpen}>
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

      <Dialog open={breakEndConfirmOpen && !loading} onOpenChange={setBreakEndConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Break</DialogTitle>
            <DialogDescription>
              Ready to get back to work? Your break time was {formatTime(session.breakStartTime ? Math.floor((Date.now() - session.breakStartTime) / 1000) : 0)}.
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