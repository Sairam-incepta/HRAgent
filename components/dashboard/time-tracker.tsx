"use client";

import { useState, useRef, useEffect, memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Coffee, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTimeLogsForDay, createTimeLog, updateTimeLog, startBreak, endBreak, getTotalBreakTimeToday } from "@/lib/util/time-logs";
import { useUser } from '@clerk/nextjs';
import { dashboardEvents } from "@/lib/events";
import { OvertimeNotificationDialog } from "./overtime-notification-dialog";

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
  tabId?: string; // Add unique tab identifier
  lastUpdate?: number; // Add timestamp for sync validation
}

const STORAGE_KEY = 'letsinsure_time_session';
const SYNC_KEY = 'letsinsure_time_sync'; // New key for real-time sync
const TAB_ID = Math.random().toString(36).substring(2, 15); // Unique tab identifier

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

  // Lunch break tracking
  const [lunchStartTime, setLunchStartTime] = useState<number | null>(null);
  const [totalLunchTime, setTotalLunchTime] = useState(0);
  const [currentLunchTime, setCurrentLunchTime] = useState(0);

  // Multi-tab sync state
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const syncInterval = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false);
  const isInitialMount = useRef(true);

  // ===== Daily lunch tracking moved to database =====
  const [totalBreakTimeToday, setTotalBreakTimeToday] = useState(0);
  const [breakLogId, setBreakLogId] = useState<string | null>(null); // Track which log is on break

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
    try {
      if (status !== 'idle' && (startTime || status === 'lunch')) {
        const sessionData: TimeSession = {
          startTime: startTime || 0, // Use 0 for lunch breaks when startTime is null
          status: status,
          date: getCurrentDate(),
          lunchStartTime: lunchStartTime || undefined,
          totalLunchTime: totalLunchTimeRef.current,
          tabId: TAB_ID,
          lastUpdate: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to save time session to localStorage:', error);
      // Component continues to work without localStorage persistence
    }
  }, [status, startTime, lunchStartTime]);

  // Broadcast state changes to other tabs (simple approach)
  const broadcastStateChange = useCallback((newState: {
    status: TimeStatus;
    elapsedTime: number;
    startTime: number | null;
    lunchStartTime: number | null;
    activeLogId: string | null;
    currentLunchTime: number;
    breakLogId?: string | null;
  }) => {
    try {
      const syncData = {
        ...newState,
        totalLunchTime: totalLunchTimeRef.current, // Include accumulated lunch time
        timestamp: Date.now(),
        tabId: TAB_ID,
      };
      localStorage.setItem(SYNC_KEY, JSON.stringify(syncData));
    } catch (error) {
      console.error('Failed to broadcast state change:', error);
    }
  }, []);

  // Refresh data from database periodically and on important events
  const refreshFromDatabase = useCallback(async () => {
    if (!user?.id) return;

    try {
      const today = getCurrentDate();
      const logs = await getTimeLogsForDay(user.id, today);
      setLogsToday(logs);

      const totalWorkedFromDB = calculateTotalTimeWorked(logs);
      const activeLog = logs.find(log => log.clock_in && !log.clock_out);
      const breakLog = logs.find(log => log.break_start && !log.break_end); // Check for active break
      
      // Check for active lunch break from localStorage before overriding state
      let isOnValidLunchBreak = false;
      let savedLunchData = null;
      try {
        const savedSessionRaw = localStorage.getItem(STORAGE_KEY);
        if (savedSessionRaw) {
          const savedSession: TimeSession = JSON.parse(savedSessionRaw);
          if (savedSession.status === 'lunch' && savedSession.lunchStartTime) {
            const lunchAge = Date.now() - savedSession.lunchStartTime;
            const maxLunchAge = 4 * 60 * 60 * 1000; // 4 hours max
            const isValidAge = lunchAge < maxLunchAge;
            const isValidDate = savedSession.date === today;
            isOnValidLunchBreak = isValidAge && isValidDate;
            savedLunchData = savedSession;
          }
        }
      } catch (error) {
        console.error('Error checking lunch break state:', error);
      }
      
      if (breakLog) {
        // Active break session exists in database
        const breakStart = new Date(breakLog.break_start).getTime();
        const now = Date.now();
        const currentBreakTime = Math.floor((now - breakStart) / 1000);
        
        setElapsedTime(totalWorkedFromDB);
        setActiveLogId(null);
        setStartTime(null);
        setBreakLogId(breakLog.id);
        setLunchStartTime(breakStart);
        setCurrentLunchTime(currentBreakTime);
        setStatus('lunch');
        onLunchChange?.(true);
        
        // Broadcast database break state to other tabs
        broadcastStateChange({
          status: 'lunch',
          elapsedTime: totalWorkedFromDB,
          startTime: null,
          lunchStartTime: breakStart,
          activeLogId: null,
          currentLunchTime: currentBreakTime,
          breakLogId: breakLog.id
        });
        
        console.log('🍽️ Active break found in database, restored break state');
        
      } else if (activeLog) {
        // Active work session exists - calculate current elapsed time
        const sessionStart = new Date(activeLog.clock_in).getTime();
        const now = Date.now();
        const currentSessionTime = (now - sessionStart) / 1000;
        const currentElapsed = Math.floor(totalWorkedFromDB + currentSessionTime);
        
        setElapsedTime(currentElapsed);
        setActiveLogId(activeLog.id);
        setStartTime(sessionStart);
        setStatus('working'); // Will be updated by timer logic if overtime
        
        // Clear any stale break state if we're now in an active work session
        if (lunchStartTime || breakLogId) {
          setLunchStartTime(null);
          setCurrentLunchTime(0);
          setBreakLogId(null);
          console.log('🔄 Cleared stale break state - now in active work session');
        }
        
      } else if (isOnValidLunchBreak && savedLunchData) {
        // No active work session but valid lunch break - restore lunch state immediately
        setElapsedTime(totalWorkedFromDB);
        setActiveLogId(null);
        setStartTime(null);
        
        // Only set lunch state if not already set (to prevent overriding initialization)
        if (status !== 'lunch') {
          setStatus('lunch');
          setLunchStartTime(savedLunchData.lunchStartTime || null);
          onLunchChange?.(true);
          
          const accumulatedLunch = savedLunchData.totalLunchTime || 0;
          setTotalLunchTime(accumulatedLunch);
          totalLunchTimeRef.current = accumulatedLunch;
          
        } else {
        }
        
      } else {
        // No active session and no lunch break - set to idle and clear break state
        setElapsedTime(totalWorkedFromDB);
        setActiveLogId(null);
        setStartTime(null);
        setStatus('idle');
        
        // Clear any stale break state
        if (lunchStartTime || breakLogId) {
          setLunchStartTime(null);
          setCurrentLunchTime(0);
          setBreakLogId(null);
          console.log('🔄 Cleared stale break state - now idle');
        }
      }
      
      baseTimeRef.current = totalWorkedFromDB;
      return { activeLog, totalWorkedFromDB, isOnValidLunchBreak };
          } catch (error) {
      console.error('Error refreshing from database:', error);
      return null;
    }
  }, [user?.id]);

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



  const loadTimeSession = useCallback(async () => {
    // With database-first approach, we only restore UI state from localStorage
    // The database refresh already set the correct data
    try {
      const savedSessionRaw = localStorage.getItem(STORAGE_KEY);
      if (!savedSessionRaw) {
        return;
      }

      const savedSession: TimeSession = JSON.parse(savedSessionRaw);
      const today = getCurrentDate();

      // Only restore lunch break state if it's recent and valid AND not already restored
      if (savedSession.status === 'lunch' && savedSession.lunchStartTime && status !== 'lunch') {
        const lunchAge = Date.now() - savedSession.lunchStartTime;
        const maxLunchAge = 4 * 60 * 60 * 1000; // 4 hours max
        
        if (lunchAge < maxLunchAge && savedSession.date === today) {
          setStatus('lunch');
          setLunchStartTime(savedSession.lunchStartTime);
          onLunchChange?.(true);

          const accumulatedLunch = savedSession.totalLunchTime || 0;
          setTotalLunchTime(accumulatedLunch);
          totalLunchTimeRef.current = accumulatedLunch;

          // Broadcast restored lunch state to other tabs
          const currentBreakTime = Math.floor((Date.now() - savedSession.lunchStartTime) / 1000);
          broadcastStateChange({
            status: 'lunch',
            elapsedTime: baseTimeRef.current || 0,
            startTime: null,
            lunchStartTime: savedSession.lunchStartTime,
            activeLogId: null,
            currentLunchTime: currentBreakTime
          });
          
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } else if (status === 'lunch') {
        
        // Broadcast the current lunch state to other tabs if we have the data
        if (savedSession.status === 'lunch' && savedSession.lunchStartTime && lunchStartTime) {
          const currentBreakTime = Math.floor((Date.now() - lunchStartTime) / 1000);
          broadcastStateChange({
            status: 'lunch',
            elapsedTime: baseTimeRef.current || 0,
            startTime: null,
            lunchStartTime: lunchStartTime,
            activeLogId: null,
            currentLunchTime: currentBreakTime
          });
        }
      } else {
        // Clear any stale session data that doesn't match database
        if (savedSession.date !== today) {
          localStorage.removeItem(STORAGE_KEY);
        } else if (savedSession.status !== 'lunch') {
        }
      }
    } catch (error) {
      console.error('Error loading session data:', error);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (clearError) {
        console.error('Failed to clear localStorage after error:', clearError);
      }
    }
  }, [onLunchChange, broadcastStateChange, status]);

  useEffect(() => {
    if (user?.id && !hasInitialized.current) {
      hasInitialized.current = true;
      
      const initializeComponent = async () => {
        try {
          setIsLoadingInitialData(true);
          console.log('🚀 Initializing time tracker...');
          
          // Check for lunch break state first and restore it immediately
          let hasLunchBreak = false;
          try {
            const savedSessionRaw = localStorage.getItem(STORAGE_KEY);
            if (savedSessionRaw) {
              const savedSession: TimeSession = JSON.parse(savedSessionRaw);
              if (savedSession.status === 'lunch' && savedSession.lunchStartTime) {
                const lunchAge = Date.now() - savedSession.lunchStartTime;
                const maxLunchAge = 4 * 60 * 60 * 1000; // 4 hours max
                hasLunchBreak = lunchAge < maxLunchAge && savedSession.date === getCurrentDate();
                
                // Immediately restore lunch state BEFORE database operations
                if (hasLunchBreak) {
                  setStatus('lunch');
                  setLunchStartTime(savedSession.lunchStartTime);
                  setStartTime(null);
                  setActiveLogId(null);
                  onLunchChange?.(true);
                  
                  const accumulatedLunch = savedSession.totalLunchTime || 0;
                  setTotalLunchTime(accumulatedLunch);
                  totalLunchTimeRef.current = accumulatedLunch;
                  
                  console.log('🍽️ Lunch state restored during initialization');
                }
              }
            }
          } catch (error) {
            console.error('Error checking lunch state during init:', error);
          }
          
          // Refresh database data
          const dbResult = await refreshFromDatabase();
          
          // Load session data and restore UI state
          await loadTimeSession();
          
          console.log('✅ Time tracker initialized');
        } catch (error) {
          console.error('Error initializing time tracker:', error);
        } finally {
          setIsLoadingInitialData(false);
          isInitialMount.current = false; // Allow saveTimeSession to work after initialization
        }
      };
      
      initializeComponent();
    }
  }, [user?.id, refreshFromDatabase, loadTimeSession, onLunchChange]);

  // Periodic database sync to ensure consistency
  useEffect(() => {
    if (!user?.id || isLoadingInitialData) return;
    
    // Sync with database every 30 seconds to catch changes from other sources
    syncInterval.current = setInterval(async () => {
      console.log('🔄 Periodic database sync...');
      await refreshFromDatabase();
    }, 30000);
    
    return () => {
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
      }
    };
  }, [user?.id, isLoadingInitialData, refreshFromDatabase, status]);

  // Simple multi-tab synchronization via localStorage events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Handle real-time state updates from other tabs
      if (e.key === SYNC_KEY) {
        try {
          if (e.newValue) {
            const syncData = JSON.parse(e.newValue);
            
            // Only sync if it's from another tab and recent
            if (syncData.tabId !== TAB_ID) {
              const now = Date.now();
              const timeDiff = now - syncData.timestamp;
              
              // Only sync if the update is recent (within 5 seconds)
              if (timeDiff < 5000) {
                setStatus(syncData.status);
                setElapsedTime(syncData.elapsedTime);
                setStartTime(syncData.startTime);
                setLunchStartTime(syncData.lunchStartTime);
                setActiveLogId(syncData.activeLogId);
                setCurrentLunchTime(syncData.currentLunchTime || 0);
                setBreakLogId(syncData.breakLogId || null);
                
                // Special handling for lunch break sync
                if (syncData.status === 'lunch' && syncData.lunchStartTime) {
                  const accumulatedLunch = syncData.totalLunchTime || totalLunchTimeRef.current;
                  setTotalLunchTime(accumulatedLunch);
                  totalLunchTimeRef.current = accumulatedLunch;
                  console.log('🍽️ Synced lunch break state from another tab');
                }
                
                // Update parent component callbacks
                const isClockedIn = syncData.status === 'working' || syncData.status === 'overtime_pending';
                const isOnLunch = syncData.status === 'lunch';
                onClockInChange?.(isClockedIn);
                onLunchChange?.(isOnLunch);
              }
            }
          }
        } catch (error) {
          console.error('Failed to sync state from another tab:', error);
        }
      }

      // Handle session data changes (for backward compatibility)
      if (e.key === STORAGE_KEY) {
        try {
          if (!e.newValue) {
            // Session cleared in another tab - refresh from database
            refreshFromDatabase();
          }
        } catch (error) {
          console.error('Failed to handle session change:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [onClockInChange, onLunchChange, user?.id, refreshFromDatabase]);

  // Load saved daily lunch seconds once on mount (per day)
  // Load total break time from database
  useEffect(() => {
    const loadTotalBreakTime = async () => {
      if (!user?.id) return;
      try {
        const today = getCurrentDate();
        const totalSeconds = await getTotalBreakTimeToday(user.id, today);
        setTotalBreakTimeToday(totalSeconds);
      } catch (error) {
        console.error('Failed to load total break time:', error);
      }
    };
    
    loadTotalBreakTime();
  }, [user?.id]);

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

        // Broadcast state to other tabs
        broadcastStateChange({
          status,
          elapsedTime: totalWorkTime,
          startTime,
          lunchStartTime,
          activeLogId,
          currentLunchTime
        });

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
        const newLunchTime = Math.floor(currentBreakDuration);
        setCurrentLunchTime(newLunchTime);
        
        // Broadcast lunch state to other tabs
        broadcastStateChange({
          status,
          elapsedTime,
          startTime,
          lunchStartTime,
          activeLogId,
          currentLunchTime: newLunchTime
        });
      };
      updateLunchTimer();
      intervalRef.current = setInterval(updateLunchTimer, 1000);
    }

        // Only save session after initialization is complete to prevent clearing lunch state
    if (!isLoadingInitialData && !isInitialMount.current) {
      saveTimeSession();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, startTime, lunchStartTime, saveTimeSession, maxHoursBeforeOvertime, overtimeNotificationShown, broadcastStateChange, elapsedTime, activeLogId, currentLunchTime, isLoadingInitialData]);

  useEffect(() => {
    onTimeUpdate?.(elapsedTime, status);
  }, [elapsedTime, status, onTimeUpdate]);

  // Save session after initialization and lunch state restoration
  useEffect(() => {
    if (!isLoadingInitialData && !isInitialMount.current && status === 'lunch' && lunchStartTime) {
      // Ensure lunch state is saved to localStorage after restoration
      saveTimeSession();
    }
  }, [isLoadingInitialData, status, lunchStartTime, saveTimeSession]);

  const resetLunchStates = () => {
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
      await refreshFromDatabase(); // Get latest database state
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

      const newStartTime = now.getTime();
      setStartTime(newStartTime);
      setStatus("working");
      setActiveLogId(newLog.id);
      onClockInChange?.(true);

      // Broadcast to other tabs immediately
      broadcastStateChange({
        status: "working",
        elapsedTime: baseTimeRef.current,
        startTime: newStartTime,
        lunchStartTime: null,
        activeLogId: newLog.id,
        currentLunchTime: 0
      });

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
    
    let logIdToUse = activeLogId;
    
    // If no activeLogId in state, try to find it from database
    if (!logIdToUse && user?.id) {
      try {
        const today = getCurrentDate();
        const logs = await getTimeLogsForDay(user.id, today);
        const activeLogs = logs.filter(log => log.clock_in && !log.clock_out);
        
        if (activeLogs.length > 0) {
          const activeLog = activeLogs.length === 1 
            ? activeLogs[0] 
            : activeLogs.reduce((latest, current) => 
                new Date(current.clock_in) > new Date(latest.clock_in) ? current : latest
              );
          logIdToUse = activeLog.id;
        }
      } catch (error) {
        console.error('Error finding active log:', error);
      }
    }
    
    if (!logIdToUse || !user?.id) {
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

      await updateTimeLog({ logId: logIdToUse, clockOut: new Date() });
      
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
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error('Failed to clear localStorage after clock out:', error);
      }
      resetLunchStates(); // Clear out lunch timers

      // Explicitly set the displayed time to the final calculated value.
      // And update the base ref for any subsequent clock-ins on the same day.
      setElapsedTime(finalElapsedTime);
      baseTimeRef.current = finalElapsedTime;
      
      // Broadcast idle state to other tabs immediately
      broadcastStateChange({
        status: "idle",
        elapsedTime: finalElapsedTime,
        startTime: null,
        lunchStartTime: null,
        activeLogId: null,
        currentLunchTime: 0
      });
      
      // Refresh logs from database
      await refreshFromDatabase();

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
    if (!(status === "working" || status === "overtime_pending")) {
      setProcessingLunch(null);
      return;
    }
    if (!activeLogId) {
      console.warn("No active log when starting lunch – attempting to recover...");
      if (!user?.id) {
        toast({
          title: "Error starting break",
          description: "User not authenticated. Please sign in again.",
          variant: "destructive",
        });
        setProcessingLunch(null);
        return;
      }
      try {
        const today = getCurrentDate();
        const logs = await getTimeLogsForDay(user.id, today);
        const activeLogs = logs.filter(log => log.clock_in && !log.clock_out);
        
        if (activeLogs.length > 0) {
          // If multiple active logs (database corruption), use most recent
          const activeLog = activeLogs.length === 1 
            ? activeLogs[0] 
            : activeLogs.reduce((latest, current) => 
                new Date(current.clock_in) > new Date(latest.clock_in) ? current : latest
              );
          
          if (activeLogs.length > 1) {
            console.warn(`Found ${activeLogs.length} active logs, using most recent:`, activeLog.id);
          }
          
          setActiveLogId(activeLog.id);
        } else {
          toast({
            title: "Error starting break",
            description: "No active clock-in session found. Please clock in first.",
            variant: "destructive",
          });
          setProcessingLunch(null);
          return;
        }
      } catch (error) {
        toast({
          title: "Error starting break",
          description: "Unable to find active session. Please try clocking out and back in.",
          variant: "destructive",
        });
        setProcessingLunch(null);
        return;
      }
    }

    try {
      // Save the current activeLogId before clearing it
      const currentLogId = activeLogId;
      if (!currentLogId) throw new Error("No active log ID");

      // Close the current work session and start break in database
      await updateTimeLog({ logId: currentLogId, clockOut: new Date() });
      await startBreak(currentLogId);

      // Freeze elapsed time at break start
      baseTimeRef.current = elapsedTime;

      // Clear work timer specifics
      setActiveLogId(null);
      setStartTime(null);

      // Track which log is on break
      setBreakLogId(currentLogId);

      // Start lunch timers
      const lunchStart = Date.now();
      setLunchStartTime(lunchStart);
      setStatus("lunch");
      onLunchChange?.(true);

      // Save to localStorage for multi-tab sync
      saveTimeSession();

      // Broadcast lunch state to other tabs immediately
      broadcastStateChange({
        status: "lunch",
        elapsedTime,
        startTime: null,
        lunchStartTime: lunchStart,
        activeLogId: currentLogId, // Keep reference for ending break
        currentLunchTime: 0,
        breakLogId: currentLogId
      });

      // Notify dashboard to refresh weekly summary
      dashboardEvents.emit('time_logged');
    } catch (err) {
      console.error("Failed to start break:", err);
      toast({
        title: "Error starting break",
        description: "We couldn't save your time log. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingLunch(null);
      setLunchStartConfirmOpen(false);
      // saveTimeSession(); // Remove this since we're using immediate save
    }
  };

  const confirmEndLunch = async () => {
    if (processingLunch) return;
    setProcessingLunch('end');
    if (!lunchStartTime || !user?.id || !breakLogId) { 
      setProcessingLunch(null); 
      return; 
    }

    const lunchDuration = (Date.now() - lunchStartTime) / 1000;

    try {
      // End the break in database first
      await endBreak(breakLogId);

      // Accumulate lunch seconds for current session
      totalLunchTimeRef.current += lunchDuration;
      setTotalLunchTime(totalLunchTimeRef.current);

      // Start a new work session after lunch
      const now = new Date();
      const userId = user.id;
      if (!userId) throw new Error("User ID is required");
      const { data, error } = await createTimeLog({ employeeId: userId, clockIn: now });

      if (error || !data) throw new Error(error?.message || "Unable to start new time log after lunch.");

      const newLog = Array.isArray(data) ? data[0] : data;
      if (!newLog) throw new Error("No time log returned after lunch.");

      const newStartTime = now.getTime();
      setActiveLogId(newLog.id);
      setStartTime(newStartTime);

      // Reset current break timers and clear break log ID
      setLunchStartTime(null);
      setCurrentLunchTime(0);
      setBreakLogId(null);

      // Resume working status (check overtime threshold)
      const hoursWorkedSoFar = baseTimeRef.current / 3600;
      const newStatus = hoursWorkedSoFar >= maxHoursBeforeOvertime ? "overtime_pending" : "working";
      setStatus(newStatus);
      onLunchChange?.(false);

      // Refresh total break time from database
      const today = getCurrentDate();
      const totalSeconds = await getTotalBreakTimeToday(userId, today);
      setTotalBreakTimeToday(totalSeconds);

      // Broadcast working state to other tabs immediately
      broadcastStateChange({
        status: newStatus,
        elapsedTime: baseTimeRef.current,
        startTime: newStartTime,
        lunchStartTime: null,
        activeLogId: newLog.id,
        currentLunchTime: 0,
        breakLogId: null
      });

      toast({
        title: "Back to Work!",
        description: `You took a ${formatTime(lunchDuration)} break. Your work timer has resumed.`,
      });

      dashboardEvents.emit('time_logged');
    } catch (err) {
      console.error("Failed to end break:", err);
      toast({
        title: "Error ending break",
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
      <Coffee className="mr-2 h-4 w-4" /> Start Break
    </Button>
  );

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
      <Check className="mr-2 h-4 w-4" /> End Break
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
          <span>Current break: {formatTime(currentLunchTime)} | Total today: {formatTime(totalBreakTimeToday + currentLunchTime)}</span>
        </>
      ) : (
        "Not on Break"
      )}
    </div>
  );
  
  const TotalLunchDisplay = () => (
    <div className="text-xs text-muted-foreground">
      Total today: {formatTime(Math.floor(totalBreakTimeToday))}
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
        return "On Break";
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
                {totalBreakTimeToday > 0 && status !== "lunch" && <TotalLunchDisplay />}
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
          <DialogHeader><DialogTitle>Start Break</DialogTitle></DialogHeader>
          <DialogDescription>This will pause your work timer. Break time does not count towards your work hours.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLunchStartConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-[#f7b97f] hover:bg-[#f7b97f]/90 text-black" onClick={confirmStartLunch}>Start Break</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={lunchEndConfirmOpen} onOpenChange={setLunchEndConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>End Break</DialogTitle></DialogHeader>
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