'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock,
  Filter,
  Search,
  TrendingUp,
  Star,
  FileText,
  Calendar,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { TimeTracker } from "@/components/dashboard/time-tracker";
import { RequestDialog } from "@/components/dashboard/request-dialog";
import { SettingsDialog } from "@/components/dashboard/settings-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { getEmployeeRequests } from "@/lib/util/employee-requests";
import { getPolicySales } from "@/lib/util/policies";
import { getClientReviews } from "@/lib/util/client-reviews";
import { getWeeklySummary, getTodayHours, getThisWeekHours } from "@/lib/util/get";
import { getEmployee } from "@/lib/util/employee";
import { type Request } from "@/lib/util/employee-requests";

import { dashboardEvents } from "@/lib/events";

interface EmployeeDashboardProps {
  initialTab?: string;
  onClockOut?: () => void;
  onClockOutPrompt?: (message: string) => void;
}

export function EmployeeDashboard({ initialTab = "overview", onClockOut, onClockOutPrompt }: EmployeeDashboardProps) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();
  
  // UI State
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [requestFilter, setRequestFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Time Tracking State
  const [isOnLunch, setIsOnLunch] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentElapsedTime, setCurrentElapsedTime] = useState(0);
  const [timeStatus, setTimeStatus] = useState<"idle" | "working" | "lunch" | "overtime_pending">("idle");
  
  // Data State
  const [requests, setRequests] = useState<Request[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<Array<{
    date: string;
    dayName: string;
    hoursWorked: number;
    policiesSold: number;
    totalSales: number;
    isToday: boolean;
    isCurrentWeek: boolean;
  }>>([]);
  const [todayHours, setTodayHours] = useState(0);
  const [thisWeekHours, setThisWeekHours] = useState(0);
  const [employeeData, setEmployeeData] = useState<{
    name: string;
    email: string;
    department: string;
    position: string;
    loading: boolean;
  }>({
    name: "Employee",
    email: "",
    department: "",
    position: "",
    loading: true
  });
  const [performanceData, setPerformanceData] = useState({
    totalPolicies: 0,
    totalSales: 0,
    totalReviews: 0,
    avgRating: 0,
    loading: true
  });

  // Simple current time (only update every minute for date/time display)
  const [currentTime, setCurrentTime] = useState(() => new Date());
  
  const employeeSettings = {
    maxHoursBeforeOvertime: 8,
    hourlyRate: 25
  };

  // Update current time every minute (not every second)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Every minute instead of every second
    return () => clearInterval(interval);
  }, []);

  // Redirect effect
  useEffect(() => {
    if (isLoaded && !isSignedIn && typeof window !== 'undefined') {
      window.location.href = '/sign-in';
    }
  }, [isLoaded, isSignedIn]);

  // Load initial data
  useEffect(() => {
    if (user?.id) {
      loadEmployeeData();
      loadWeeklyData();
      loadRequests();
      loadPerformanceData();
    }
  }, [user?.id]);

  // Single event listener for all dashboard updates
  useEffect(() => {
    const handlePolicySale = () => {
      if (!user?.id) return;
      loadWeeklyData();
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
      loadWeeklyData();
    };

    const handleDailySummary = () => {
      if (!user?.id) return;
      loadWeeklyData();
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

  // Day change detection (simplified)
  useEffect(() => {
    const checkDayChange = () => {
      if (!user?.id) return;
      
      const currentDate = new Date().toDateString();
      const lastKnownDate = localStorage.getItem('last_known_date');
      
      if (lastKnownDate && lastKnownDate !== currentDate) {
        loadWeeklyData();
        loadPerformanceData();
        loadRequests();
      }
      
      localStorage.setItem('last_known_date', currentDate);
    };

    checkDayChange();
    const interval = setInterval(checkDayChange, 1200000); // 20 minutes
    
    return () => clearInterval(interval);
  }, [user?.id]);

  // Memoized values
  const livePay = useMemo(() => {
    const totalHours = currentElapsedTime / 3600;
    const totalPay = totalHours * employeeSettings.hourlyRate;
    
    return { totalHours, totalPay };
  }, [currentElapsedTime, employeeSettings.hourlyRate]);

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
    setTimeStatus(status as any);

    // Simple real-time update for today's bar chart
    setWeeklyData(prev => {
      if (!prev?.length) return prev;
      
      const todayIndex = prev.findIndex(d => d.isToday);
      if (todayIndex === -1) return prev;
      
      const newHours = parseFloat((elapsedSeconds / 3600).toFixed(2));
      if (prev[todayIndex].hoursWorked === newHours) return prev;
      
      const updated = [...prev];
      updated[todayIndex] = { ...updated[todayIndex], hoursWorked: newHours };
      return updated;
    });
  }, []);

  const handleClockInChange = useCallback((clockedIn: boolean) => {
    setIsClockedIn(clockedIn);
  }, []);

  const handleLunchChange = useCallback((lunch: boolean) => {
    setIsOnLunch(lunch);
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
            employeeId: user?.id || "emp-001"
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
    return <div>Loading...</div>;
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
        loading: false
      });
    } catch (error) {
      console.error('Error loading employee data:', error);
      const clerkName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      setEmployeeData({
        name: clerkName || 'Employee',
        email: user.emailAddresses[0]?.emailAddress || '',
        department: 'Sales',
        position: 'Insurance Agent',
        loading: false
      });
    }
  };

  const loadWeeklyData = async () => {
    if (!user?.id) return;
    
    try {
      const [todayHoursData, thisWeekHoursData, weeklyDataResult] = await Promise.all([
        getTodayHours(user.id),
        getThisWeekHours(user.id),
        getWeeklySummary(user.id)
      ]);
      
      setTodayHours(todayHoursData);
      setThisWeekHours(thisWeekHoursData);
      setWeeklyData(weeklyDataResult);
    } catch (error) {
      console.error('Error loading weekly data:', error);
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
    return Math.min((displayHours / employeeSettings.maxHoursBeforeOvertime) * 100, 100);
  };

  const getProgressColor = () => {
    if (displayHours >= employeeSettings.maxHoursBeforeOvertime) return 'bg-amber-500';
    if (displayHours >= employeeSettings.maxHoursBeforeOvertime * 0.8) return 'bg-orange-500';
    return 'bg-[#005cb3]';
  };

  const getMaxHours = () => {
    if (!weeklyData.length) return 8;
    const maxDailyHours = Math.max(...weeklyData.map(day => day.hoursWorked));
    return Math.max(maxDailyHours, 8);
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return `${date.getMonth() + 1}/${date.getDate()}`;
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {getUserName()}</h1>
          {!employeeData.loading && (
            <p className="text-muted-foreground mt-1">
              {employeeData.position} • {employeeData.department}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end text-right">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Calendar className="h-5 w-5 text-[#005cb3]" />
            {getCurrentDate()}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {getCurrentTime()}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        {performanceData.loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-4 h-20">
              <div className="animate-pulse flex items-center justify-between h-full">
                <div className="flex flex-col justify-center space-y-2 flex-1">
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                  <div className="h-6 bg-muted rounded w-1/3"></div>
                </div>
                <div className="h-8 w-8 bg-muted rounded-lg flex-shrink-0 ml-3"></div>
              </div>
            </div>
          ))
        ) : (
          <>
            <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow h-20">
              <div className="flex items-center justify-between h-full">
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground leading-tight truncate">Policies Sold</p>
                  <p className="text-2xl font-semibold text-foreground leading-tight">{performanceData.totalPolicies}</p>
                </div>
                <div className="h-8 w-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
                  <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow h-20">
              <div className="flex items-center justify-between h-full">
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground leading-tight truncate">Sales Generated</p>
                  <p className="text-2xl font-semibold text-foreground leading-tight">${performanceData.totalSales.toLocaleString()}</p>
                </div>
                <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow h-20">
              <div className="flex items-center justify-between h-full">
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground leading-tight truncate">Client Reviews</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-2xl font-semibold text-foreground leading-tight">{performanceData.totalReviews}</p>
                    {performanceData.totalReviews > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {performanceData.avgRating.toFixed(1)}★
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 w-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
                  <Star className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
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
            onClockInChange={handleClockInChange}
            onLunchChange={handleLunchChange}
            onTimeUpdate={handleTimeUpdate}
            maxHoursBeforeOvertime={employeeSettings.maxHoursBeforeOvertime}
            onClockOut={handleTimeTrackerClockOut}
          />
        </div>
      </div>

      {/* Today's Hours Card */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Today&apos;s Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Hours Worked</span>
                <span className="text-sm">
                  {formatTimeDisplay(displayHours)} / {employeeSettings.maxHoursBeforeOvertime}h 00m
                </span>
              </div>
              <Progress 
                value={getProgressPercentage()} 
                className={`[&>div]:${getProgressColor()}`}
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-muted-foreground">
                  {timeStatus === "idle" 
                    ? "Clock in to start tracking your hours"
                    : timeStatus === "lunch"
                    ? "On lunch break - timer paused"
                    : timeStatus === "overtime_pending"
                    ? "Overtime approval pending"
                    : displayHours > employeeSettings.maxHoursBeforeOvertime
                    ? "Tracking your extended hours"
                    : displayHours > employeeSettings.maxHoursBeforeOvertime * 0.8
                    ? "Approaching your daily target hours"
                    : "Tracking your work hours"
                  }
                </p>
                {timeStatus !== "idle" && (
                  <div className="text-xs text-muted-foreground">
                    Status: <span className="capitalize font-medium">{timeStatus.replace('_', ' ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Section */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Requests & Communication</CardTitle>
              <CardDescription>Manage your requests and view approval status</CardDescription>
            </div>
            <Button 
              onClick={() => setRequestDialogOpen(true)}
              className="bg-[#005cb3] hover:bg-[#004a96]"
            >
              New Request
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={requestFilter} onValueChange={setRequestFilter}>
              <SelectTrigger className="w-[140px]">
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

          <div className="space-y-4">
            {requestsLoading ? (
              <div className="text-center py-4 text-muted-foreground">
                Loading requests...
              </div>
            ) : filteredRequests.length > 0 ? (
              filteredRequests.map((request) => (
                <Collapsible key={request.id}>
                  <div className="p-4 bg-white dark:bg-card border rounded-lg hover:shadow-sm transition-shadow">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-left">{request.title}</h4>
                          <p className="text-sm text-muted-foreground text-left">
                            {new Date(request.request_date).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={
                            request.status === "approved"
                              ? "bg-[#005cb3]/10 text-[#005cb3] dark:bg-[#005cb3]/30 dark:text-[#005cb3]"
                              : request.status === "pending"
                              ? "bg-secondary/50 text-muted-foreground"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }
                        >
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-3">
                      <p className="text-sm text-muted-foreground">{request.description}</p>
                      {request.hours_requested && (
                        <p className="text-sm">
                          <span className="font-medium">Hours Requested:</span> {request.hours_requested}
                        </p>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {!user?.id ? "Loading..." : requests.length === 0 ? "No requests submitted yet." : "No requests found matching your filters."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Performance Chart */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#005cb3]" />
            <CardTitle>This Week&apos;s Performance</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Hours Worked by Day</h4>
            <div className="text-sm text-muted-foreground">
              {formatTimeDisplay(weeklyData.reduce((total, day) => total + day.hoursWorked, 0))} total
            </div>
          </div>
          
          <div className="py-4"></div>
          
          <div className="bg-muted/10 rounded-lg p-4">
            <div className="flex items-end justify-between gap-2 pt-8" style={{ height: '140px' }}>
              {weeklyData.map((day) => {
                const maxHours = getMaxHours();
                const barHeight = maxHours > 0 ? Math.max((day.hoursWorked / maxHours) * 100, day.hoursWorked > 0 ? 3 : 1) : 1;
                const isToday = day.isToday;
                const timeDisplay = formatTimeDisplay(day.hoursWorked);
                
                return (
                  <div key={day.date} className="flex flex-col items-center gap-2 flex-1">
                    {day.policiesSold > 0 && (
                      <div className="text-xs text-[#005cb3] font-medium mb-1">
                        {day.policiesSold} sale{day.policiesSold !== 1 ? 's' : ''}
                      </div>
                    )}
                    
                    <div className="text-xs font-medium text-center min-h-[20px] flex items-end">
                      {timeDisplay}
                    </div>
                    
                    <div className="relative w-8 flex flex-col justify-end" style={{ height: '100px' }}>
                      <div 
                        className={`w-full rounded-t-sm transition-all duration-500 ${
                          isToday 
                            ? 'bg-[#005cb3]' 
                            : day.hoursWorked > 0 
                              ? 'bg-[#005cb3]/70' 
                              : 'bg-muted-foreground/30'
                        }`}
                        style={{ height: `${barHeight}px` }}
                      />
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground font-medium">
                        {day.dayName.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="text-xs text-muted-foreground/70" style={{ fontSize: '10px' }}>
                        {formatDate(day.date)}
                      </div>
                    </div>
                    
                    {isToday && (
                      <div className="w-2 h-2 bg-[#005cb3] rounded-full"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <RequestDialog 
        open={requestDialogOpen} 
        onOpenChange={(open) => {
          setRequestDialogOpen(open);
          if (!open) {
            setTimeout(() => {
              loadRequests();
            }, 100);
          }
        }}
        onRequestSubmitted={() => {
          loadRequests();
        }}
      />

      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        employeeName={employeeData.name}
        employeeEmail={employeeData.email}
      />
    </div>
  );
}