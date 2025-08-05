'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Filter, Search, TrendingUp, Star, FileText, Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { TimeTracker } from "@/components/dashboard/time-tracker";
import { RequestDialog } from "@/components/dashboard/request-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { getEmployeeRequests } from "@/lib/util/employee-requests";
import { getPolicySales } from "@/lib/util/policies";
import { getClientReviews } from "@/lib/util/client-reviews";
import { getTodayHours, getThisWeekHours, getPeriodSummary } from "@/lib/util/get";
import { getEmployee } from "@/lib/util/employee";
import { type Request } from "@/lib/util/employee-requests";
import { EmployeeInfoDialog } from "@/components/dashboard/employee-info-dialog";
import { User } from "lucide-react";
import { dashboardEvents } from "@/lib/events";

interface EmployeeDashboardProps {
  onClockOut?: () => void;
  onClockOutPrompt?: (message: string) => void;
}

export function EmployeeDashboard({ onClockOut, onClockOutPrompt }: EmployeeDashboardProps) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();

  // UI State
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestFilter, setRequestFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeInfoOpen, setEmployeeInfoOpen] = useState(false);

  // Time Tracking State
  const [timeStatus, setTimeStatus] = useState<"idle" | "working" | "lunch" | "overtime_pending">("idle");
  const [currentElapsedTime, setCurrentElapsedTime] = useState(0);

  // Data State
  const [requests, setRequests] = useState<Request[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [basePeriodData, setBasePeriodData] = useState<Array<{
    date: string;
    dayName: string;
    hoursWorked: number;
    policiesSold: number;
    totalSales: number;
    isToday: boolean;
    isCurrentWeek: boolean;
  }>>([]);

  // Employee State
  const [employeeData, setEmployeeData] = useState<{
    name: string;
    email: string;
    department: string;
    position: string;
    maxHoursBeforeOvertime: number,
    hourlyRate: number,
    loading: boolean;
  }>({
    name: "Employee",
    email: "",
    department: "",
    position: "",
    maxHoursBeforeOvertime: 8,
    hourlyRate: 10,
    loading: true
  });

  // Performance State
  const [performanceData, setPerformanceData] = useState({
    totalPolicies: 0,
    totalSales: 0,
    totalReviews: 0,
    avgRating: 0,
    loading: true
  });

  // Current Time
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Payroll Period calculations
  const periodDays = 14;
  const [periodStart, setPeriodStart] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const payrollReference = new Date('2025-08-01T00:00:00');
    const msPerDay = 24 * 60 * 60 * 1000;
    const msPerPeriod = periodDays * msPerDay;
    const timeSinceReference = today.getTime() - payrollReference.getTime();
    const periodsSinceReference = Math.floor(timeSinceReference / msPerPeriod);
    const currentPeriodStart = new Date(payrollReference.getTime() + periodsSinceReference * msPerPeriod);
    return currentPeriodStart;
  });

  const periodEnd = useMemo(() => {
    const end = new Date(periodStart);
    end.setDate(end.getDate() + periodDays - 1);
    return end;
  }, [periodStart]);

  // Compute periodData with live updates
  const periodData = useMemo(() => {
    if (!basePeriodData.length) return basePeriodData;

    // Find today's entry
    const todayIndex = basePeriodData.findIndex(d => d.isToday);
    if (todayIndex === -1) return basePeriodData;

    // If we're tracking time, use the current elapsed time for today
    if (timeStatus === "working" || timeStatus === "overtime_pending" || (timeStatus === "idle" && currentElapsedTime > 0)) {
      const updated = [...basePeriodData];
      updated[todayIndex] = {
        ...updated[todayIndex],
        hoursWorked: currentElapsedTime / 3600
      };
      return updated;
    }

    return basePeriodData;
  }, [basePeriodData, currentElapsedTime, timeStatus]);

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const periodTitle = useMemo(() => {
    const startStr = periodStart.toISOString().slice(0, 10);
    const endStr = periodEnd.toISOString().slice(0, 10);
    return `Payroll Period: ${formatDate(startStr)} - ${formatDate(endStr)}`;
  }, [periodStart, periodEnd]);

  // Enable/Disable the next button/arrow
  const canGoNext = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return periodEnd < today;
  }, [periodEnd]);

  // Update current time
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Redirect if not authorized
  useEffect(() => {
    if (isLoaded && !isSignedIn && typeof window !== 'undefined') {
      window.location.href = '/sign-in';
    }
  }, [isLoaded, isSignedIn]);

  // Load initial data
  useEffect(() => {
    if (user?.id) {
      loadEmployeeData();
      loadRequests();
      loadPerformanceData();
      loadPeriodData();
    }
  }, [user?.id]);

  // Update bi-weekly charts
  useEffect(() => {
    if (user?.id) {
      loadPeriodData();
    }
  }, [periodStart, user?.id]);

  // Single event listener for all dashboard updates
  useEffect(() => {
    const handlePolicySale = () => {
      if (!user?.id) return;
      loadPeriodData();
      loadPerformanceData();
    };

    const handleClientReview = () => {
      if (!user?.id) return;
      loadPerformanceData();
    };

    const handleRequestSubmitted = () => {
      if (!user?.id) return;
      loadRequests();
    };

    const handleTimeLogged = () => {
      if (!user?.id) return;
      loadPeriodData();
    };

    const handleDailySummary = () => {
      if (!user?.id) return;
      loadPeriodData();
      loadPerformanceData();
    };

    const handleHighValuePolicyUpdate = () => {
      if (!user?.id) return;
      loadPerformanceData();
    };

    // Subscribe to events with proper typed handlers
    const cleanupFunctions = [
      dashboardEvents.on('policy_sale', handlePolicySale),
      dashboardEvents.on('client_review', handleClientReview),
      dashboardEvents.on('request_submitted', handleRequestSubmitted),
      dashboardEvents.on('time_logged', handleTimeLogged),
      dashboardEvents.on('daily_summary', handleDailySummary),
      dashboardEvents.on('high_value_policy_updated', handleHighValuePolicyUpdate)
    ];

    return () => cleanupFunctions.forEach(cleanup => cleanup());
  }, [user?.id]);

  // Day change detection (refreshes data every 30 minutes)
  useEffect(() => {
    const refreshData = () => {
      if (!user?.id) return;

      // Recalculate current period (in case we crossed into new period)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const payrollReference = new Date('2025-08-01T00:00:00');
      const msPerDay = 24 * 60 * 60 * 1000;
      const msPerPeriod = periodDays * msPerDay;
      const timeSinceReference = today.getTime() - payrollReference.getTime();
      const periodsSinceReference = Math.floor(timeSinceReference / msPerPeriod);
      const newPeriodStart = new Date(payrollReference.getTime() + periodsSinceReference * msPerPeriod);

      setPeriodStart(newPeriodStart);
      loadPeriodData();
      loadPerformanceData();
      loadRequests();
    };

    refreshData();
    const interval = setInterval(refreshData, 1800000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      const matchesFilter = requestFilter === "all" || request.status === requestFilter;
      const matchesSearch = request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [requests, requestFilter, searchTerm]);

  // Simplified display time logic - let TimeTracker be the source of truth
  const displayHours = currentElapsedTime / 3600;

  // Callbacks for TimeTracker
  const handleTimeUpdate = useCallback((elapsedSeconds: number, status: string) => {
    setCurrentElapsedTime(elapsedSeconds);
    setTimeStatus(status as "idle" | "working" | "lunch" | "overtime_pending");
  }, []);

  const handleTimeTrackerClockOut = useCallback(async () => {
    if (onClockOut) {
      onClockOut();
    }

    // Simplified clock-out prompt
    if (onClockOutPrompt) {
      const fallbackMessage = "How was your day? I'd love to hear about your accomplishments and how things went!";

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'CLOCK_OUT_PROMPT',
            userRole: 'employee',
          }),
        });

        const data = response.ok ? await response.json() : null;
        onClockOutPrompt(data?.response || fallbackMessage);
      } catch (error) {
        console.error('Error getting clock out prompt:', error);
        onClockOutPrompt(fallbackMessage);
      }
    }
  }, [onClockOut, onClockOutPrompt, user?.id]);

  // Early return after all hooks
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#005cb3] mx-auto mb-2"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Data loading functions
  const loadEmployeeData = async () => {
    if (!user?.id) return;

    try {
      const employee = await getEmployee(user.id);
      const clerkName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

      setEmployeeData({
        name: employee?.name || clerkName || 'Employee',
        email: employee?.email || user.emailAddresses[0]?.emailAddress || '',
        department: employee?.department || 'Sales',
        position: employee?.position || 'Insurance Agent',
        maxHoursBeforeOvertime: employee?.max_hours_before_overtime || 8,
        hourlyRate: employee?.hourly_rate || 25,
        loading: false
      });
    } catch (error) {
      console.error('Error loading employee data:', error);
      toast({
        title: "Error",
        description: "Failed to load employee profile. Using default settings.",
        variant: "destructive",
      });
      const clerkName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      setEmployeeData({
        name: clerkName || 'Employee',
        email: user.emailAddresses[0]?.emailAddress || '',
        department: 'Sales',
        position: 'Insurance Agent',
        maxHoursBeforeOvertime: 8,
        hourlyRate: 25,
        loading: false
      });
    }
  };

  const loadPeriodData = async () => {
    if (!user?.id) return;

    try {
      const periodDataResult = await getPeriodSummary(user.id, periodStart.toISOString().slice(0, 10), periodDays);
      setBasePeriodData(periodDataResult);
    } catch (error) {
      console.error('Error loading period data:', error);
      toast({
        title: "Error",
        description: "Failed to load time tracking data. Chart may be incomplete.",
        variant: "destructive",
      });
      // Optionally set empty array to prevent chart errors
      setBasePeriodData([]);
    }
  };

  const loadPerformanceData = async () => {
    if (!user?.id) return;

    try {
      setPerformanceData(prev => ({ ...prev, loading: true }));

      const results = await Promise.allSettled([
        getPolicySales(user.id),
        getClientReviews(user.id)
      ]);

      const policySales = results[0].status === 'fulfilled' ? results[0].value : [];
      const clientReviews = results[1].status === 'fulfilled' ? results[1].value : [];

      const totalSales = policySales.reduce((sum, sale) => sum + sale.amount, 0);
      const totalReviews = clientReviews.length;
      const avgRating = totalReviews > 0
        ? (clientReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews)
        : 0;

      setPerformanceData({
        totalPolicies: policySales.length,
        totalSales,
        totalReviews,
        avgRating: parseFloat(avgRating.toFixed(2)),
        loading: false
      });
    } catch (error) {
      console.error('Error loading performance data:', error);
      toast({
        title: "Error",
        description: "Failed to load performance data. Please try again.",
        variant: "destructive",
      });
      setPerformanceData(prev => ({ ...prev, loading: false }));
    }
  };

  const loadRequests = async () => {
    if (!user?.id) return;

    setRequestsLoading(true);
    try {
      const requestsData = await getEmployeeRequests(user.id);
      setRequests(requestsData);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast({
        title: "Error",
        description: "Failed to load requests. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRequestsLoading(false);
    }
  };

  // Helper functions
  const formatTimeDisplay = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);

    if (wholeHours === 0) return `${minutes}m`;
    if (minutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h ${minutes}m`;
  };

  const getProgressPercentage = () => {
    return Math.min((displayHours / employeeData.maxHoursBeforeOvertime) * 100, 100);
  };

  const getProgressColor = () => {
    if (displayHours >= employeeData.maxHoursBeforeOvertime) return 'bg-amber-500';
    if (displayHours >= employeeData.maxHoursBeforeOvertime * 0.8) return 'bg-orange-500';
    return 'bg-[#005cb3]';
  };

  const getMaxHours = () => {
    if (!periodData.length) return 8;
    const maxDailyHours = Math.max(...periodData.map(day => day.hoursWorked));
    return Math.max(maxDailyHours, 8);
  };

  const getUserName = () => {
    if (employeeData.name && employeeData.name !== 'Employee') {
      return employeeData.name.split(' ')[0];
    }
    return user?.firstName || 'there';
  };

  const getCurrentDate = () => currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const getCurrentTime = () => currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="space-y-6">
      {/* Header with Live Date/Time */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight truncate">
            Welcome back, {getUserName()}
          </h1>
          {!employeeData.loading && (
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm truncate">
              {employeeData.position} • {employeeData.department}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end text-right gap-1 sm:gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base lg:text-lg font-semibold">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-[#005cb3]" />
            <span className="hidden sm:inline">{getCurrentDate()}</span>
            <span className="sm:hidden">{getCurrentDate().split(',')[0]}</span> {/* Short date on mobile */}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
            {getCurrentTime()}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        {/* My Info Card */}
        <div className="bg-gradient-to-br from-[#005cb3]/10 to-[#005cb3]/5 dark:from-[#005cb3]/20 dark:to-[#005cb3]/10 rounded-xl border-2 border-[#005cb3]/20 dark:border-[#005cb3]/30 p-4 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 h-24">
          <div className="flex items-center justify-center h-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEmployeeInfoOpen(true)}
              className="flex items-center gap-2 h-full w-full justify-center text-[#005cb3] dark:text-[#005cb3] hover:bg-white/50 dark:hover:bg-white/10 font-medium transition-all duration-200 text-sm sm:text-base"
            >
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
              My Info
            </Button>
          </div>
        </div>

        {performanceData.loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border p-4 h-24">
              <div className="animate-pulse flex items-center justify-between h-full">
                <div className="flex flex-col justify-center space-y-2 flex-1">
                  <div className="h-2 sm:h-3 bg-muted rounded w-2/3"></div>
                  <div className="h-4 sm:h-6 bg-muted rounded w-1/3"></div>
                </div>
                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-muted rounded-xl flex-shrink-0 ml-3"></div>
              </div>
            </div>
          ))
        ) : (
          <>
            <div className="bg-card rounded-xl border p-4 hover:shadow-md hover:border-[#005cb3]/20 transition-all duration-200 h-24">
              <div className="flex items-center justify-between h-full">
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight truncate">Policies Sold</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground leading-tight">{performanceData.totalPolicies}</p>
                </div>
                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ml-3">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border p-4 hover:shadow-md hover:border-[#005cb3]/20 transition-all duration-200 h-24">
              <div className="flex items-center justify-between h-full">
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight truncate">Sales Generated</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground leading-tight">${performanceData.totalSales.toLocaleString('en-US')}</p>
                </div>
                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ml-3">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border p-4 hover:shadow-md hover:border-[#005cb3]/20 transition-all duration-200 h-24">
              <div className="flex items-center justify-between h-full">
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight truncate">Client Reviews</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground leading-tight">{performanceData.totalReviews}</p>
                    {performanceData.totalReviews > 0 && (
                      <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                        {performanceData.avgRating.toFixed(1)}★
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-800/20 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ml-3">
                  <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Time Tracking Section */}
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <TimeTracker
            employeeId={user.id}
            onTimeUpdate={handleTimeUpdate}
            maxHoursBeforeOvertime={employeeData.maxHoursBeforeOvertime}
            onClockOut={handleTimeTrackerClockOut}
          />
        </div>
      </div>

      {/* Today's Hours Card */}
      <Card className="hover:shadow-lg transition-all duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-[#005cb3]" />
            Today's Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-muted-foreground">Hours Worked</span>
                <div className="text-right">
                  <span className="text-lg font-bold text-foreground">
                    {formatTimeDisplay(displayHours)}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    / {employeeData.maxHoursBeforeOvertime}h 00m
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Progress
                  value={getProgressPercentage()}
                  className={`h-3 rounded-full [&>div]:${getProgressColor()} [&>div]:transition-all [&>div]:duration-500`}
                />
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>0h</span>
                  <span>{employeeData.maxHoursBeforeOvertime}h</span>
                </div>
              </div>
              <div className="flex justify-between items-start mt-4 p-3 bg-muted/30 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {timeStatus === "idle"
                      ? "Clock in to start tracking your hours"
                      : timeStatus === "lunch"
                        ? "On break - timer paused"
                        : timeStatus === "overtime_pending"
                          ? "Overtime approval pending"
                          : displayHours > employeeData.maxHoursBeforeOvertime
                            ? "Tracking your extended hours"
                            : displayHours > employeeData.maxHoursBeforeOvertime * 0.8
                              ? "Approaching your daily target hours"
                              : "Tracking your work hours"
                    }
                  </p>
                </div>
                {timeStatus !== "idle" && (
                  <div className="ml-3 px-2 py-1 bg-[#005cb3]/10 rounded-md">
                    <div className="text-xs font-medium text-[#005cb3]">
                      Status: <span className="capitalize">{timeStatus === "lunch" ? "Break" : timeStatus.replace('_', ' ')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Section */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <FileText className="h-5 w-5 text-[#005cb3]" />
                Requests
              </CardTitle>
              <CardDescription className="mt-1 text-sm sm:text-base">Manage your requests and view approval status</CardDescription>
            </div>
            <Button
              onClick={() => setRequestDialogOpen(true)}
              className="bg-[#005cb3] hover:bg-[#004a96] shadow-sm hover:shadow-md transition-all duration-200 self-start sm:self-auto"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                className="pl-9 h-10 border-muted-foreground/20 focus:border-[#005cb3] transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={requestFilter} onValueChange={setRequestFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-10 border-muted-foreground/20 focus:border-[#005cb3]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Requests</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {requestsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#005cb3] mx-auto mb-2"></div>
                <span className="text-sm sm:text-base">Loading requests...</span>
              </div>
            ) : filteredRequests.length > 0 ? (
              filteredRequests.map((request) => (
                <Collapsible key={request.id}>
                  <div className="p-4 bg-gradient-to-r from-background to-muted/20 border border-muted-foreground/10 rounded-xl hover:shadow-md hover:border-[#005cb3]/20 transition-all duration-200">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-left truncate text-sm sm:text-base lg:text-lg">{request.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <p className="text-xs sm:text-sm text-muted-foreground text-left">
                              {new Date(request.request_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`flex-shrink-0 font-medium text-xs sm:text-sm ${request.status === "approved"
                            ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                            : request.status === "pending"
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800"
                              : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                            }`}
                        >
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 pt-3 border-t border-muted-foreground/10">
                      <div className="space-y-3">
                        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{request.description}</p>
                        {request.hours_requested && (
                          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                            <Clock className="h-4 w-4 text-[#005cb3]" />
                            <span className="text-sm sm:text-base">
                              <span className="font-medium">Hours Requested:</span> {request.hours_requested}
                            </span>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-base sm:text-lg font-medium mb-1">
                  {!user?.id ? "Loading..." : requests.length === 0 ? "No requests yet" : "No matching requests"}
                </p>
                <p className="text-sm sm:text-base">
                  {requests.length === 0 ? "Submit your first request using the button above" : "Try adjusting your search or filter"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Biweekly Performance Chart - Enhanced Vertical Bars */}
      <Card className="hover:shadow-xl transition-all duration-300">
        <CardHeader className="pb-4 bg-gradient-to-r from-[#005cb3]/5 to-transparent">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newStart = new Date(periodStart);
                newStart.setDate(newStart.getDate() - periodDays);
                setPeriodStart(newStart);
              }}
              className="hover:bg-[#005cb3] hover:text-white transition-all duration-200 border-[#005cb3]/20"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-1 text-xs hidden sm:inline">Previous</span>
            </Button>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-[#005cb3]" />
                <CardTitle className="text-sm sm:text-base lg:text-lg xl:text-xl">{periodTitle}</CardTitle>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">14-Day Pay Period</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!canGoNext}
              onClick={() => {
                const newStart = new Date(periodStart);
                newStart.setDate(newStart.getDate() + periodDays);
                setPeriodStart(newStart);
              }}
              className="hover:bg-[#005cb3] hover:text-white transition-all duration-200 border-[#005cb3]/20 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            >
              <span className="mr-1 text-xs hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="text-center p-2 sm:p-3 bg-[#005cb3]/10 rounded-lg">
              <div className="text-base sm:text-lg lg:text-xl font-bold text-[#005cb3]">
                {formatTimeDisplay(periodData.reduce((total, day) => total + day.hoursWorked, 0))}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Total Hours</div>
            </div>
            <div className="text-center p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-base sm:text-lg lg:text-xl font-bold text-green-600">
                {periodData.reduce((total, day) => total + day.policiesSold, 0)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Policies Sold</div>
            </div>
            <div className="text-center p-2 sm:p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-base sm:text-lg lg:text-xl font-bold text-purple-600">
                {Math.round((periodData.reduce((total, day) => total + day.hoursWorked, 0) / 14) * 10) / 10}h
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Daily Average</div>
            </div>
          </div>

          {/* Enhanced Vertical Bars Chart */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 rounded-xl p-4 sm:p-6 relative overflow-hidden">
            {/* Grid lines for reference */}
            <div className="absolute inset-0 opacity-10">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="absolute w-full border-t border-[#005cb3]/30" style={{ top: `${20 + i * 15}%` }} />
              ))}
            </div>

            {/* Enhanced Chart Layout */}
            <div className="relative z-10 space-y-3 sm:space-y-4">
              {/* Policy Sales Row - Enhanced */}
              <div className="flex items-end justify-between gap-0.5 sm:gap-1 lg:gap-2 h-6 sm:h-8">
                {periodData.map((day) => (
                  <div key={`policy-${day.date}`} className="flex flex-col items-center flex-1 group">
                    {day.policiesSold > 0 && (
                      <div className="text-xs sm:text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 font-bold shadow-sm transition-all duration-200 group-hover:scale-110 group-hover:shadow-md">
                        <span className="hidden sm:inline">{day.policiesSold}</span>
                        <span className="sm:hidden">{day.policiesSold}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Hours Display Row - Enhanced */}
              <div className="flex items-end justify-between gap-0.5 sm:gap-1 lg:gap-2 h-5 sm:h-6">
                {periodData.map((day) => {
                  const timeDisplay = formatTimeDisplay(day.hoursWorked);
                  const isToday = day.isToday;
                  const isWeekend = day.dayName === 'Saturday' || day.dayName === 'Sunday';

                  return (
                    <div key={`hours-${day.date}`} className="flex flex-col items-center flex-1 group">
                      <div className={`text-xs sm:text-sm lg:text-base font-bold text-center transition-all duration-200 group-hover:scale-105 ${isToday ? 'text-[#005cb3]' : isWeekend ? 'text-purple-600' : 'text-muted-foreground'
                        }`}>
                        <span className="hidden sm:inline lg:hidden xl:inline">{timeDisplay}</span>
                        <span className="sm:hidden lg:inline xl:hidden">{day.hoursWorked > 0 ? `${Math.round(day.hoursWorked * 10) / 10}h` : '0h'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Enhanced Bars Row */}
              <div className="flex items-end justify-between gap-0.5 sm:gap-1 lg:gap-2" style={{ height: '120px' }}>
                {periodData.map((day) => {
                  const maxHours = getMaxHours();
                  const barHeight = maxHours > 0 ? Math.max((day.hoursWorked / maxHours) * 100, day.hoursWorked > 0 ? 4 : 2) : 2;
                  const isToday = day.isToday;
                  const isWeekend = day.dayName === 'Saturday' || day.dayName === 'Sunday';
                  const hasWork = day.hoursWorked > 0;

                  return (
                    <div key={`bar-${day.date}`} className="flex flex-col items-center flex-1 group">
                      <div className="relative w-4 sm:w-6 lg:w-8 flex flex-col justify-end transition-all duration-300 hover:scale-110 hover:shadow-lg" style={{ height: '120px' }}>
                        <div
                          className={`w-full rounded-t-lg transition-all duration-700 shadow-sm hover:shadow-md ${isToday
                            ? 'bg-gradient-to-t from-[#005cb3] to-blue-400 shadow-lg shadow-[#005cb3]/30 border border-[#005cb3]/20'
                            : hasWork
                              ? isWeekend
                                ? 'bg-gradient-to-t from-purple-500/70 to-purple-400/40 hover:from-purple-600/80 hover:to-purple-500/60 border border-purple-300/20'
                                : 'bg-gradient-to-t from-[#005cb3]/70 to-[#005cb3]/40 hover:from-[#005cb3]/90 hover:to-[#005cb3]/60 border border-[#005cb3]/20'
                              : 'bg-gradient-to-t from-muted-foreground/20 to-muted-foreground/10 hover:from-muted-foreground/30 hover:to-muted-foreground/20 border border-muted/20'
                            }`}
                          style={{ height: `${barHeight}px` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Enhanced Day Labels Row */}
              <div className="flex items-center justify-between gap-0.5 sm:gap-1 lg:gap-2 h-8 sm:h-10">
                {periodData.map((day) => {
                  const isToday = day.isToday;
                  const isWeekend = day.dayName === 'Saturday' || day.dayName === 'Sunday';

                  return (
                    <div key={`label-${day.date}`} className="flex flex-col items-center flex-1 group transition-all duration-200 hover:scale-105">
                      <div className={`text-xs sm:text-sm lg:text-base font-bold transition-colors duration-200 ${isToday ? 'text-[#005cb3]' : isWeekend ? 'text-purple-600' : 'text-muted-foreground'
                        } group-hover:text-opacity-80`}>
                        <span className="hidden sm:inline lg:hidden xl:inline">{day.dayName.slice(0, 3)}</span>
                        <span className="sm:hidden lg:inline xl:hidden">{day.dayName.slice(0, 1)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground/70 transition-opacity duration-200 group-hover:opacity-80">
                        <span className="hidden sm:inline lg:hidden xl:inline">{formatDate(day.date)}</span>
                        <span className="sm:hidden lg:inline xl:hidden">{day.date.split('-')[2]}</span>
                      </div>
                      {isToday && (
                        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-[#005cb3] rounded-full animate-pulse shadow-lg shadow-[#005cb3]/50 mt-1"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <RequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        onRequestSubmitted={() => {
          loadRequests();
        }}
      />

      {/* Employee Info Dialog */}
      <EmployeeInfoDialog
        open={employeeInfoOpen}
        onOpenChange={setEmployeeInfoOpen}
      />
    </div>
  );
}