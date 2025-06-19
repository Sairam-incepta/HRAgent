"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Coffee, Check, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  pausedTime: number;
  status: TimeStatus;
  date: string; // YYYY-MM-DD format
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
  const [status, setStatus] = useState<TimeStatus>("idle");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pausedTime, setPausedTime] = useState(0);
  const [overtimeNotificationShown, setOvertimeNotificationShown] = useState(false);
  const [overtimeDialogOpen, setOvertimeDialogOpen] = useState(false);
  
  // Confirmation dialog states
  const [clockInConfirmOpen, setClockInConfirmOpen] = useState(false);
  const [clockOutConfirmOpen, setClockOutConfirmOpen] = useState(false);
  const [lunchStartConfirmOpen, setLunchStartConfirmOpen] = useState(false);
  const [lunchEndConfirmOpen, setLunchEndConfirmOpen] = useState(false);
  
  const { toast } = useToast();

  // Get current date in user's timezone
  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
  };

  // Load time session from localStorage on component mount
  useEffect(() => {
    const loadTimeSession = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const session: TimeSession = JSON.parse(stored);
          const currentDate = getCurrentDate();
          
          // Only restore session if it's from today
          if (session.date === currentDate) {
            setStatus(session.status);
            setStartTime(session.startTime);
            setPausedTime(session.pausedTime);
            
            // Calculate elapsed time based on current time
            if (session.status === "working" || session.status === "overtime_pending") {
              const now = Date.now();
              const elapsed = Math.floor((now - session.startTime) / 1000) + session.pausedTime;
              setElapsedTime(elapsed);
            } else if (session.status === "lunch") {
              setElapsedTime(session.pausedTime);
            }
            
            // Restore notification state
            const hoursWorked = (session.pausedTime + (session.status === "working" ? (Date.now() - session.startTime) / 1000 : 0)) / 3600;
            if (hoursWorked > maxHoursBeforeOvertime) {
              setOvertimeNotificationShown(true);
            }
          } else {
            // Clear old session data
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('Error loading time session:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    loadTimeSession();
  }, [maxHoursBeforeOvertime]);

  // Save time session to localStorage whenever relevant state changes
  useEffect(() => {
    if (status !== "idle" && startTime) {
      const session: TimeSession = {
        startTime,
        pausedTime,
        status,
        date: getCurrentDate()
      };
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } catch (error) {
        console.error('Error saving time session:', error);
      }
    } else if (status === "idle") {
      // Clear session when idle
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [status, startTime, pausedTime]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (status === "working" && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000) + pausedTime;
        setElapsedTime(elapsed);
        
        // Notify parent component of time update
        onTimeUpdate?.(elapsed, status);
        
        // Check for overtime
        const hoursWorked = elapsed / 3600;
        if (hoursWorked > maxHoursBeforeOvertime && !overtimeNotificationShown) {
          setOvertimeNotificationShown(true);
          setOvertimeDialogOpen(true);
          setStatus("overtime_pending");
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [status, startTime, pausedTime, maxHoursBeforeOvertime, overtimeNotificationShown, onTimeUpdate]);

  // Update parent when status changes
  useEffect(() => {
    onTimeUpdate?.(elapsedTime, status);
  }, [status, elapsedTime, onTimeUpdate]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const calculatePay = (seconds: number) => {
    const hours = seconds / 3600;
    const regularHours = Math.min(hours, maxHoursBeforeOvertime);
    const overtimeHours = Math.max(0, hours - maxHoursBeforeOvertime);
    
    const regularPay = regularHours * hourlyRate;
    const overtimePay = overtimeHours * hourlyRate * 1.0; // 1x rate for overtime
    
    return {
      regularPay,
      overtimePay,
      totalPay: regularPay + overtimePay,
      overtimeHours
    };
  };

  const confirmClockIn = () => {
    const now = Date.now();
    setStatus("working");
    setStartTime(now);
    
    // If there's existing time from today, keep it, otherwise reset
    const currentDate = getCurrentDate();
    const stored = localStorage.getItem(STORAGE_KEY);
    let existingPausedTime = 0;
    
    if (stored) {
      try {
        const session: TimeSession = JSON.parse(stored);
        if (session.date === currentDate) {
          existingPausedTime = session.pausedTime;
        }
      } catch (error) {
        console.error('Error parsing stored session:', error);
      }
    }
    
    setPausedTime(existingPausedTime);
    setElapsedTime(existingPausedTime);
    setOvertimeNotificationShown(false);
    onClockInChange?.(true);
    setClockInConfirmOpen(false);
    
    toast({
      title: "Clocked In",
      description: `You clocked in at ${new Date().toLocaleTimeString()}${existingPausedTime > 0 ? ` (continuing from ${formatTime(existingPausedTime)})` : ''}`,
    });
  };

  const confirmClockOut = () => {
    // Clock out immediately without requiring daily summary popup
    performClockOut();
    setClockOutConfirmOpen(false);
  };

  const performClockOut = () => {
    const payInfo = calculatePay(elapsedTime);
    const hoursWorked = elapsedTime / 3600;
    
    setStatus("idle");
    setStartTime(null);
    setOvertimeNotificationShown(false);
    onClockInChange?.(false);
    onLunchChange?.(false);
    setClockOutConfirmOpen(false);
    
    // Don't reset elapsed time and paused time - keep them for the day
    // Only clear from localStorage
    localStorage.removeItem(STORAGE_KEY);
    
    let description = `You clocked out at ${new Date().toLocaleTimeString()} after ${formatTime(elapsedTime)} total today`;
    if (payInfo.overtimeHours > 0) {
      description += `\nOvertime pay: $${payInfo.overtimePay.toFixed(2)} for ${payInfo.overtimeHours.toFixed(1)} hours`;
    }
    
    toast({
      title: "Clocked Out",
      description,
    });

    onClockOut?.(hoursWorked);
  };

  const confirmStartLunch = () => {
    if (status === "working") {
      setPausedTime(elapsedTime);
      setStatus("lunch");
      onLunchChange?.(true);
      setLunchStartConfirmOpen(false);
      
      toast({
        title: "Lunch Break Started",
        description: `Timer paused at ${formatTime(elapsedTime)}. Enjoy your break!`,
      });
    }
  };

  const confirmEndLunch = () => {
    if (status === "lunch") {
      setStartTime(Date.now());
      setStatus("working");
      onLunchChange?.(false);
      setLunchEndConfirmOpen(false);
      
      toast({
        title: "Lunch Break Ended",
        description: "Timer resumed. Welcome back!",
      });
    }
  };

  const handleOvertimeRequest = (reason: string) => {
    // In a real app, this would submit to the backend
    setStatus("working"); // Continue working while waiting for approval
    toast({
      title: "Overtime Request Submitted",
      description: "Your overtime request has been sent to admin for approval. You can continue working.",
    });
  };

  const handleForceClockOut = () => {
    const payInfo = calculatePay(elapsedTime);
    performClockOut();
    
    toast({
      title: "Automatically Clocked Out",
      description: `You've been paid overtime for ${payInfo.overtimeHours.toFixed(1)} hours: $${payInfo.overtimePay.toFixed(2)}`,
    });
  };

  const pauseTimer = () => {
    if (status === "working") {
      setPausedTime(elapsedTime);
      setStatus("lunch");
    }
  };

  const resumeTimer = () => {
    if (status === "lunch") {
      setStartTime(Date.now());
      setStatus("working");
    }
  };

  // Expose pause/resume functions to parent
  useEffect(() => {
    (window as any).pauseTimer = pauseTimer;
    (window as any).resumeTimer = resumeTimer;
    return () => {
      delete (window as any).pauseTimer;
      delete (window as any).resumeTimer;
    };
  }, [status, elapsedTime]);

  const hoursWorked = elapsedTime / 3600;
  const isInOvertime = hoursWorked > maxHoursBeforeOvertime;
  const payInfo = calculatePay(elapsedTime);

  return (
    <>
      <Card className="w-full sm:w-auto transition-all duration-300 hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex gap-2 w-full sm:w-auto">
              {status === "idle" ? (
                <Button 
                  onClick={() => setClockInConfirmOpen(true)}
                  className="w-full sm:w-auto bg-[#005cb3] hover:bg-[#005cb3]/90 h-10 px-4"
                >
                  <Play className="mr-2 h-4 w-4" /> Clock In
                </Button>
              ) : (
                <Button 
                  onClick={() => setClockOutConfirmOpen(true)}
                  variant="outline"
                  className="w-full sm:w-auto h-10 px-4"
                >
                  <Square className="mr-2 h-4 w-4" /> Clock Out
                </Button>
              )}
            </div>
            
            <div className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium flex items-center whitespace-nowrap",
              status === "idle" ? "bg-muted text-muted-foreground" :
              status === "lunch" ? "bg-[#f7b97f]/20 text-[#f7b97f] dark:bg-[#f7b97f]/30 dark:text-[#f7b97f]" :
              status === "overtime_pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
              isInOvertime ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
              "bg-[#005cb3]/10 text-[#005cb3] dark:bg-[#005cb3]/30 dark:text-[#005cb3]"
            )}>
              {status === "idle" ? "Not Clocked In" : 
               status === "lunch" ? "On Lunch Break" : 
               status === "overtime_pending" ? "Overtime Pending" :
               isInOvertime ? "In Overtime" :
               "Currently Working"}
              {(status !== "idle" || elapsedTime > 0) && (
                <span className="ml-2 font-mono text-sm">{formatTime(elapsedTime)}</span>
              )}
            </div>
            
            {(status !== "idle" || elapsedTime > 0) && (
              <div className="text-xs text-muted-foreground">
                <div>Pay: ${payInfo.totalPay.toFixed(2)}</div>
                {isInOvertime && (
                  <div className="text-amber-600 dark:text-amber-400">
                    OT: ${payInfo.overtimePay.toFixed(2)}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lunch Break Button (separate card for better UX) */}
      {status !== "idle" && (
        <Card className="w-full sm:w-auto">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {status !== "lunch" ? (
                <Button 
                  onClick={() => setLunchStartConfirmOpen(true)}
                  disabled={status === "idle"}
                  className="w-full sm:w-auto bg-[#f7b97f] hover:bg-[#f7b97f]/90 text-black disabled:opacity-50 disabled:cursor-not-allowed h-10 px-4"
                >
                  <Coffee className="mr-2 h-4 w-4" /> Start Lunch Break
                </Button>
              ) : (
                <Button 
                  onClick={() => setLunchEndConfirmOpen(true)}
                  className="w-full sm:w-auto bg-[#005cb3] hover:bg-[#005cb3]/90 h-10 px-4"
                >
                  <Check className="mr-2 h-4 w-4" /> End Lunch Break
                </Button>
              )}
              <div className={`
                rounded-full px-4 py-1.5 text-sm font-medium
                ${status === "lunch" 
                  ? "bg-[#f7b97f]/20 text-[#f7b97f] dark:bg-[#f7b97f]/30 dark:text-[#f7b97f]"
                  : "bg-muted text-muted-foreground"
                }
              `}>
                {status === "lunch" ? "On Lunch Break" : "Not on Break"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clock In Confirmation Dialog */}
      <Dialog open={clockInConfirmOpen} onOpenChange={setClockInConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Clock In</DialogTitle>
            <DialogDescription>
              Are you sure you want to clock in and start tracking your work time?
              {elapsedTime > 0 && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-sm">
                  You have {formatTime(elapsedTime)} of work time from earlier today that will continue.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockInConfirmOpen(false)}>Cancel</Button>
            <Button 
              onClick={confirmClockIn}
              className="bg-[#005cb3] hover:bg-[#005cb3]/90"
            >
              <Play className="mr-2 h-4 w-4" />
              Clock In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clock Out Confirmation Dialog */}
      <Dialog open={clockOutConfirmOpen} onOpenChange={setClockOutConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Clock Out</DialogTitle>
            <DialogDescription>
              Are you sure you want to clock out? Your work session will end.
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                <div className="text-sm space-y-1">
                  <div><strong>Total time worked:</strong> {formatTime(elapsedTime)}</div>
                  <div><strong>Total pay:</strong> ${payInfo.totalPay.toFixed(2)}</div>
                  {payInfo.overtimeHours > 0 && (
                    <div className="text-amber-600 dark:text-amber-400">
                      <strong>Overtime pay:</strong> ${payInfo.overtimePay.toFixed(2)} ({payInfo.overtimeHours.toFixed(1)} hours)
                    </div>
                  )}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClockOutConfirmOpen(false)}>Cancel</Button>
            <Button 
              onClick={confirmClockOut}
              className="bg-red-600 hover:bg-red-700"
            >
              <Square className="mr-2 h-4 w-4" />
              Clock Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Lunch Confirmation Dialog */}
      <Dialog open={lunchStartConfirmOpen} onOpenChange={setLunchStartConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Lunch Break</DialogTitle>
            <DialogDescription>
              Are you sure you want to start your lunch break? Your work timer will be paused.
              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-sm">
                Current work time: {formatTime(elapsedTime)}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLunchStartConfirmOpen(false)}>Cancel</Button>
            <Button 
              onClick={confirmStartLunch}
              className="bg-[#f7b97f] hover:bg-[#f7b97f]/90 text-black"
            >
              <Coffee className="mr-2 h-4 w-4" />
              Start Lunch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Lunch Confirmation Dialog */}
      <Dialog open={lunchEndConfirmOpen} onOpenChange={setLunchEndConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Lunch Break</DialogTitle>
            <DialogDescription>
              Are you sure you want to end your lunch break and resume work? Your timer will continue from where it was paused.
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/20 rounded text-sm">
                Work time when paused: {formatTime(elapsedTime)}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLunchEndConfirmOpen(false)}>Cancel</Button>
            <Button 
              onClick={confirmEndLunch}
              className="bg-[#005cb3] hover:bg-[#005cb3]/90"
            >
              <Check className="mr-2 h-4 w-4" />
              End Lunch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={overtimeDialogOpen} onOpenChange={setOvertimeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Overtime Notification</DialogTitle>
            <DialogDescription>
              You've worked {hoursWorked.toFixed(1)} hours today.
              {isInOvertime && (
                <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-sm">
                  You've worked {payInfo.overtimeHours.toFixed(1)} hours of overtime.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOvertimeDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => handleOvertimeRequest("Overtime request")}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Request Overtime
            </Button>
            <Button 
              onClick={handleForceClockOut}
              className="bg-red-600 hover:bg-red-700"
            >
              <Clock className="mr-2 h-4 w-4" />
              Clock Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}