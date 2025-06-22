'use client';

import { useState, useEffect, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  Play, 
  Square, 
  Coffee, 
  Check, 
  Timer, 
  ChevronDown, 
  ChevronUp,
  Filter,
  Search,
  TrendingUp,
  Star,
  FileText,
  Calendar,
  User
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
import { 
  getEmployeeRequests, 
  getPolicySales, 
  getClientReviews, 
  getDailySummaries,
  getWeeklySummary,
  getTodayHours,
  getThisWeekHours,
  getEmployee,
  logTimezoneInfo,
  type Request 
} from "@/lib/database";
import { dashboardEvents } from "@/lib/events";
import { ChatInterface } from "./chat-interface";

interface EmployeeDashboardProps {
  initialTab?: string;
  onClockOut?: () => void;
  onClockOutPrompt?: (message: string) => void;
}

export function EmployeeDashboard({ initialTab = "overview", onClockOut, onClockOutPrompt }: EmployeeDashboardProps) {
  // ✅ ALL HOOKS MUST BE DECLARED FIRST - NO EARLY RETURNS BEFORE THIS POINT
  const { user, isLoaded, isSignedIn } = useUser();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [requestFilter, setRequestFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isOnLunch, setIsOnLunch] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentElapsedTime, setCurrentElapsedTime] = useState(0);
  const [timeStatus, setTimeStatus] = useState<"idle" | "working" | "lunch" | "overtime_pending">("idle");
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
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const { toast } = useToast();
  
  const employeeSettings = {
    maxHoursBeforeOvertime: 8,
    hourlyRate: 25
  };

  // Current time update effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Redirect effect
  useEffect(() => {
    if (isLoaded && !isSignedIn && typeof window !== 'undefined') {
      window.location.href = '/sign-in';
    }
  }, [isLoaded, isSignedIn]);

  // Load employee data effect
  useEffect(() => {
    if (user?.id) {
      loadEmployeeData();
    }
  }, [user?.id]);

  // Load weekly data effect
  useEffect(() => {
    if (user?.id) {
      loadWeeklyData();
    }
  }, [user?.id]);

  // Load requests effect
  useEffect(() => {
    if (user?.id) {
      loadRequests();
    }
  }, [user?.id]);

  // Load performance data effect - ADDED THIS
  useEffect(() => {
    if (user?.id) {
      loadPerformanceData();
    }
  }, [user?.id]);

  // Refresh data periodically effect (improved frequency for better user experience)
  useEffect(() => {
    const interval = setInterval(() => {
      if (user?.id) {
        loadWeeklyData();
        loadPerformanceData();
      }
    }, 30000); // Refresh every 30 seconds for better real-time updates

    return () => clearInterval(interval);
  }, [user?.id]);

  // Day change detection effect
  useEffect(() => {
    const checkDayChange = () => {
      if (!user?.id) return; // Don't check if user is logging out
      
      const now = new Date();
      // Get date in user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
      const currentDate = localDate.toDateString(); // Gets date in user's timezone
      
      // Store the last known date
      const lastKnownDate = localStorage.getItem('last_known_date');
      
      if (lastKnownDate && lastKnownDate !== currentDate) {
        logTimezoneInfo(); // Log timezone info for debugging
        loadWeeklyData();
        loadPerformanceData();
        loadRequests();
      }
      
      localStorage.setItem('last_known_date', currentDate);
    };

    // Check immediately
    checkDayChange();
    
    // Then check every minute
    const interval = setInterval(checkDayChange, 60000);
    
    return () => clearInterval(interval);
  }, [user?.id]);

  // Event listeners for dashboard updates
  useEffect(() => {
    const handlePolicySale = () => {
      loadWeeklyData();
      loadPerformanceData();
    };

    const handleClientReview = () => {
      loadPerformanceData();
    };

    const handleRequestSubmitted = () => {
      loadRequests();
    };

    const handleTimeLogged = () => {
      loadWeeklyData();
    };

    const handleDailySummary = () => {
      loadWeeklyData();
      loadPerformanceData();
    };

    const handleHighValuePolicyUpdate = () => {
      loadPerformanceData(); // Update performance metrics when high-value policies are resolved/unresolved
    };

    // Subscribe to events and store cleanup functions
    const cleanupFunctions = [
      dashboardEvents.on('policy_sale', handlePolicySale),
      dashboardEvents.on('client_review', handleClientReview),
      dashboardEvents.on('request_submitted', handleRequestSubmitted),
      dashboardEvents.on('time_logged', handleTimeLogged),
      dashboardEvents.on('daily_summary', handleDailySummary),
      dashboardEvents.on('high_value_policy_updated', handleHighValuePolicyUpdate)
    ];

    return () => {
      // Call all cleanup functions
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, []);

  // Computed values
  const livePay = useMemo(() => {
    const totalHours = currentElapsedTime / 3600;
    const totalPay = totalHours * employeeSettings.hourlyRate;
    
    return {
      totalHours,
      totalPay
    };
  }, [currentElapsedTime, employeeSettings.hourlyRate]);

  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      const matchesFilter = requestFilter === "all" || request.status === requestFilter;
      const matchesSearch = request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           request.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [requests, requestFilter, searchTerm]);

  // Early return after all hooks
  if (!isLoaded || !isSignedIn) {
    return <div>Loading...</div>;
  }

  const loadEmployeeData = async () => {
    if (!user?.id) return;
    
    try {
      const employee = await getEmployee(user.id);
      
      if (employee) {
        setEmployeeData({
          name: employee.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Employee',
          email: employee.email || user.emailAddresses[0]?.emailAddress || '',
          department: employee.department || 'Sales',
          position: employee.position || 'Insurance Agent',
          loading: false
        });
      } else {
        // Use Clerk user data as fallback - construct proper name
        const clerkName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        setEmployeeData({
          name: clerkName || 'Employee',
          email: user.emailAddresses[0]?.emailAddress || '',
          department: 'Sales',
          position: 'Insurance Agent',
          loading: false
        });
      }
    } catch (error) {
      console.error('Error loading employee data:', error);
      // Use Clerk user data as fallback - construct proper name
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
      
      // Use Promise.allSettled to handle potential failures gracefully
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

  const handleTimeUpdate = (elapsedSeconds: number, status: string) => {
    setCurrentElapsedTime(elapsedSeconds);
    setTimeStatus(status as any);
  };

  const handleClockOut = async () => {
    // Call the parent onClockOut if provided
    if (onClockOut) {
      onClockOut();
    }

    // Generate and send clock-out question to parent (ask about their day)
    if (onClockOutPrompt) {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'CLOCK_OUT_PROMPT',
            userRole: 'employee',
            employeeId: user?.id || "emp-001"
          }),
        });

        if (response.ok) {
          const data = await response.json();
          onClockOutPrompt(data.response);
        } else {
          // Fallback question
          onClockOutPrompt("How was your day? I'd love to hear about your accomplishments and how things went!");
        }
      } catch (error) {
        console.error('Error getting clock out prompt:', error);
        // Fallback question
        onClockOutPrompt("How was your day? I'd love to hear about your accomplishments and how things went!");
      }
    }
  };

  const formatTimeDisplay = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (wholeHours === 0) {
      return `${minutes}m`;
    } else if (minutes === 0) {
      return `${wholeHours}h`;
    } else {
      return `${wholeHours}h ${minutes}m`;
    }
  };

  const getProgressPercentage = () => {
    const currentHours = isClockedIn ? currentElapsedTime / 3600 : todayHours;
    return Math.min((currentHours / employeeSettings.maxHoursBeforeOvertime) * 100, 100);
  };

  const getProgressColor = () => {
    const currentHours = isClockedIn ? currentElapsedTime / 3600 : todayHours;
    if (currentHours >= employeeSettings.maxHoursBeforeOvertime) {
      return 'bg-amber-500';
    } else if (currentHours >= employeeSettings.maxHoursBeforeOvertime * 0.8) {
      return 'bg-orange-500';
    }
    return 'bg-[#005cb3]';
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

  const handleLunchBreak = () => {
    setIsOnLunch(!isOnLunch);
    toast({
      title: isOnLunch ? "Back from lunch" : "Lunch break started",
      description: isOnLunch 
        ? "Welcome back! Your time tracking has resumed." 
        : "Enjoy your lunch! Time tracking is paused.",
    });
  };

  const getMaxHours = () => {
    return Math.max(...weeklyData.map(day => day.hoursWorked), employeeSettings.maxHoursBeforeOvertime);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const getUserName = () => {
    if (employeeData.name && employeeData.name !== 'Employee') {
      return employeeData.name.split(' ')[0];
    }
    if (user?.firstName) return user.firstName;
    return 'there';
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

  // Helper to get user's first name for personalized welcome
  const getFirstName = () => {
    if (employeeData.name && employeeData.name !== 'Employee') {
      return employeeData.name.split(' ')[0];
    }
    if (user?.firstName) return user.firstName;
    return 'there';
  };

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

      {/* Performance Metrics - Compact Design */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Client Reviews</p>
                <p className="text-2xl font-bold">
                  {performanceData.totalReviews}
                </p>
                {performanceData.totalReviews > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Avg: {performanceData.avgRating.toFixed(2)}★
                  </p>
                )}
              </div>
              <Star className="h-8 w-8 text-[#005cb3]" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sales Generated</p>
                <p className="text-2xl font-bold">${performanceData.totalSales.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-[#005cb3]" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Policies Sold</p>
                <p className="text-2xl font-bold">{performanceData.totalPolicies}</p>
              </div>
              <FileText className="h-8 w-8 text-[#005cb3]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Tracking Section */}
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <TimeTracker 
            onClockInChange={(clockedIn) => {
              setIsClockedIn(clockedIn);
            }} 
            onLunchChange={(lunch) => {
              setIsOnLunch(lunch);
            }}
            onTimeUpdate={handleTimeUpdate}
            maxHoursBeforeOvertime={employeeSettings.maxHoursBeforeOvertime}
            hourlyRate={employeeSettings.hourlyRate}
            onClockOut={(data) => {
              handleClockOut();
            }}
          />
        </div>
      </div>

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
                  {isClockedIn
                    ? formatTimeDisplay(currentElapsedTime / 3600)
                    : formatTimeDisplay(todayHours)
                  } / {employeeSettings.maxHoursBeforeOvertime}h 00m
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
                    : (isClockedIn ? (currentElapsedTime / 3600) : todayHours) > employeeSettings.maxHoursBeforeOvertime
                    ? "Tracking your extended hours"
                    : (isClockedIn ? (currentElapsedTime / 3600) : todayHours) > employeeSettings.maxHoursBeforeOvertime * 0.8
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
              {/* Live Pay Display */}
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs font-medium text-muted-foreground">Today's Pay</span>
                <span className="text-xs font-bold">
                  ${isClockedIn ? livePay.totalPay.toFixed(2) : (todayHours * employeeSettings.hourlyRate).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
          
          {/* Vertical Bar Chart Container */}
          <div className="flex items-end justify-between gap-2 h-40 bg-muted/10 rounded-lg p-4">
            {weeklyData.map((day) => {
              const maxHours = getMaxHours();
              const percentage = maxHours > 0 ? (day.hoursWorked / maxHours) * 100 : 0;
              const isToday = day.isToday;
              
              // Format hours and minutes for display
              const timeDisplay = formatTimeDisplay(day.hoursWorked);
              
              return (
                <div key={day.date} className="flex flex-col items-center gap-2 flex-1">
                  {/* Sales indicator */}
                  {day.policiesSold > 0 && (
                    <div className="text-xs text-[#005cb3] font-medium mb-1">
                      {day.policiesSold} sale{day.policiesSold !== 1 ? 's' : ''}
                    </div>
                  )}
                  
                  {/* Time label above bar */}
                  <div className="text-xs font-medium text-center min-h-[24px] flex items-end">
                    {timeDisplay}
                  </div>
                  
                  {/* Vertical Bar */}
                  <div className="relative flex-1 w-8 flex flex-col justify-end">
                    <div 
                      className={`w-full rounded-t-sm transition-all duration-500 ${
                        isToday 
                          ? 'bg-[#005cb3]' 
                          : day.hoursWorked > 0 
                            ? 'bg-[#005cb3]/70' 
                            : 'bg-muted-foreground/30'
                      }`}
                      style={{ 
                        height: `${Math.max(percentage, day.hoursWorked > 0 ? 10 : 5)}%`,
                        minHeight: '4px'
                      }}
                    />
                  </div>
                  
                  {/* Day label and date (X-axis) */}
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground font-medium">
                      {day.dayName.slice(0, 3).toUpperCase()}
                    </div>
                    <div className="text-xs text-muted-foreground/70" style={{ fontSize: '10px' }}>
                      {formatDate(day.date)}
                    </div>
                  </div>
                  
                  {/* Today indicator */}
                  {isToday && (
                    <div className="w-2 h-2 bg-[#005cb3] rounded-full"></div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <RequestDialog 
        open={requestDialogOpen} 
        onOpenChange={(open) => {
          setRequestDialogOpen(open);
          if (!open) {
            // Refresh requests when dialog closes (after successful submission)
            setTimeout(() => {
              loadRequests();
            }, 100);
          }
        }}
        onRequestSubmitted={() => {
          // Refresh requests immediately when a request is submitted
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