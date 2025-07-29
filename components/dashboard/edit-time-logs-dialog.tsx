"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Save, X, Edit3 } from "lucide-react";
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
    startDate: getLocalDateString(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)), // Default: 2 weeks ago
    endDate: getLocalDateString(new Date()) // Default: today
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && employee?.clerk_user_id) {
      loadTimeLogs();
    }
  }, [open, employee?.clerk_user_id, dateRange]);

  // Listen for time log updates
  useEffect(() => {
    if (!open) return;

    const handleTimeLogUpdate = () => {
      loadTimeLogs(); // Refresh the edit dialog data
    };

    const cleanup = dashboardEvents.on('time_logged', handleTimeLogUpdate);
    return cleanup;
  }, [open]);

  const loadTimeLogs = async () => {
    if (!employee?.clerk_user_id) return;

    setLoading(true);
    try {
      const logs = await getTimeLogsForWeek(employee.clerk_user_id, dateRange.startDate, dateRange.endDate);
      
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
        description: "Failed to load time logs",
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
      // Format as YYYY-MM-DDTHH:MM for datetime-local input
      return date.toISOString().slice(0, 16);
    };

    setEditingLog({
      id: log.id,
      clock_in: formatTimeForInput(log.clock_in),
      clock_out: formatTimeForInput(log.clock_out),
      break_start: formatTimeForInput(log.break_start),
      break_end: formatTimeForInput(log.break_end),
    });
  };

  const handleSave = async () => {
    if (!editingLog) return;

    setSaving(editingLog.id);
    try {
      const clockIn = editingLog.clock_in ? new Date(editingLog.clock_in) : undefined;
      const clockOut = editingLog.clock_out ? new Date(editingLog.clock_out) : new Date();
      const breakStart = editingLog.break_start ? new Date(editingLog.break_start) : undefined;
      const breakEnd = editingLog.break_end ? new Date(editingLog.break_end) : undefined;

      // Validation
      if (clockIn && clockOut && clockIn >= clockOut) {
        toast({
          title: "Validation Error",
          description: "Clock out time must be after clock in time",
          variant: "destructive",
        });
        return;
      }

      if (breakStart && breakEnd && breakStart >= breakEnd) {
        toast({
          title: "Validation Error",
          description: "Break end time must be after break start time",
          variant: "destructive",
        });
        return;
      }

      if (breakStart && clockIn && breakStart < clockIn) {
        toast({
          title: "Validation Error",
          description: "Break start time must be after clock in time",
          variant: "destructive",
        });
        return;
      }

      if (breakEnd && clockOut && breakEnd > clockOut) {
        toast({
          title: "Validation Error",
          description: "Break end time must be before clock out time",
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
          title: "Error",
          description: "Failed to update time log",
          variant: "destructive",
        });
        console.error('Error updating time log:', error);
        return;
      }

      toast({
        title: "Success",
        description: "Time log updated successfully",
      });
      setEditingLog(null);
      loadTimeLogs(); // Refresh the data
    } catch (error) {
      console.error('Error saving time log:', error);
      toast({
        title: "Error",
        description: "Failed to update time log",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleCancel = () => {
    setEditingLog(null);
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
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
    
    // Subtract break time if available
    if (log.break_start && log.break_end) {
      const breakStart = new Date(log.break_start);
      const breakEnd = new Date(log.break_end);
      const breakMinutes = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
      totalMinutes -= breakMinutes;
    }
    
    return Math.max(0, totalMinutes / 60);
  };

  const formatHours = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes.toString().padStart(2, '0')}m`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Edit Time Logs - {employee.name}
          </DialogTitle>
          <div className="flex gap-2 items-center mt-2">
            <Label htmlFor="start-date" className="text-sm">From:</Label>
            <Input
              id="start-date"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-auto"
            />
            <Label htmlFor="end-date" className="text-sm">To:</Label>
            <Input
              id="end-date"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-auto"
            />
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse border rounded-lg p-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : timeLogs.length > 0 ? (
            <div className="space-y-4">
              {timeLogs.map((log) => (
                <Card key={log.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">
                          {formatDate(log.date)}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {formatHours(calculateHoursWorked(log))}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(log)}
                        disabled={editingLog?.id === log.id}
                        className="flex items-center gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    {editingLog?.id === log.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="clock_in">Clock In *</Label>
                            <Input
                              id="clock_in"
                              type="datetime-local"
                              value={editingLog.clock_in}
                              onChange={(e) =>
                                setEditingLog({ ...editingLog, clock_in: e.target.value })
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="clock_out">Clock Out *</Label>
                            <Input
                              id="clock_out"
                              type="datetime-local"
                              value={editingLog.clock_out}
                              onChange={(e) =>
                                setEditingLog({ ...editingLog, clock_out: e.target.value })
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="break_start">Break Start (Optional)</Label>
                            <Input
                              id="break_start"
                              type="datetime-local"
                              value={editingLog.break_start}
                              onChange={(e) =>
                                setEditingLog({ ...editingLog, break_start: e.target.value })
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="break_end">Break End (Optional)</Label>
                            <Input
                              id="break_end"
                              type="datetime-local"
                              value={editingLog.break_end}
                              onChange={(e) =>
                                setEditingLog({ ...editingLog, break_end: e.target.value })
                              }
                              className="mt-1"
                            />
                          </div>
                        </div>
                        
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={handleCancel}
                            disabled={saving === log.id}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSave}
                            disabled={saving === log.id}
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
                          <span className="text-muted-foreground">Clock In:</span>
                          <p className="font-medium">{formatDateTime(log.clock_in)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Clock Out:</span>
                          <p className="font-medium">{formatDateTime(log.clock_out)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Break Start:</span>
                          <p className="font-medium">{formatDateTime(log.break_start)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Break End:</span>
                          <p className="font-medium">{formatDateTime(log.break_end)}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No time logs found for the selected date range.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}