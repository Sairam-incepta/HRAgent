"use client";

import { useState, useRef, useEffect, memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Coffee, Check, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getTimeLogsForDay,
  createTimeLog,
  updateTimeLog,
  getPolicySales,
  getHighValuePolicyNotificationsList,
  getClientReviews
} from "@/lib/database";
import { supabase } from "@/lib/supabase";
import { useUser } from '@clerk/nextjs';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { dashboardEvents } from "@/lib/events";
import { OvertimeNotificationDialog } from "./overtime-notification-dialog";
import { DailySummaryRequiredDialog } from "./daily-summary-required-dialog";

type TimeStatus = "idle" | "working" | "lunch" | "overtime_pending";

interface TimeTrackerProps {
  onClockInChange?: (isClockedIn: boolean) => void;
  onLunchChange?: (isOnLunch: boolean) => void;
  onTimeUpdate?: (elapsedSeconds: number, status: TimeStatus) => void;
  onClockOut?: (hoursWorked: number) => void;
  maxHoursBeforeOvertime?: number;
  hourlyRate?: number;
}

interface TimeSession {
  startTime: number;
  status: TimeStatus;
  date: string; // YYYY-MM-DD format
  lunchStartTime?: number; // Use undefined instead of null
  totalLunchTime?: number;
}

const STORAGE_KEY = 'letsinsure_time_session';

