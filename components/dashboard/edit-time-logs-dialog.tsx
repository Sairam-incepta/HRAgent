"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Save, X, Edit3, Coffee, RotateCcw, Plus } from "lucide-react";
import { getTimeLogsForWeek, updateTimeLog } from "@/lib/util/time-logs";
import { getLocalDateString } from "@/lib/util/timezone";
import { useToast } from "@/hooks/use-toast";
import { dashboardEvents } from "@/lib/events";

interface TimeLog {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  created_at: string;
  updated_at: string;
}

interface EditTimeLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    clerk_user_id: string;
    name: string;
    email: string;
  };
}

interface EditingLog {
  id: string;
  clock_in: string;
  clock_out: string;
  break_start: string;
  break_end: string;
}

export function EditTimeLogsDialog({
  open,
  onOpenChange,
  employee,
}: EditTimeLogsDialogProps) {
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<EditingLog | null>(null);

  const [dateRange, setDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: getLocalDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    endDate: getLocalDateString(new Date())
  });

  const [filterMode, setFilterMode] = useState<'range' | 'single'>('range');
  const [singleDate, setSingleDate] = useState(getLocalDateString(new Date()));

  const { toast } = useToast();
  const editFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && employee?.clerk_user_id) {
      loadTimeLogs();
    }
  }, [open, employee?.clerk_user_id, dateRange, filterMode, singleDate]);

  // Listen for time log updates
  useEffect(() => {
    if (!open) return;

    const handleTimeLogUpdate = () => {
      loadTimeLogs();
    };

    const cleanup = dashboardEvents.on('time_logged', handleTimeLogUpdate);
    return cleanup;
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editingLog) return;

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    if (editingLog) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [editingLog]);

  const loadTimeLogs = async () => {
    if (!employee?.clerk_user_id) return;

    setLoading(true);
    try {
      let logs;
      if (filterMode === 'single') {
        // For single date, use the same date for start and end
        logs = await getTimeLogsForWeek(employee.clerk_user_id, singleDate, singleDate);
      } else {
        logs = await getTimeLogsForWeek(employee.clerk_user_id, dateRange.startDate, dateRange.endDate);
      }

      // Sort by date and clock_in in descending order (most recent first)
      const sortedLogs = logs.sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;

        const aClockIn = a.clock_in ? new Date(a.clock_in).getTime() : 0;
        const bClockIn = b.clock_in ? new Date(b.clock_in).getTime() : 0;
        return bClockIn - aClockIn;
      });

      setTimeLogs(sortedLogs);
    } catch (error) {
      console.error('Error loading time logs:', error);
      toast({
        title: "Error",
        description: "Failed to load time logs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (log: TimeLog) => {
    const formatTimeForInput = (dateString: string | null) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toISOString().slice(0, 16);
    };

    // Smart defaults for missing values
    const clockIn = log.clock_in || `${log.date}T09:00`;
    const clockOut = log.clock_out || `${log.date}T17:00`;

    setEditingLog({
      id: log.id,
      clock_in: formatTimeForInput(log.clock_in) || clockIn,
      clock_out: formatTimeForInput(log.clock_out) || clockOut,
      break_start: formatTimeForInput(log.break_start),
      break_end: formatTimeForInput(log.break_end),
    });

    // Scroll to edit form after a short delay
    setTimeout(() => {
      editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleSave = async () => {
    if (!editingLog) return;

    setSaving(editingLog.id);
    try {
      const clockIn = editingLog.clock_in ? new Date(editingLog.clock_in) : undefined;
      const clockOut = editingLog.clock_out ? new Date(editingLog.clock_out) : undefined;
      const breakStart = editingLog.break_start ? new Date(editingLog.break_start) : undefined;
      const breakEnd = editingLog.break_end ? new Date(editingLog.break_end) : undefined;

      // Improved validation with better error messages
      if (clockIn && clockOut && clockIn >= clockOut) {
        toast({
          title: "Invalid Time",
          description: "Clock out time must be later than clock in time",
          variant: "destructive",
        });
        return;
      }

      if (breakStart && breakEnd && breakStart >= breakEnd) {
        toast({
          title: "Invalid Break Time",
          description: "Break end must be later than break start",
          variant: "destructive",
        });
        return;
      }

      if (breakStart && clockIn && breakStart < clockIn) {
        toast({
          title: "Invalid Break Time",
          description: "Break cannot start before clocking in",
          variant: "destructive",
        });
        return;
      }

      if (breakEnd && clockOut && breakEnd > clockOut) {
        toast({
          title: "Invalid Break Time",
          description: "Break cannot end after clocking out",
          variant: "destructive",
        });
        return;
      }

      const { error } = await updateTimeLog({
        logId: editingLog.id,
        clockOut,
        clockIn,
        breakStart,
        breakEnd,
      });

      if (error) {
        toast({
          title: "Save Failed",
          description: "Could not update time log. Please try again.",
          variant: "destructive",
        });
        console.error('Error updating time log:', error);
        return;
      }

      toast({
        title: "Saved!",
        description: "Time log updated successfully",
      });
      setEditingLog(null);
      loadTimeLogs();
    } catch (error) {
      console.error('Error saving time log:', error);
      toast({
        title: "Save Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleCancel = () => {
    setEditingLog(null);
  };

  const clearBreakTimes = () => {
    if (editingLog) {
      setEditingLog({
        ...editingLog,
        break_start: '',
        break_end: ''
      });
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const calculateHoursWorked = (log: TimeLog) => {
    if (!log.clock_in || !log.clock_out) return 0;

    const clockIn = new Date(log.clock_in);
    const clockOut = new Date(log.clock_out);
    let totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);

    return Math.max(0, totalMinutes / 60);
  };

  const formatHours = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes.toString().padStart(2, '0')}m`;
  };

  // Quick date range presets
  const setDateRangePreset = (days: number) => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    setDateRange({
      startDate: getLocalDateString(startDate),
      endDate: getLocalDateString(endDate)
    });
  };

  // Better loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded w-20"></div>
                <div className="h-5 bg-muted rounded w-12"></div>
              </div>
              <div className="h-8 bg-muted rounded w-16"></div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j}>
                  <div className="h-3 bg-muted rounded w-16 mb-1"></div>
                  <div className="h-4 bg-muted rounded w-24"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Logs for {employee.name}
          </DialogTitle>

          {/* Improved date range selector with presets */}
          <div className="flex flex-wrap gap-3 items-center mt-3 p-3 bg-muted rounded-lg">
            {/* Filter Mode Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={filterMode === 'range' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('range')}
                className="text-xs transition-all duration-200 hover:scale-105 focus:ring-2 focus:ring-primary/20"
              >
                Date Range
              </Button>
              <Button
                variant={filterMode === 'single' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('single')}
                className="text-xs transition-all duration-200 hover:scale-105 focus:ring-2 focus:ring-primary/20"
              >
                Single Date
              </Button>
              <div className="h-4 border-l border-border mx-2"></div>
            </div>

            {filterMode === 'range' ? (
              <>
                <div className="flex gap-2 items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDateRangePreset(7)}
                    className="text-xs transition-all duration-200 hover:scale-105"
                  >
                    Last 7 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDateRangePreset(30)}
                    className="text-xs transition-all duration-200 hover:scale-105"
                  >
                    Last 30 days
                  </Button>
                  <div className="h-4 border-l border-border mx-2"></div>
                </div>

                <div className="flex gap-2 items-center">
                  <Label htmlFor="start-date" className="text-sm font-medium">From:</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-auto focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  />
                  <Label htmlFor="end-date" className="text-sm font-medium">To:</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-auto focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  />
                </div>
              </>
            ) : (
              <div className="flex gap-2 items-center">
                <Label htmlFor="single-date" className="text-sm font-medium">Date:</Label>
                <Input
                  id="single-date"
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="w-auto focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                />
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <LoadingSkeleton />
          ) : timeLogs.length > 0 ? (
            <div className="space-y-3">
              {timeLogs.map((log) => (
                <Card key={log.id} className="hover:shadow-md transition-all duration-200 hover:scale-[1.01]">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">
                          {formatDate(log.date)}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs font-medium">
                          {formatHours(calculateHoursWorked(log))}
                        </Badge>
                        {log.break_start && log.break_end && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Coffee className="h-3 w-3" />
                            Break taken
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(log)}
                        disabled={editingLog?.id === log.id}
                        className="flex items-center gap-1 transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
                      >
                        <Edit3 className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {editingLog?.id === log.id ? (
                      <div
                        ref={editFormRef}
                        className="space-y-4 p-4 bg-accent/10 rounded-lg border-2 border-accent/20 transition-all duration-300"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-accent-foreground mb-3">
                            Editing time log for {formatDate(log.date)}
                          </div>
                          <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                            Press Ctrl+Enter to save, Esc to cancel
                          </div>
                        </div>

                        {/* Required fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="clock_in" className="flex items-center gap-1">
                              Clock In <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="clock_in"
                              type="datetime-local"
                              value={editingLog.clock_in}
                              onChange={(e) =>
                                setEditingLog({ ...editingLog, clock_in: e.target.value })
                              }
                              className="mt-1 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="clock_out" className="flex items-center gap-1">
                              Clock Out <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="clock_out"
                              type="datetime-local"
                              value={editingLog.clock_out}
                              onChange={(e) =>
                                setEditingLog({ ...editingLog, clock_out: e.target.value })
                              }
                              className="mt-1 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                              required
                            />
                          </div>
                        </div>

                        {/* Optional break fields */}
                        <div className="border-t pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                              <Coffee className="h-4 w-4" />
                              Break Time (Optional)
                            </div>
                            {(editingLog.break_start || editingLog.break_end) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearBreakTimes}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Clear breaks
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="break_start" className="text-sm text-muted-foreground">
                                Break Start
                              </Label>
                              <Input
                                id="break_start"
                                type="datetime-local"
                                value={editingLog.break_start}
                                onChange={(e) =>
                                  setEditingLog({ ...editingLog, break_start: e.target.value })
                                }
                                className="mt-1 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                              />
                            </div>
                            <div>
                              <Label htmlFor="break_end" className="text-sm text-muted-foreground">
                                Break End
                              </Label>
                              <Input
                                id="break_end"
                                type="datetime-local"
                                value={editingLog.break_end}
                                onChange={(e) =>
                                  setEditingLog({ ...editingLog, break_end: e.target.value })
                                }
                                className="mt-1 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            variant="outline"
                            onClick={handleCancel}
                            disabled={saving === log.id}
                            className="transition-all duration-200 hover:scale-105"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSave}
                            disabled={saving === log.id || !editingLog.clock_in || !editingLog.clock_out}
                            className="transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
                          >
                            {saving === log.id ? (
                              <>Saving...</>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-1" />
                                Save Changes
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground font-medium">Clock In</span>
                          <p className="font-medium text-primary">{formatDateTime(log.clock_in)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium">Clock Out</span>
                          <p className="font-medium text-destructive">{formatDateTime(log.clock_out)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium">Break Start</span>
                          <p className="font-medium text-muted-foreground">{formatDateTime(log.break_start)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium">Break End</span>
                          <p className="font-medium text-muted-foreground">{formatDateTime(log.break_end)}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">No time logs found</h3>
              <p className="text-sm mb-4">
                No time logs were found for {employee.name} in the selected date range.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRangePreset(7)}
                  className="flex items-center gap-1"
                >
                  <Calendar className="h-3 w-3" />
                  Try last 7 days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterMode('single')}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Search single date
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}