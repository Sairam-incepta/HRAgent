import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Square, Coffee, Check, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getTimeLogsForDay, createTimeLog, updateTimeLog, startBreak, endBreak, getTotalBreakTimeToday } from '@/lib/util/time-logs';
import { getTodayHours } from '@/lib/util/get';
import { getLocalDateString } from '@/lib/util/timezone';
import { useToast } from '@/hooks/use-toast';
import { dashboardEvents } from '@/lib/events';

type TimeStatus = "idle" | "working" | "on-break";

interface TimeTrackerProps {
  onTimeUpdate?: (elapsedSeconds: number, status: TimeStatus) => void;
  onClockOut?: (hoursWorked: number) => void;
  maxHoursBeforeOvertime?: number;
  employeeId: string;
}

type DialogType = 'clockIn' | 'clockOut' | 'breakStart' | 'breakEnd';

const TimeTracker = ({ 
  onTimeUpdate, 
  onClockOut, 
  maxHoursBeforeOvertime = 8,
  employeeId 
}: TimeTrackerProps) => {
  const { toast } = useToast();
  
  // Simple database-first state with real-time updates
  const [status, setStatus] = useState<TimeStatus>('idle');
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [completedWorkSeconds, setCompletedWorkSeconds] = useState<number>(0);
  const [currentSessionStart, setCurrentSessionStart] = useState<number | null>(null);
  const [completedBreakSeconds, setCompletedBreakSeconds] = useState<number>(0);
  const [currentBreakStart, setCurrentBreakStart] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now()); // Force re-renders
  
  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [activeDialog, setActiveDialog] = useState<DialogType | null>(null);

  // Format seconds to H:MM:SS
  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get total break time (completed + current break)
  const getTotalBreakSeconds = useCallback((): number => {
    let total = completedBreakSeconds;
    if (status === 'on-break' && currentBreakStart) {
      const currentBreakTime = Math.floor((currentTime - currentBreakStart) / 1000);
      total += currentBreakTime;
    }
    return total;
  }, [completedBreakSeconds, status, currentBreakStart, currentTime]);

  // Get total work time (completed + current session)
  const getTotalWorkSeconds = useCallback((): number => {
    let total = completedWorkSeconds;
    if (status === 'working' && currentSessionStart) {
      const currentSessionTime = Math.floor((currentTime - currentSessionStart) / 1000);
      total += currentSessionTime;
    }
    return total;
  }, [completedWorkSeconds, status, currentSessionStart, currentTime]);

  // Load current status and times from database
  const loadFromDatabase = async (): Promise<void> => {
    try {
      const today = getLocalDateString();
      const logs = await getTimeLogsForDay(employeeId, today);
      
      // Calculate completed work (only finished sessions)
      let completedSeconds = 0;
      logs.forEach((log: any) => {
        if (log.clock_in && log.clock_out) {
          const clockInTime = new Date(log.clock_in).getTime();
          const clockOutTime = new Date(log.clock_out).getTime();
          let workTime = (clockOutTime - clockInTime) / 1000;
          
          // Subtract break time if exists within this session
          if (log.break_start && log.break_end) {
            const breakStart = new Date(log.break_start).getTime();
            const breakEnd = new Date(log.break_end).getTime();
            
            // Only subtract if break is within work session
            if (breakStart >= clockInTime && breakEnd <= clockOutTime) {
              const breakTime = (breakEnd - breakStart) / 1000;
              workTime -= breakTime;
            }
          }
          
          completedSeconds += Math.max(0, workTime);
        }
      });
      
      setCompletedWorkSeconds(Math.floor(completedSeconds));
      
      // Calculate completed break time (only finished breaks)
      let completedBreakSecs = 0;
      logs.forEach((log: any) => {
        if (log.break_start && log.break_end) {
          const breakTime = (new Date(log.break_end).getTime() - new Date(log.break_start).getTime()) / 1000;
          completedBreakSecs += breakTime;
        }
      });
      
      setCompletedBreakSeconds(Math.floor(completedBreakSecs));
      
      // Determine status and current session start
      const activeBreakLog = logs.find((log: any) => log.break_start && !log.break_end);
      const activeWorkLog = logs.find((log: any) => log.clock_in && !log.clock_out);
      
      if (activeBreakLog) {
        setStatus('on-break');
        setActiveLogId(activeBreakLog.id);
        setCurrentSessionStart(null);
        setCurrentBreakStart(new Date(activeBreakLog.break_start).getTime());
      } else if (activeWorkLog) {
        setStatus('working');
        setActiveLogId(activeWorkLog.id);
        setCurrentSessionStart(new Date(activeWorkLog.clock_in).getTime());
        setCurrentBreakStart(null);
      } else {
        setStatus('idle');
        setActiveLogId(null);
        setCurrentSessionStart(null);
        setCurrentBreakStart(null);
      }
      
    } catch (error) {
      console.error('Error loading from database:', error);
    }
  };

  // Action handlers with validation
  const handleClockIn = async (): Promise<void> => {
    if (status !== 'idle') {
      toast({
        title: "Already Clocked In",
        description: `You are currently ${status === 'working' ? 'working' : 'on break'}`,
        variant: "destructive",
      });
      return;
    }
    
    setActiveDialog(null);
    
    try {
      const now = new Date();
      const { data, error } = await createTimeLog({ 
        employeeId, 
        clockIn: now 
      });
      
      if (error || !data) throw new Error(error?.message || "Failed to clock in");
      
      dashboardEvents.emit('time_logged');
      
      toast({
        title: "Clocked In",
        description: `Work timer started at ${now.toLocaleTimeString()}`,
        className: "bg-green-100 text-green-800",
      });
      
      // Refresh from database
      await loadFromDatabase();
      
    } catch (error) {
      console.error('Clock in failed:', error);
      toast({
        title: "Clock In Failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStartBreak = async (): Promise<void> => {
    if (status !== 'working' || !activeLogId) {
      toast({
        title: "Cannot Start Break",
        description: `You must be working to start a break. Current status: ${status}`,
        variant: "destructive",
      });
      return;
    }
    
    setActiveDialog(null);
    
    try {
      const now = new Date();
      
      await updateTimeLog({ logId: activeLogId, clockOut: now });
      await startBreak(activeLogId);
      
      dashboardEvents.emit('time_logged');
      
      toast({
        title: "Break Started",
        description: "Work timer paused for break",
      });
      
      // Refresh from database
      await loadFromDatabase();
      
    } catch (error) {
      console.error('Start break failed:', error);
      toast({
        title: "Failed to Start Break",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEndBreak = async (): Promise<void> => {
    if (status !== 'on-break' || !activeLogId) {
      toast({
        title: "Cannot End Break",
        description: `You are not currently on break. Current status: ${status}`,
        variant: "destructive",
      });
      return;
    }
    
    setActiveDialog(null);
    
    try {
      const now = new Date();
      
      await endBreak(activeLogId);
      await createTimeLog({ employeeId, clockIn: now });
      
      dashboardEvents.emit('time_logged');
      
      toast({
        title: "Break Ended",
        description: "Work timer resumed",
      });
      
      // Refresh from database
      await loadFromDatabase();
      
    } catch (error) {
      console.error('End break failed:', error);
      toast({
        title: "Failed to End Break",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClockOut = async (): Promise<void> => {
    if (status === 'idle' || !activeLogId) {
      toast({
        title: "Cannot Clock Out",
        description: "You are not currently clocked in",
        variant: "destructive",
      });
      return;
    }
    
    setActiveDialog(null);
    
    try {
      const now = new Date();
      
      if (status === 'on-break') {
        await endBreak(activeLogId);
      } else {
        await updateTimeLog({ logId: activeLogId, clockOut: now });
      }
      
      const finalHours = getTotalWorkSeconds() / 3600;
      onClockOut?.(finalHours);
      dashboardEvents.emit('time_logged');
      
      toast({
        title: "Clocked Out",
        description: `You worked ${formatTime(getTotalWorkSeconds())} today`,
        className: "bg-green-100 text-green-800",
      });
      
      // Refresh from database
      await loadFromDatabase();
      
    } catch (error) {
      console.error('Clock out failed:', error);
      toast({
        title: "Clock Out Failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Get status display info
  const getStatusInfo = (): { text: string; color: string } => {
    const totalWorkSeconds = getTotalWorkSeconds();
    const isOvertime = totalWorkSeconds / 3600 >= maxHoursBeforeOvertime;
    
    switch (status) {
      case 'working':
        return {
          text: isOvertime ? 'In Overtime' : 'Currently Working',
          color: isOvertime ? 'bg-red-100 text-red-800' : 'bg-[#005cb3]/10 text-[#005cb3]'
        };
      case 'on-break':
        return {
          text: 'On Break',
          color: 'bg-[#f7b97f]/20 text-[#f7b97f]'
        };
      default:
        return {
          text: 'Not Clocked In',
          color: 'bg-muted text-muted-foreground'
        };
    }
  };

  // Initialize component
  useEffect(() => {
    if (employeeId) {
      loadFromDatabase().finally(() => setLoading(false));
    }
  }, [employeeId]);

  // Update current time every second to force re-renders
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
      // Update parent component
      const totalWork = getTotalWorkSeconds();
      onTimeUpdate?.(totalWork, status);
    }, 1000);
    return () => clearInterval(timer);
  }, [getTotalWorkSeconds, onTimeUpdate, status]);

  if (loading) {
    return <div>Loading time tracker...</div>;
  }

  const statusInfo = getStatusInfo();

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Hero Timer Section */}
        <Card className="relative overflow-hidden border bg-card lg:col-span-3">
          <CardContent className="relative p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
              {/* Main Timer Display */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6">
                  <div className="space-y-2">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs lg:text-sm font-medium ${statusInfo.color} border`}>
                      {status === 'working' && <div className="w-2 h-2 bg-[#005cb3] rounded-full animate-pulse" />}
                      {status === 'on-break' && <Coffee className="h-3 w-3 lg:h-4 lg:w-4" />}
                      {status === 'idle' && <Clock className="h-3 w-3 lg:h-4 lg:w-4" />}
                      {statusInfo.text}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-2xl sm:text-3xl lg:text-4xl font-mono font-bold tracking-wider text-foreground">
                        {formatTime(getTotalWorkSeconds())}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total work time today
                      </div>
                    </div>
                  </div>

                  {/* Break Timer (if has break time) */}
                  {getTotalBreakSeconds() > 0 && (
                    <>
                      <div className="hidden sm:block h-12 lg:h-16 w-px bg-border opacity-50" />
                      <div className="space-y-2 sm:pl-0 pl-4 border-l sm:border-l-0 border-border sm:border-opacity-0">
                        <div className="flex items-center gap-2">
                          <Coffee className="h-3 w-3 lg:h-4 lg:w-4 text-[#f7b97f]" />
                          <span className="text-xs lg:text-sm text-muted-foreground">
                            Total Breaks
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className={`text-lg sm:text-xl lg:text-2xl font-mono font-bold ${
                            status === 'on-break' ? 'text-[#f7b97f]' : 'text-muted-foreground'
                          }`}>
                            {formatTime(getTotalBreakSeconds())}
                          </div>
                          {status === 'on-break' && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <div className="w-1 h-1 bg-[#f7b97f] rounded-full animate-pulse" />
                              Currently on break
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 lg:gap-3 lg:flex-shrink-0">
                {/* Secondary Action */}
                {status === 'working' && (
                  <Button
                    onClick={() => setActiveDialog('breakStart')}
                    disabled={loading}
                    className="bg-[#f7b97f] hover:bg-[#e6a366] text-black px-4 lg:px-6 py-2 text-sm lg:text-base"
                  >
                    <Coffee className="mr-2 h-4 w-4" /> 
                    Take Break
                  </Button>
                )}
                
                {status === 'on-break' && (
                  <Button
                    onClick={() => setActiveDialog('breakEnd')}
                    disabled={loading}
                    className="bg-[#005cb3] hover:bg-[#004a96] text-white px-4 lg:px-6 py-2 text-sm lg:text-base"
                  >
                    <Check className="mr-2 h-4 w-4" /> 
                    End Break
                  </Button>
                )}

                {/* Primary Action */}
                {status === 'idle' ? (
                  <Button
                    onClick={() => setActiveDialog('clockIn')}
                    disabled={loading}
                    className="bg-[#005cb3] hover:bg-[#004a96] text-white px-6 lg:px-8 py-2.5 lg:py-3 text-sm lg:text-base font-medium"
                  >
                    <Play className="mr-2 h-4 w-4 lg:h-5 lg:w-5" /> 
                    Clock In
                  </Button>
                ) : (
                  <Button
                    onClick={() => setActiveDialog('clockOut')}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 lg:px-8 py-2.5 lg:py-3 text-sm lg:text-base font-medium"
                  >
                    <Square className="mr-2 h-4 w-4 lg:h-5 lg:w-5" /> 
                    End Work Day
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PST Time Widget */}
        <Card className="bg-card lg:col-span-1">
          <CardContent className="p-4 lg:p-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Pacific Time</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <Clock className="h-4 w-4 text-[#005cb3]" />
                  <span className="font-mono font-bold text-xl lg:text-2xl text-foreground">
                    {new Date().toLocaleTimeString('en-US', {
                      timeZone: 'America/Los_Angeles',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                </div>
                <div className="text-center lg:text-left">
                  <span className="text-sm text-muted-foreground">PST/PDT</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clock In Dialog */}
      <Dialog
        open={activeDialog === 'clockIn'}
        onOpenChange={(open) => !open && !loading && setActiveDialog(null)}
      >
        <DialogContent onEscapeKeyDown={(e) => loading && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Confirm Clock In</DialogTitle>
            <DialogDescription>
              Ready to start your workday at {new Date().toLocaleTimeString()}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActiveDialog(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleClockIn} disabled={loading}>
              {loading ? "Clocking In..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clock Out Dialog */}
      <Dialog
        open={activeDialog === 'clockOut'}
        onOpenChange={(open) => !open && !loading && setActiveDialog(null)}
      >
        <DialogContent onEscapeKeyDown={(e) => loading && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Confirm Clock Out</DialogTitle>
            <DialogDescription>
              Are you sure you want to end your work session? Your total time today is {formatTime(getTotalWorkSeconds())}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActiveDialog(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleClockOut}
              disabled={loading}
            >
              {loading ? "Clocking Out..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Break Dialog */}
      <Dialog
        open={activeDialog === 'breakStart'}
        onOpenChange={(open) => !open && !loading && setActiveDialog(null)}
      >
        <DialogContent onEscapeKeyDown={(e) => loading && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Start Break</DialogTitle>
            <DialogDescription>
              This will pause your work timer. Break time does not count towards your work hours.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActiveDialog(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleStartBreak} disabled={loading}>
              {loading ? "Starting Break..." : "Start Break"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Break Dialog */}
      <Dialog
        open={activeDialog === 'breakEnd'}
        onOpenChange={(open) => !open && !loading && setActiveDialog(null)}
      >
        <DialogContent onEscapeKeyDown={(e) => loading && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>End Break</DialogTitle>
            <DialogDescription>
              Ready to get back to work? Your break time was {formatTime(getTotalBreakSeconds())}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActiveDialog(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleEndBreak} disabled={loading}>
              {loading ? "Ending Break..." : "End Break"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export { TimeTracker };