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
  const { user } = useUser();
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
  const [showOvertimeDialog, setShowOvertimeDialog] = useState(false);
  const [showDailySummaryDialog, setShowDailySummaryDialog] = useState(false);
  const [isUpdatingLogs, setIsUpdatingLogs] = useState(false);
  const [logsToday, setLogsToday] = useState<any[]>([]);
  const [currentBonuses, setCurrentBonuses] = useState(0);
  const [unreviewedPolicies, setUnreviewedPolicies] = useState(0);

  const { toast } = useToast();

  const [activeLogId, setActiveLogId] = useState<string | null>(null);

  // NEW: Store base time in a ref
  const baseTimeRef = useRef(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update baseTimeRef whenever logsToday changes
  useEffect(() => {
    const baseTime = logsToday
      .filter(log => log.clock_in && log.clock_out)
      .reduce((total, log) => {
        return total + (new Date(log.clock_out).getTime() - new Date(log.clock_in).getTime()) / 1000;
      }, 0);
    baseTimeRef.current = baseTime;
  }, [logsToday]);

  // ENHANCED: More responsive timer with immediate updates and better overtime handling
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if ((status === "working" || status === "overtime_pending") && startTime) {
      // Function to update timer
      const updateTimer = () => {
        const now = Date.now();
        const currentSessionTime = (now - startTime) / 1000;
        const totalElapsed = Math.floor(baseTimeRef.current + currentSessionTime);
        
        setElapsedTime(totalElapsed);
        
        // Notify parent component immediately
        onTimeUpdate?.(totalElapsed, status);
        
        // Overtime check with better logic
        const hoursWorked = totalElapsed / 3600;
        if (hoursWorked > maxHoursBeforeOvertime && !overtimeNotificationShown && status !== 'overtime_pending') {
          setOvertimeNotificationShown(true);
          setOvertimeDialogOpen(true);
          setStatus("overtime_pending");
        }
      };
      
      // Update immediately when timer starts
      updateTimer();
      
      // Then update every second
      interval = setInterval(updateTimer, 1000);
    } else if (status === "lunch") {
      // When on lunch, keep the elapsed time static but still notify parent
      onTimeUpdate?.(elapsedTime, status);
    } else if (status === "idle") {
      // When idle, report the final elapsed time
      onTimeUpdate?.(elapsedTime, status);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [status, startTime, onTimeUpdate, maxHoursBeforeOvertime, overtimeNotificationShown]);

  // ENHANCED: Ensure parent always gets updated when elapsedTime changes
  useEffect(() => {
    onTimeUpdate?.(elapsedTime, status);
  }, [elapsedTime, status, onTimeUpdate]);

  // Get current date in user's timezone
  const getCurrentDate = () => {
    const now = new Date();
    // Convert to user's detected timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localDate = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // YYYY-MM-DD format in user's timezone
  };

  // Add this function to calculate total time worked today
  const calculateTotalTimeWorked = (logs: any[]) => {
    let total = 0;
    logs.forEach(log => {
      if (log.clock_in && log.clock_out) {
        total += (new Date(log.clock_out).getTime() - new Date(log.clock_in).getTime()) / 1000;
      } else if (log.clock_in && !log.clock_out) {
        total += (Date.now() - new Date(log.clock_in).getTime()) / 1000;
      }
    });
    return Math.floor(total);
  };

  // Update fetchAndSumLogs to store logs
  const fetchAndSumLogs = async () => {
    if (!user?.id) return;
    
    setIsUpdatingLogs(true);
    try {
      const today = getCurrentDate(); // Use timezone-aware date
      const logs = await getTimeLogsForDay(user.id, today);
      setLogsToday(logs);
      
      let total = calculateTotalTimeWorked(logs);
      let openLogId: string | null = null;
      
      // Find any open log (clocked in but not out)
      const openLog = logs.find(log => log.clock_in && !log.clock_out);
      if (openLog) {
        openLogId = openLog.id;
        setStartTime(new Date(openLog.clock_in).getTime());
        setStatus("working");
      }
      
      setElapsedTime(total);
      setActiveLogId(openLogId);
    } finally {
      setIsUpdatingLogs(false);
    }
  };

  // Load current bonuses from different sources
  const loadCurrentBonuses = async () => {
    if (!user?.id) return;
    
    try {
      const [policySales, clientReviews] = await Promise.all([
        getPolicySales(user.id),
        getClientReviews(user.id)
      ]);
      
      // Calculate different types of bonuses separately
      let brokerFeeBonuses = 0;
      let crossSellingBonuses = 0; 
      let lifeInsuranceBonuses = 0;
      let highValuePolicyBonuses = 0;
      
      // Process policy sales for bonuses
      policySales.forEach(sale => {
        // Broker fee bonus: 10% of (broker fee - 100)
        if (sale.broker_fee > 100) {
          const baseBrokerBonus = (sale.broker_fee - 100) * 0.1;
          brokerFeeBonuses += baseBrokerBonus;
          
          // Cross-selling bonus: double the broker fee bonus
          if (sale.cross_sold) {
            crossSellingBonuses += baseBrokerBonus; // Additional amount for cross-selling
          }
        }
        
        // Life insurance bonus: $10 for life insurance policies
        if (sale.policy_type.toLowerCase().includes('life') || 
            (sale.cross_sold_type && sale.cross_sold_type.toLowerCase().includes('life'))) {
          lifeInsuranceBonuses += 10.00;
        }
        
        // High-value policy admin bonuses
        const adminBonus = (sale as any).admin_bonus || 0;
        if (adminBonus > 0) {
          highValuePolicyBonuses += adminBonus;
        }
      });
      
      // Review bonuses: $10 for each 5-star review
      const reviewBonuses = clientReviews.filter(review => review.rating === 5).length * 10;
      
      // Set total bonuses for pay calculation
      const totalBonuses = brokerFeeBonuses + crossSellingBonuses + lifeInsuranceBonuses + reviewBonuses + highValuePolicyBonuses;
      setCurrentBonuses(totalBonuses);
      
    } catch (error) {
      console.error('Error loading bonuses:', error);
    }
  };

  // Check for unreviewed high-value policies
  const checkUnreviewedPolicies = async () => {
    if (!user?.id) return;
    
    try {
      const notifications = await getHighValuePolicyNotificationsList();
      const userUnreviewed = notifications.filter(n => 
        n.employee_id === user.id && 
        (n.status === 'pending' || n.status === 'reviewed')
      );
      setUnreviewedPolicies(userUnreviewed.length);
    } catch (error) {
      console.error('Error checking unreviewed policies:', error);
    }
  };

  const performClockOut = async () => {
    if (!activeLogId) return;
    
    try {
      const clockOutTime = new Date();
      console.log('🚪 Clock out - elapsed time before update:', elapsedTime);
      
      const updatedLog = await updateTimeLog({ 
        logId: activeLogId, 
        clockOut: clockOutTime 
      });
      
      if (!updatedLog) {
        throw new Error('Failed to update time log');
      }
      
      console.log('✅ Time log updated successfully');
      
      // Add a small delay to ensure the database update completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Immediately fetch updated logs to get accurate total time
      await fetchAndSumLogs();
      
      console.log('📊 Clock out - elapsed time after fetch:', elapsedTime);
      
      setStatus("idle");
      setActiveLogId(null);
      onClockInChange?.(false);
      onLunchChange?.(false);
      setClockOutConfirmOpen(false);
      
      // Notify parent to refresh weekly data
      console.log('📡 Notifying parent of time update:', elapsedTime, "idle");
      onTimeUpdate?.(elapsedTime, "idle");
      
      toast({
        title: "Clocked Out",
        description: `You clocked out at ${clockOutTime.toLocaleTimeString()} after ${formatTime(elapsedTime)} total today`
      });
      
      console.log('💰 Clock out - calling onClockOut with hours:', elapsedTime / 3600);
      onClockOut?.(elapsedTime / 3600);
    } catch (error) {
      console.error('❌ Error clocking out:', error);
      toast({
        title: "Error",
        description: "Failed to clock out. Please try again.",
        variant: "destructive"
      });
    }
  };

  const confirmClockIn = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to clock in.",
        variant: "destructive"
      });
      return;
    }
    
    // Debug: Log the user ID being sent
    console.log('Attempting to clock in with user ID:', user.id);
    console.log('User email:', user.emailAddresses[0]?.emailAddress);
    
    try {
      const now = new Date();
      
      // Create new time log in database
      const { data: timeLog, error } = await createTimeLog({ 
        employeeId: user.id, 
        clockIn: now 
      });
      
      if (error) {
        console.error('Failed to create time log:', error);
        console.error('User ID sent:', user.id);
        toast({
          title: "Error: Clock-in Failed",
          description: `Database error: ${error.message}. User ID: ${user.id}. Please contact support.`,
          variant: "destructive"
        });
        return;
      }
      
      // Update local state
      setStatus("working");
      setStartTime(now.getTime());
      setOvertimeNotificationShown(false);
      
      if (timeLog) {
        setActiveLogId(timeLog.id);
      }
      
      // Fetch all of today's logs to get the total time
      await fetchAndSumLogs();
      
      // Update parent component
      onClockInChange?.(true);
      
      // Notify parent to refresh weekly data
      onTimeUpdate?.(elapsedTime, "working");
      
      // Close dialog
      setClockInConfirmOpen(false);
      
      toast({
        title: "Clocked In",
        description: `You clocked in at ${now.toLocaleTimeString()}${elapsedTime > 0 ? ` (continuing from ${formatTime(elapsedTime)})` : ''}`,
      });
    } catch (error) {
      console.error('Error clocking in:', error);
      toast({
        title: "Error",
        description: "Failed to clock in. Please try again.",
        variant: "destructive"
      });
    }
  };

  const isWorkingStatus = (s: TimeStatus): s is "working" | "overtime_pending" => {
    return s === "working" || s === "overtime_pending";
  };

  // Add useEffect to load initial state on mount
  useEffect(() => {
    if (user?.id) {
      fetchAndSumLogs();
      loadCurrentBonuses(); // Load bonuses on mount
      checkUnreviewedPolicies(); // Load unreviewed policies on mount
    }
  }, [user?.id]);

  // Add event listener for policy sales updates
  useEffect(() => {
    const handlePolicySaleUpdate = () => {
      loadCurrentBonuses(); // Reload bonuses when policy sales are updated
      checkUnreviewedPolicies(); // Check for unreviewed policies
    };

    const cleanupFunctions = [
      dashboardEvents.on('policy_sale', handlePolicySaleUpdate),
      dashboardEvents.on('high_value_policy_updated', handlePolicySaleUpdate)
    ];
    
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, []);

  // Load time session from localStorage on component mount
  useEffect(() => {
    const loadTimeSession = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const session: TimeSession = JSON.parse(stored);
          const currentDate = getCurrentDate(); // Use timezone-aware date
          
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

  // ENHANCED: More accurate time formatting
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ENHANCED: More accurate pay calculation with bonus breakdown
  const calculatePay = (seconds: number) => {
    const hours = seconds / 3600;
    const regularHours = Math.min(hours, maxHoursBeforeOvertime);
    const overtimeHours = Math.max(0, hours - maxHoursBeforeOvertime);
    
    const regularPay = regularHours * hourlyRate;
    const overtimePay = overtimeHours * hourlyRate * 1.0; // 1x rate for overtime
    const basePay = regularPay + overtimePay;
    
    return {
      regularPay: Math.round(regularPay * 100) / 100,
      overtimePay: Math.round(overtimePay * 100) / 100,
      totalPay: Math.round((basePay + currentBonuses) * 100) / 100, // Include bonuses
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      bonuses: Math.round(currentBonuses * 100) / 100,
      basePay: Math.round(basePay * 100) / 100 // Hours × rate only
    };
  };

  const confirmClockOut = () => {
    performClockOut();
    setClockOutConfirmOpen(false);
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

  const getStatusDisplay = () => {
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
  };

  const getStatusClass = () => {
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
  };

  return (
    <>
      <Card className="w-full sm:w-auto transition-all duration-300 hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex gap-2 w-full sm:w-auto">
              {status === "idle" ? (
                <Button 
                  onClick={() => setClockInConfirmOpen(true)}
                  className="w-full sm:w-auto bg-[#005cb3] hover:bg-[#005cb3]/90"
                >
                  <Play className="mr-2 h-4 w-4" /> Clock In
                </Button>
              ) : (
                <Button 
                  onClick={() => setClockOutConfirmOpen(true)}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Square className="mr-2 h-4 w-4" /> Clock Out
                </Button>
              )}
            </div>
            
            <div className={cn(
              "px-3 py-1 rounded-full text-sm font-medium flex items-center whitespace-nowrap",
              getStatusClass()
            )}>
              {getStatusDisplay()}
              {(status !== "idle" || elapsedTime > 0) && (
                <span className="ml-2 font-mono">{formatTime(elapsedTime)}</span>
              )}
            </div>
            
            {(status !== "idle" || elapsedTime > 0) && (
              <div className="text-sm font-medium text-muted-foreground">
                Pay: ${payInfo.basePay.toFixed(2)}
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
                  className="w-full sm:w-auto bg-[#f7b97f] hover:bg-[#f7b97f]/90 text-black h-10 px-4"
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
      <AlertDialog open={clockInConfirmOpen} onOpenChange={setClockInConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Clock In</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Are you sure you want to clock in and start tracking your work time?
                {elapsedTime > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-sm">
                    You have {formatTime(elapsedTime)} of work time from earlier today that will continue.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmClockIn}
              className="bg-[#005cb3] hover:bg-[#005cb3]/90"
            >
              <Play className="mr-2 h-4 w-4" />
              Clock In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clock Out Confirmation Dialog */}
      <AlertDialog open={clockOutConfirmOpen} onOpenChange={setClockOutConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Clock Out</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Are you sure you want to clock out? Your work session will end.
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <div className="text-sm space-y-1">
                    <div><strong>Total time worked:</strong> {formatTime(elapsedTime)}</div>
                    <div><strong>Hours pay:</strong> ${payInfo.basePay.toFixed(2)} ({formatTime(elapsedTime)} @ ${hourlyRate}/hr)</div>
                    {payInfo.bonuses > 0 && (
                      <div className="text-green-600 dark:text-green-400">
                        <strong>Bonuses:</strong> ${payInfo.bonuses.toFixed(2)}
                      </div>
                    )}
                    <div><strong>Total pay:</strong> ${payInfo.totalPay.toFixed(2)}</div>
                    {payInfo.overtimeHours > 0 && (
                      <div className="text-amber-600 dark:text-amber-400">
                        <strong>Overtime:</strong> ${payInfo.overtimePay.toFixed(2)} ({payInfo.overtimeHours.toFixed(1)}h)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmClockOut}
              className="bg-red-600 hover:bg-red-700"
            >
              <Square className="mr-2 h-4 w-4" />
              Clock Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Start Lunch Confirmation Dialog */}
      <AlertDialog open={lunchStartConfirmOpen} onOpenChange={setLunchStartConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Lunch Break</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Are you sure you want to start your lunch break? Your work timer will be paused.
                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-sm">
                  Current work time: {formatTime(elapsedTime)}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmStartLunch}
              className="bg-[#f7b97f] hover:bg-[#f7b97f]/90 text-black"
            >
              <Coffee className="mr-2 h-4 w-4" />
              Start Lunch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* End Lunch Confirmation Dialog */}
      <AlertDialog open={lunchEndConfirmOpen} onOpenChange={setLunchEndConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Lunch Break</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Are you sure you want to end your lunch break and resume work? Your timer will continue from where it was paused.
                <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/20 rounded text-sm">
                  Work time when paused: {formatTime(elapsedTime)}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmEndLunch}
              className="bg-[#005cb3] hover:bg-[#005cb3]/90"
            >
              <Check className="mr-2 h-4 w-4" />
              End Lunch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={overtimeDialogOpen} onOpenChange={setOvertimeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overtime Notification</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                You&apos;ve worked {hoursWorked.toFixed(1)} hours today.
                {isInOvertime && (
                  <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-sm">
                    You&apos;ve worked {payInfo.overtimeHours.toFixed(1)} hours of overtime.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleOvertimeRequest("Overtime request")}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Request Overtime
            </AlertDialogAction>
            <AlertDialogAction 
              onClick={handleForceClockOut}
              className="bg-red-600 hover:bg-red-700"
            >
              <Clock className="mr-2 h-4 w-4" />
              Clock Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Memoize the component to prevent unnecessary re-mounts
export default memo(TimeTracker);