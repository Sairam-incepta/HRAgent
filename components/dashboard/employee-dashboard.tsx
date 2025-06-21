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
}

export function EmployeeDashboard({ initialTab = "overview", onClockOut }: EmployeeDashboardProps) {
  console.log('🚩 EmployeeDashboard mounted', new Date().toISOString());
  
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
  const [showClockOutPrompt, setShowClockOutPrompt] = useState(false);
  const [clockOutPromptMessage, setClockOutPromptMessage] = useState<string | undefined>();

  const { toast } = useToast();
  
  const employeeSettings = {
    maxHoursBeforeOvertime: 8,
    hourlyRate: 25
  };

  // 🔧 ENHANCED DEBUGGING: Log state changes
  useEffect(() => {
    console.log('🔔 Clock out state changed:', {
      showClockOutPrompt,
      clockOutPromptMessage,
      timestamp: new Date().toISOString()
    });
  }, [showClockOutPrompt, clockOutPromptMessage]);

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

  // Refresh data periodically effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (user?.id) {
        loadWeeklyData();
        loadPerformanceData();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [user?.id]);

  // Day change detection effect
  useEffect(() => {
    const checkDayChange = () => {
      if (!user?.id) return; // Don't check if user is logging out
      
      const now = new Date();
      const currentDate = now.toDateString(); // Gets date in local timezone
      
      // Store the last known date
      const lastKnownDate = localStorage.getItem('last_known_date');
      
      if (lastKnownDate && lastKnownDate !== currentDate) {
        console.log('📅 Day changed detected, refreshing data');
        logTimezoneInfo(); // Log timezone info for debugging
        loadWeeklyData();
        loadPerformanceData();
        loadRequests();
      }
      
      localStorage.setItem('last_known_date', currentDate);
    };

    // Check immediately
    checkDayChange();
    
    // Check every minute for day changes
    const dayChangeInterval = setInterval(checkDayChange, 60000);
    
    return () => clearInterval(dayChangeInterval);
  }, [user?.id]);

  // Event listeners effect
  useEffect(() => {
    const handlePolicySale = () => {
      if (!user?.id) return; // Don't refresh if user is logging out
      console.log('🔄 Policy sale event received, refreshing performance data');
      loadPerformanceData();
    };

    const handleClientReview = () => {
      if (!user?.id) return; // Don't refresh if user is logging out
      console.log('🔄 Client review event received, refreshing performance data');
      loadPerformanceData();
    };

    const handleRequestSubmitted = () => {
      if (!user?.id) return; // Don't refresh if user is logging out
      console.log('🔄 Request submitted event received, refreshing requests');
      loadRequests();
    };

    const handleTimeLogged = () => {
      if (!user?.id) return; // Don't refresh if user is logging out
      console.log('🔄 Time logged event received, refreshing weekly data');
      loadWeeklyData();
    };

    const handleDailySummary = () => {
      if (!user?.id) return; // Don't refresh if user is logging out
      console.log('🔄 Daily summary event received, refreshing all data');
      loadWeeklyData();
      loadPerformanceData();
    };

    // Subscribe to events
    dashboardEvents.on('policy_sale', handlePolicySale);
    dashboardEvents.on('client_review', handleClientReview);
    dashboardEvents.on('request_submitted', handleRequestSubmitted);
    dashboardEvents.on('time_logged', handleTimeLogged);
    dashboardEvents.on('daily_summary', handleDailySummary);

    // Cleanup event listeners
    return () => {
      dashboardEvents.off('policy_sale', handlePolicySale);
      dashboardEvents.off('client_review', handleClientReview);
      dashboardEvents.off('request_submitted', handleRequestSubmitted);
      dashboardEvents.off('time_logged', handleTimeLogged);
      dashboardEvents.off('daily_summary', handleDailySummary);
    };
  }, [user?.id]);

  // Live pay calculation memoized
  const livePay = useMemo(() => {
    const hours = currentElapsedTime / 3600;
    const regularHours = Math.min(hours, employeeSettings.maxHoursBeforeOvertime);
    const overtimeHours = Math.max(0, hours - employeeSettings.maxHoursBeforeOvertime);
    const regularPay = regularHours * employeeSettings.hourlyRate;
    const overtimePay = overtimeHours * employeeSettings.hourlyRate * 1.0;
    return {
      regularPay,
      overtimePay,
      totalPay: regularPay + overtimePay,
      overtimeHours
    };
  }, [currentElapsedTime, employeeSettings.hourlyRate, employeeSettings.maxHoursBeforeOvertime]);

  // Reset clock out prompt state when appropriate
  useEffect(() => {
    // Reset the clock out prompt after 5 minutes to prevent it from getting stuck
    if (showClockOutPrompt) {
      console.log('⏰ Clock out prompt shown, setting 5-minute timeout');
      const timeout = setTimeout(() => {
        console.log('🔄 Resetting clock out prompt after timeout');
        setShowClockOutPrompt(false);
        setClockOutPromptMessage(undefined);
      }, 5 * 60 * 1000); // 5 minutes

      return () => {
        console.log('⏰ Clearing clock out timeout');
        clearTimeout(timeout);
      };
    }
  }, [showClockOutPrompt]);

  // ✅ ALL CONDITIONAL RENDERING LOGIC AFTER ALL HOOKS
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-lg text-muted-foreground">Loading user profile...</span>
      </div>
    );
  }

  if (isLoaded && !isSignedIn) {
    return null;
  }

  // FUNCTION DEFINITIONS (these are safe to be after conditional returns since they're not hooks)
  
  // Load employee data from database
  const loadEmployeeData = async () => {
    if (!user?.id) return;
    
    try {
      const employee = await getEmployee(user.id);
      
      if (employee) {
        setEmployeeData({
          name: employee.name,
          email: employee.email,
          department: employee.department,
          position: employee.position,
          loading: false
        });
      } else {
        // Fallback to Clerk user data if employee not found in database
        setEmployeeData({
          name: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.firstName || "Employee",
          email: user.emailAddresses[0]?.emailAddress || "",
          department: "Unknown",
          position: "Employee",
          loading: false
        });
      }
    } catch (error) {
      console.error('Error loading employee data:', error);
      // Fallback to Clerk user data
      setEmployeeData({
        name: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.firstName || "Employee",
        email: user.emailAddresses[0]?.emailAddress || "",
        department: "Unknown",
        position: "Employee",
        loading: false
      });
    }
  };

  // Load weekly data and hours
  const loadWeeklyData = async () => {
    if (!user?.id) return;
    
    try {
      console.log('🔄 Loading weekly data for user:', user.id);
      logTimezoneInfo(); // Log timezone info for debugging
      
      const [weekly, today, week] = await Promise.all([
        getWeeklySummary(user.id),
        getTodayHours(user.id),
        getThisWeekHours(user.id)
      ]);
      
      console.log('📊 Weekly data loaded:', { weekly, today, week });
      console.log('📅 Today hours from DB:', today);
      console.log('📈 This week hours from DB:', week);
      
      setWeeklyData(weekly);
      setTodayHours(today);
      setThisWeekHours(week);
      
      console.log('✅ State updated - todayHours:', today, 'thisWeekHours:', week);
    } catch (error) {
      console.error('❌ Error loading weekly data:', error);
    }
  };

  // Load employee performance data (NO BONUS INFORMATION)
  const loadPerformanceData = async () => {
    if (!user?.id) return;
    
    try {
      const [policySales, clientReviews] = await Promise.all([
        getPolicySales(user.id),
        getClientReviews(user.id)
      ]);
      
      const totalSales = policySales.reduce((sum, sale) => sum + sale.amount, 0);
      const avgRating = clientReviews.length > 0 
        ? clientReviews.reduce((sum, review) => sum + review.rating, 0) / clientReviews.length 
        : 0;
      
      setPerformanceData({
        totalPolicies: policySales.length,
        totalSales,
        totalReviews: clientReviews.length,
        avgRating: Math.round(avgRating * 10) / 10,
        loading: false
      });
    } catch (error) {
      console.error('Error loading performance data:', error);
      setPerformanceData(prev => ({ ...prev, loading: false }));
    }
  };

  // Handle time tracker updates
  const handleTimeUpdate = (elapsedSeconds: number, status: string) => {
    console.log('⏰ Time update received:', { elapsedSeconds, status, currentStatus: timeStatus, now: new Date().toISOString() });
    setCurrentElapsedTime(elapsedSeconds);
    setTimeStatus(status as any);
    
    // Only refresh weekly data when status changes, not on every timer tick
    if (status !== timeStatus) {
      console.log('🔄 Status changed, refreshing weekly data');
      loadWeeklyData();
    }
  };

  // 🔧 ENHANCED DEBUGGING: Clock out handler
  const handleClockOut = async () => {
    console.log('🚪 ===== CLOCK OUT TRIGGERED =====');
    console.log('🚪 User ID:', user?.id);
    console.log('🚪 Current state:', { showClockOutPrompt, clockOutPromptMessage });
    
    // Add a small delay to ensure the database operation completes
    setTimeout(() => {
      console.log('🔄 Clock out delay completed, refreshing data');
      loadWeeklyData();
      loadPerformanceData();
    }, 500);
    
    onClockOut?.();
    
    console.log('🤖 Attempting to fetch AI clock out message...');
    
    // Fetch AI-generated message
    try {
      const requestPayload = {
        message: "CLOCK_OUT_PROMPT",
        userRole: 'employee',
        employeeId: user?.id,
        userName: getFirstName(),
        isClockOutPrompt: true
      };
      
      console.log('📤 Sending request to /api/chat:', requestPayload);
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });
      
      console.log('📥 Response status:', res.status);
      console.log('📥 Response ok:', res.ok);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('📥 Response data:', data);
      
      const message = data.response || "How was your day? I'd love to hear about it!";
      console.log('💬 Setting clock out message:', message);
      
      setClockOutPromptMessage(message);
      setShowClockOutPrompt(true);
      
      console.log('✅ Clock out prompt state updated');
      
    } catch (error) {
      console.error('❌ Error getting clock out message:', error);
      const fallbackMessage = "How was your day? I'd love to hear about it!";
      console.log('💬 Using fallback message:', fallbackMessage);
      
      setClockOutPromptMessage(fallbackMessage);
      setShowClockOutPrompt(true);
    }
    
    console.log('🚪 ===== CLOCK OUT COMPLETE =====');
  };

  // Format time for display (hours and minutes)
  const formatTimeDisplay = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (wholeHours === 0 && minutes === 0) {
      return "0h 00m";
    } else if (wholeHours === 0) {
      return `${minutes}m`;
    } else if (minutes === 0) {
      return `${wholeHours}h`;
    } else {
      return `${wholeHours}h ${minutes.toString().padStart(2, '0')}m`;
    }
  };

  // Calculate progress percentage based on database hours, not current timer
  const getProgressPercentage = () => {
    const hoursWorked = todayHours; // Use database hours, not current timer
    return Math.min((hoursWorked / employeeSettings.maxHoursBeforeOvertime) * 100, 100);
  };

  // Get progress color based on database hours
  const getProgressColor = () => {
    const hoursWorked = todayHours; // Use database hours, not current timer
    if (hoursWorked > employeeSettings.maxHoursBeforeOvertime) {
      return "bg-red-500"; // Overtime
    } else if (hoursWorked > employeeSettings.maxHoursBeforeOvertime * 0.9) {
      return "bg-amber-500"; // Near overtime
    }
    return "bg-[#005cb3]"; // Normal
  };

  // Load requests from database
  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const fetchedRequests = await getEmployeeRequests(user?.id || "");
      setRequests(fetchedRequests);
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

  const filteredRequests = requests.filter(request => {
    const matchesFilter = requestFilter === "all" || request.status === requestFilter;
    const matchesSearch = 
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.request_date.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleLunchBreak = () => {
    if (!isClockedIn) {
      return; // Don't allow lunch break if not clocked in
    }
    
    const newLunchState = !isOnLunch;
    setIsOnLunch(newLunchState);
    
    // Control the timer through the global functions
    if (newLunchState) {
      // Starting lunch break - pause timer
      if ((window as any).pauseTimer) {
        (window as any).pauseTimer();
      }
    } else {
      // Ending lunch break - resume timer
      if ((window as any).resumeTimer) {
        (window as any).resumeTimer();
      }
    }
  };

  const getMaxHours = () => {
    return Math.max(...weeklyData.map(day => day.hoursWorked), 8);
  };

  const formatDate = (dateString: string) => {
    // Parse date string manually to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-based
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getUserName = () => {
    if (employeeData.loading) {
      return "Employee";
    }
    return employeeData.name;
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

  // 🔧 ENHANCED DEBUGGING: Props being passed to ChatInterface
  const chatProps = {
    onClockOutPrompt: showClockOutPrompt,
    clockOutPromptMessage: clockOutPromptMessage
  };
  
  console.log('🔧 ChatInterface props:', chatProps);

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

      {/* 🔧 ENHANCED DEBUGGING: Current State Display */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <h3 className="font-semibold text-blue-700 mb-2">🔧 Debug Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>showClockOutPrompt:</strong> {showClockOutPrompt.toString()}</p>
              <p><strong>clockOutPromptMessage:</strong> {clockOutPromptMessage ? 'Set' : 'Not set'}</p>
              <p><strong>User ID:</strong> {user?.id || 'Not loaded'}</p>
            </div>
            <div>
              <p><strong>timeStatus:</strong> {timeStatus}</p>
              <p><strong>isClockedIn:</strong> {isClockedIn.toString()}</p>
              <p><strong>First Name:</strong> {getFirstName()}</p>
            </div>
          </div>
          <div className="mt-2">
            <Button 
              onClick={handleClockOut}
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-100 mr-2"
            >
              🧪 Test Clock Out Message
            </Button>
            <Button 
              onClick={() => {
                console.log('🔧 Manual state reset triggered');
                setShowClockOutPrompt(false);
                setClockOutPromptMessage(undefined);
              }}
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Reset State
            </Button>
          </div>
        </CardContent>
      </Card>

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
                    Avg: {performanceData.avgRating}★
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
              console.log('🕐 TimeTracker onClockInChange:', clockedIn);
              setIsClockedIn(clockedIn);
            }} 
            onLunchChange={(lunch) => {
              console.log('🍽️ TimeTracker onLunchChange:', lunch);
              setIsOnLunch(lunch);
            }}
            onTimeUpdate={handleTimeUpdate}
            maxHoursBeforeOvertime={employeeSettings.maxHoursBeforeOvertime}
            hourlyRate={employeeSettings.hourlyRate}
            onClockOut={(data) => {
              console.log('🕐 TimeTracker onClockOut triggered with:', data);
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
                    ? "You&apos;re in overtime - earning 1x rate"
                    : (isClockedIn ? (currentElapsedTime / 3600) : todayHours) > employeeSettings.maxHoursBeforeOvertime * 0.8
                    ? "You&apos;ll be notified when you reach overtime"
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
                  {isClockedIn && livePay.overtimeHours > 0 && (
                    <span className="ml-2 text-amber-600">(Overtime: ${livePay.overtimePay.toFixed(2)})</span>
                  )}
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

      {/* 🔧 ENHANCED DEBUGGING: ChatInterface with debug info */}
      <div className="border-2 border-dashed border-purple-300 p-4 rounded-lg">
        <h3 className="text-purple-700 font-semibold mb-2">🔧 ChatInterface Debug Zone</h3>
        <p className="text-sm text-purple-600 mb-2">
          Props: onClockOutPrompt={showClockOutPrompt.toString()}, 
          clockOutPromptMessage={(clockOutPromptMessage ? 'SET' : 'UNSET')}
        </p>
        <ChatInterface 
          onClockOutPrompt={showClockOutPrompt}
          clockOutPromptMessage={clockOutPromptMessage}
        />
      </div>
    </div>
  );
}