export function TimeTracker({
  onClockInChange,
  onLunchChange,
  onTimeUpdate,
  onClockOut,
  maxHoursBeforeOvertime = 8,
  hourlyRate = 25
}: TimeTrackerProps) {
  const { user } = useUser();
  const [status, setStatus] = useState<TimeStatus>("idle");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [overtimeNotificationShown, setOvertimeNotificationShown] = useState(false);
  const [overtimeDialogOpen, setOvertimeDialogOpen] = useState(false);

  // NEW: Lunch break tracking
  const [lunchStartTime, setLunchStartTime] = useState<number | null>(null);
  const [totalLunchTime, setTotalLunchTime] = useState(0);
  const [currentLunchTime, setCurrentLunchTime] = useState(0);

  // ===== Daily lunch accumulation across multiple sessions =====
  const DAILY_LUNCH_KEY_PREFIX = 'letsinsure_daily_lunch_';
  const [dailyLunchSeconds, setDailyLunchSeconds] = useState(0);
  const dailyLunchSecondsRef = useRef(0);
  const getDailyLunchKey = (date: string) => `${DAILY_LUNCH_KEY_PREFIX}${date}`;

  // Confirmation dialog states
  const [clockInConfirmOpen, setClockInConfirmOpen] = useState(false);
  const [clockOutConfirmOpen, setClockOutConfirmOpen] = useState(false);
  const [lunchStartConfirmOpen, setLunchStartConfirmOpen] = useState(false);
  const [lunchEndConfirmOpen, setLunchEndConfirmOpen] = useState(false);
  const [showOvertimeDialog, setShowOvertimeDialog] = useState(false);
  const [showDailySummaryDialog, setShowDailySummaryDialog] = useState(false);
  const [isUpdatingLogs, setIsUpdatingLogs] = useState(false);
  const [logsToday, setLogsToday] = useState<any[]>([]);
  const [currentBonuses, setCurrentBonuses] = useState(0);
  const [unreviewedPolicies, setUnreviewedPolicies] = useState(0);

  const { toast } = useToast();

  const [activeLogId, setActiveLogId] = useState<string | null>(null);

  const baseTimeRef = useRef(0);
  const totalLunchTimeRef = useRef(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const saveTimeSession = useCallback(() => {
    if (status !== 'idle' && startTime) {
      const sessionData: TimeSession = {
        startTime: startTime,
        status: status,
        date: getCurrentDate(),
        lunchStartTime: lunchStartTime || undefined,
        totalLunchTime: totalLunchTimeRef.current
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [status, startTime, lunchStartTime]);

  const getCurrentDate = () => {
    const now = new Date();
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localDate = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const calculateTotalTimeWorked = (logs: any[]) => {
    let total = 0;
    logs.forEach(log => {
      if (log.clock_in && log.clock_out) {
        total += (new Date(log.clock_out).getTime() - new Date(log.clock_in).getTime()) / 1000;
      }
    });
    return Math.floor(total);
  };

  const fetchAndSumLogs = useCallback(async () => {
    if (!user?.id) return;

    setIsUpdatingLogs(true);
    try {
      const today = getCurrentDate();
      const logs = await getTimeLogsForDay(user.id, today);
      setLogsToday(logs);

      const adjustedFromLogs = calculateTotalTimeWorked(logs);
      baseTimeRef.current = adjustedFromLogs;

      const openLog = logs.find(log => log.clock_in && !log.clock_out);
      if (!openLog) {
        setElapsedTime(adjustedFromLogs);
      }
    } finally {
      setIsUpdatingLogs(false);
    }
  }, [user?.id]);

  const loadTimeSession = useCallback(() => {
    const savedSessionRaw = localStorage.getItem(STORAGE_KEY);
    if (!savedSessionRaw) return;

    try {
      const savedSession: TimeSession = JSON.parse(savedSessionRaw);
      const today = getCurrentDate();

      if (savedSession.date === today && user?.id) {
        setStartTime(savedSession.startTime);
        setStatus(savedSession.status);

        const accumulatedLunch = savedSession.totalLunchTime || 0;
        setTotalLunchTime(accumulatedLunch);
        totalLunchTimeRef.current = accumulatedLunch;

        if (savedSession.status === 'lunch' && savedSession.lunchStartTime) {
          setLunchStartTime(savedSession.lunchStartTime);
          onLunchChange?.(true);
        }

        onClockInChange?.(true);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("Failed to load time session:", error);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user?.id, onClockInChange, onLunchChange]);

  useEffect(() => {
    if (user?.id) {
      fetchAndSumLogs();
      loadTimeSession();
    }
  }, [user?.id, fetchAndSumLogs, loadTimeSession]);

  // Load saved daily lunch seconds once on mount (per day)
  useEffect(() => {
    const today = getCurrentDate();
    const stored = localStorage.getItem(getDailyLunchKey(today));
    const savedSeconds = stored ? parseInt(stored, 10) : 0;
    setDailyLunchSeconds(savedSeconds);
    dailyLunchSecondsRef.current = savedSeconds;
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (status === "working" || status === "overtime_pending") {
      const updateWorkTimer = () => {
        if (!startTime) return;
        const now = Date.now();
        const currentSessionGrossTime = (now - startTime) / 1000;
        const totalWorkTime = Math.max(0, Math.floor(baseTimeRef.current + currentSessionGrossTime));
        setElapsedTime(totalWorkTime);

        const hoursWorked = totalWorkTime / 3600;
        if (hoursWorked >= maxHoursBeforeOvertime && status === 'working' && !overtimeNotificationShown) {
          setStatus("overtime_pending");
          setOvertimeNotificationShown(true);
          setOvertimeDialogOpen(true);
        }
      };
      updateWorkTimer();
      intervalRef.current = setInterval(updateWorkTimer, 1000);

    } else if (status === "lunch" && lunchStartTime) {
      const updateLunchTimer = () => {
        const now = Date.now();
        const currentBreakDuration = (now - lunchStartTime) / 1000;
        setCurrentLunchTime(Math.floor(currentBreakDuration));
      };
      updateLunchTimer();
      intervalRef.current = setInterval(updateLunchTimer, 1000);
    }

    saveTimeSession();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, startTime, lunchStartTime, saveTimeSession, maxHoursBeforeOvertime, overtimeNotificationShown]);

  useEffect(() => {
    onTimeUpdate?.(elapsedTime, status);
  }, [elapsedTime, status, onTimeUpdate]);

  const resetLunchStates = () => {
    // Clear only the active lunch session timers but keep the accumulated total for the day
    setLunchStartTime(null);
    setCurrentLunchTime(0);
    // totalLunchTimeRef / setTotalLunchTime persist the day’s accumulated lunch seconds;
    // do NOT reset them here so multiple work sessions keep the correct lunch total.
  };

  // Prevent rapid double-clicks & avoid hover-flicker
  const [processingClock, setProcessingClock] = useState<'in' | 'out' | null>(null);
  const [processingLunch, setProcessingLunch] = useState<'start' | 'end' | null>(null);

  const confirmClockIn = async () => {
    setProcessingClock('in');
    if (!user) return;
    setClockInConfirmOpen(false);

    try {
      await fetchAndSumLogs(); // Get latest log data before clocking in
      resetLunchStates(); // clear any active break timers but keep daily total
      
      const now = new Date();
      const { data, error } = await createTimeLog({ employeeId: user.id, clockIn: now });

      if (error || !data) {
        throw new Error(error?.message || "Failed to create time log entry.");
      }
      
      const newLog = Array.isArray(data) ? data[0] : data;
      if (!newLog) {
          throw new Error("Failed to create time log entry.");
      }

      setStartTime(now.getTime());
      setStatus("working");
      setActiveLogId(newLog.id);
      onClockInChange?.(true);

      toast({
        title: "Clocked In",
        description: `Your work timer has started at ${now.toLocaleTimeString()}. Let's have a great day!`,
        className: "bg-green-100 text-green-800",
      });
    } catch (error) {
      console.error("Error creating time log:", error);
      toast({
        title: "Clock In Failed",
        description: (error as Error).message || "There was an error starting your timer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingClock(null);
    }
  };

  const performClockOut = async () => {
    setProcessingClock('out');
    if (!activeLogId || !user?.id) {
      toast({
        title: "Error",
        description: "No active clock-in session found to clock out.",
        variant: "destructive",
      });
      setProcessingClock(null);
      return;
    }

    try {
      // Capture the final, correctly calculated net time BEFORE resetting state.
      const finalElapsedTime = elapsedTime;

      await updateTimeLog({ logId: activeLogId, clockOut: new Date() });
      
      onClockOut?.(finalElapsedTime / 3600);
      toast({
        title: "Clocked Out",
        description: `You worked for ${formatTime(finalElapsedTime)} today. Great job!`,
        className: "bg-green-100 text-green-800",
      });
      
      dashboardEvents.emit('time_logged');

      // Reset all session-specific states
      setStatus("idle");
      setActiveLogId(null);
      setStartTime(null);
      localStorage.removeItem(STORAGE_KEY);
      resetLunchStates(); // Clear out lunch timers

      // Explicitly set the displayed time to the final calculated value.
      // And update the base ref for any subsequent clock-ins on the same day.
      setElapsedTime(finalElapsedTime);
      baseTimeRef.current = finalElapsedTime;
      
      // We still need to refresh the logs for other UI elements, but we do it manually
      // without calling fetchAndSumLogs() to avoid its side-effects on elapsedTime.
      const today = getCurrentDate();
      const logs = await getTimeLogsForDay(user.id, today);
      setLogsToday(logs);

    } catch (error) {
      toast({
        title: "Clock Out Failed",
        description: "There was an error saving your clock-out time. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingClock(null);
    }
  };

  // ----- LUNCH BREAK HANDLERS -----
  const confirmStartLunch = async () => {
    if (processingLunch) return;
    setProcessingLunch('start');
    if (!(status === "working" || status === "overtime_pending")) return;
    if (!activeLogId) {
      console.warn("No active log when starting lunch – this should not happen.");
      setProcessingLunch(null);
      return;
    }

    try {
      // Close the current work session at lunch start
      await updateTimeLog({ logId: activeLogId, clockOut: new Date() });

      // Freeze elapsed time up to this point (net, already excluding previous lunch)
      baseTimeRef.current = elapsedTime;

      // Clear work timer specifics
      setActiveLogId(null);
      setStartTime(null);

      // Start lunch timers
      setLunchStartTime(Date.now());
      setStatus("lunch");
      onLunchChange?.(true);

      // Notify dashboard to refresh weekly summary
      dashboardEvents.emit('time_logged');
    } catch (err) {
      console.error("Failed to start lunch break:", err);
      toast({
        title: "Error starting lunch break",
        description: "We couldn't save your time log. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingLunch(null);
      setLunchStartConfirmOpen(false);
      saveTimeSession();
    }
  };

  const confirmEndLunch = async () => {
    if (processingLunch) return;
    setProcessingLunch('end');
    if (!lunchStartTime || !user?.id) { setProcessingLunch(null); return; }

    const lunchDuration = (Date.now() - lunchStartTime) / 1000;

    try {
      // Accumulate lunch seconds for the day
      totalLunchTimeRef.current += lunchDuration;
      setTotalLunchTime(totalLunchTimeRef.current);

      dailyLunchSecondsRef.current += lunchDuration;
      setDailyLunchSeconds(dailyLunchSecondsRef.current);
      localStorage.setItem(getDailyLunchKey(getCurrentDate()), dailyLunchSecondsRef.current.toString());

      // Start a new work session after lunch
      const now = new Date();
      const { data, error } = await createTimeLog({ employeeId: user.id, clockIn: now });

      if (error || !data) throw new Error(error?.message || "Unable to start new time log after lunch.");

      const newLog = Array.isArray(data) ? data[0] : data;
      if (!newLog) throw new Error("No time log returned after lunch.");

      setActiveLogId(newLog.id);
      setStartTime(now.getTime());

      // Reset current break timers
      setLunchStartTime(null);
      setCurrentLunchTime(0);

      // Resume working status (check overtime threshold)
      const hoursWorkedSoFar = baseTimeRef.current / 3600;
      const newStatus = hoursWorkedSoFar >= maxHoursBeforeOvertime ? "overtime_pending" : "working";
      setStatus(newStatus);
      onLunchChange?.(false);

      toast({
        title: "Back to Work!",
        description: `You took a ${formatTime(lunchDuration)} break. Your work timer has resumed.`,
      });

      dashboardEvents.emit('time_logged');
    } catch (err) {
      console.error("Failed to end lunch break:", err);
      toast({
        title: "Error ending lunch break",
        description: (err as Error).message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingLunch(null);
      setLunchEndConfirmOpen(false);
      saveTimeSession();
    }
  };
  
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
  };

  // JSX Rendering
  const totalLunchDisplaySeconds = status === 'lunch'
    ? totalLunchTimeRef.current + currentLunchTime
    : totalLunchTime;

  const ClockInButton = () => (
    <Button
      disabled={processingClock === 'in'}
      onClick={() => {
        if (processingClock) return;
        setClockInConfirmOpen(true);
      }}
      className="w-full sm:w-auto bg-[#005cb3] hover:bg-[#004a96] transition-none"
    >
      <Play className="mr-2 h-4 w-4" /> Clock In
    </Button>
  );

  const ClockOutButton = () => (
    <Button
      disabled={processingClock === 'out'}
      onClick={() => {
        if (processingClock) return;
        setClockOutConfirmOpen(true);
      }}
      className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white transition-none"
    >
      <Square className="mr-2 h-4 w-4" /> Clock Out
    </Button>
  );

  // Start lunch immediately with a single click (no confirmation dialog)
  const LunchBreakButton = () => (
    <Button
      disabled={(processingLunch === 'start') || (status !== 'working' && status !== 'overtime_pending')}
      onClick={confirmStartLunch}
      className={cn(
        'w-full sm:w-auto h-10 px-4',
        processingLunch === 'start'
          ? 'bg-[#f7b97f]/60 cursor-wait text-black'
          : 'bg-[#f7b97f] hover:bg-[#f7b97f]/90 text-black'
      )}
    >
      <Coffee className="mr-2 h-4 w-4" /> Start Lunch Break
    </Button>
  );

  // End lunch immediately with a single click (no confirmation dialog)
  const EndLunchBreakButton = () => (
    <Button
      disabled={(processingLunch === 'end') || status !== 'lunch'}
      onClick={confirmEndLunch}
      className={cn(
        'w-full sm:w-auto h-10 px-4',
        processingLunch === 'end'
          ? 'bg-[#005cb3]/60 cursor-wait'
          : 'bg-[#005cb3] hover:bg-[#005cb3]/90'
      )}
    >
      <Check className="mr-2 h-4 w-4" /> End Lunch Break
    </Button>
  );

  const LunchBreakDisplay = () => (
    <div className={`
      rounded-full px-4 py-1.5 text-sm font-medium flex items-center gap-2
      ${status === "lunch" 
        ? "bg-[#f7b97f]/20 text-[#f7b97f] dark:bg-[#f7b97f]/30 dark:text-[#f7b97f]"
        : "bg-muted text-muted-foreground"
      }
    `}>
      {status === "lunch" ? (
        <>
          <Clock className="h-4 w-4" />
          <span>Lunch: {formatTime(currentLunchTime + totalLunchTimeRef.current)}</span>
        </>
      ) : (
        "Not on Break"
      )}
    </div>
  );
  
  const TotalLunchDisplay = () => (
    <div className="text-xs text-muted-foreground">
      Total lunch: {formatTime(Math.floor(totalLunchTime))}
    </div>
  );

  function getStatusClass(status: TimeStatus) {
    const isInOvertime = status === "overtime_pending" || (status === "working" && (elapsedTime / 3600) > maxHoursBeforeOvertime);
  
    switch (status) {
      case "idle":
        return "bg-muted text-muted-foreground";
      case "lunch":
        return "bg-[#f7b97f]/20 text-[#f7b97f] dark:bg-[#f7b97f]/30 dark:text-[#f7b97f]";
      case "overtime_pending":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "working":
        return isInOvertime 
          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          : "bg-[#005cb3]/10 text-[#005cb3] dark:bg-[#005cb3]/30 dark:text-[#005cb3]";
      default:
        return "bg-muted text-muted-foreground";
    }
  }
  
  function getStatusDisplay(status: TimeStatus) {
    const isInOvertime = status === "overtime_pending" || (status === "working" && (elapsedTime / 3600) > maxHoursBeforeOvertime);
  
    switch (status) {
      case "idle":
        return "Not Clocked In";
      case "lunch":
        return "On Lunch Break";
      case "overtime_pending":
        return "Overtime Pending";
      case "working":
        return isInOvertime ? "In Overtime" : "Currently Working";
      default:
        return "Not Clocked In";
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4">
        <Card className="w-full sm:w-auto transition-all duration-300 hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex gap-2 w-full sm:w-auto">
                {status === "idle" ? <ClockInButton /> : <ClockOutButton />}
              </div>
              
              <div className={cn(
                "px-3 py-1 rounded-full text-sm font-medium flex items-center whitespace-nowrap",
                getStatusClass(status)
              )}>
                {getStatusDisplay(status)}
                {(status !== "idle" || elapsedTime > 0) && (
                  <span className="ml-2 font-mono">{formatTime(elapsedTime)}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {status !== "idle" && (
          <Card className="w-full sm:w-auto">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {status !== "lunch" ? <LunchBreakButton /> : <EndLunchBreakButton />}
                <LunchBreakDisplay />
                {totalLunchTime > 0 && status !== "lunch" && <TotalLunchDisplay />}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Dialogs */}
      <Dialog open={clockInConfirmOpen} onOpenChange={setClockInConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Clock In</DialogTitle></DialogHeader>
          <DialogDescription>Ready to start your workday at {new Date().toLocaleTimeString()}?</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockInConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-[#005cb3] hover:bg-[#005cb3]/90" onClick={confirmClockIn}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={clockOutConfirmOpen} onOpenChange={setClockOutConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Clock Out</DialogTitle></DialogHeader>
          <DialogDescription>Are you sure you want to end your work session? Your total time today is {formatTime(elapsedTime)}.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockOutConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => {performClockOut(); setClockOutConfirmOpen(false);}}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={lunchStartConfirmOpen} onOpenChange={setLunchStartConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Start Lunch Break</DialogTitle></DialogHeader>
          <DialogDescription>This will pause your work timer. Lunch time does not count towards your work hours.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLunchStartConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-[#f7b97f] hover:bg-[#f7b97f]/90 text-black" onClick={confirmStartLunch}>Start Lunch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={lunchEndConfirmOpen} onOpenChange={setLunchEndConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>End Lunch Break</DialogTitle></DialogHeader>
          <DialogDescription>Ready to get back to work? Your current break is {formatTime(currentLunchTime)}.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLunchEndConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-[#005cb3] hover:bg-[#005cb3]/90" onClick={confirmEndLunch}>End Break</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OvertimeNotificationDialog
        open={overtimeDialogOpen}
        onOpenChange={setOvertimeDialogOpen}
        currentHours={elapsedTime / 3600}
        maxHours={maxHoursBeforeOvertime}
        onSubmitRequest={(reason) => {
          setStatus("working");
        }}
        onClockOut={performClockOut}
      />
    </>
  );
}