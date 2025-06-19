'use client';

import { useState, useEffect } from "react";
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
  type Request 
} from "@/lib/database";

interface EmployeeDashboardProps {
  initialTab?: string;
  onClockOut?: () => void;
}

export function EmployeeDashboard({ initialTab = "overview", onClockOut }: EmployeeDashboardProps) {
  const { user } = useUser();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const [requestFilter, setRequestFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isOnLunch, setIsOnLunch] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  
  // Time tracking state
  const [currentElapsedTime, setCurrentElapsedTime] = useState(0);
  const [timeStatus, setTimeStatus] = useState<"idle" | "working" | "lunch" | "overtime_pending">("idle");
  
  // Requests state
  const [requests, setRequests] = useState<Request[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  // Weekly summary state
  const [weeklyData, setWeeklyData] = useState<Array<{
    date: string;
    dayName: string;
    hoursWorked: number;
    policiesSold: number;
    totalSales: number;
    isToday: boolean;
    isCurrentWeek: boolean;
  }>>([]);

  // Employee performance data (NO BONUS INFORMATION)
  const [performanceData, setPerformanceData] = useState({
    totalPolicies: 0,
    totalSales: 0,
    totalReviews: 0,
    avgRating: 0,
    loading: true
  });

  const { toast } = useToast();

  // Mock employee settings - in real app, this would come from database
  const employeeSettings = {
    maxHoursBeforeOvertime: 8,
    hourlyRate: 25
  };

  const getUserName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    return "Employee";
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Load employee performance data (NO BONUS INFORMATION)
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (!user?.id) return;
      
      try {
        const [policySales, clientReviews, dailySummaries] = await Promise.all([
          getPolicySales(user.id),
          getClientReviews(user.id),
          getDailySummaries(user.id)
        ]);

        const totalSales = policySales.reduce((sum, sale) => sum + sale.amount, 0);
        const avgRating = clientReviews.length > 0 
          ? clientReviews.reduce((sum, review) => sum + review.rating, 0) / clientReviews.length 
          : 0;

        setPerformanceData({
          totalPolicies: policySales.length,
          totalSales,
          totalReviews: clientReviews.length,
          avgRating,
          loading: false
        });
      } catch (error) {
        console.error('Error loading performance data:', error);
        setPerformanceData(prev => ({ ...prev, loading: false }));
      }
    };

    loadPerformanceData();
  }, [user?.id]);

  // Handle time tracker updates
  const handleTimeUpdate = (elapsedSeconds: number, status: string) => {
    setCurrentElapsedTime(elapsedSeconds);
    setTimeStatus(status as any);
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  };

  // Calculate progress percentage
  const getProgressPercentage = () => {
    const hoursWorked = currentElapsedTime / 3600;
    return Math.min((hoursWorked / employeeSettings.maxHoursBeforeOvertime) * 100, 100);
  };

  // Get progress color based on status
  const getProgressColor = () => {
    const hoursWorked = currentElapsedTime / 3600;
    if (hoursWorked > employeeSettings.maxHoursBeforeOvertime) {
      return "bg-red-500"; // Overtime
    } else if (hoursWorked > employeeSettings.maxHoursBeforeOvertime * 0.9) {
      return "bg-amber-500"; // Near overtime
    }
    return "bg-[#005cb3]"; // Normal
  };

  // Load requests from database
  useEffect(() => {
    const loadRequests = async () => {
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

    const loadWeeklyData = async () => {
      if (!user?.id) return;
      
      try {
        const data = await getWeeklySummary(user.id);

        setWeeklyData(data);
      } catch (error) {
        console.error('Error loading weekly data:', error);
      }
    };

    if (user?.id) {
      loadRequests();
      loadWeeklyData();
    }
  }, [user?.id, toast]);

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

  return (
    <div className="space-y-6">
      {/* Header with Live Date/Time */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {getUserName()}</h1>
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
        {performanceData.loading ? (
          // Loading state
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-6 bg-muted rounded w-1/3"></div>
              </div>
            </div>
          ))
        ) : (
          <>
            {/* Policies Sold */}
            <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Policies Sold</p>
                  <p className="text-xl font-semibold text-foreground">{performanceData.totalPolicies}</p>
                </div>
                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-[#005cb3] dark:text-blue-400" />
                </div>
              </div>
            </div>

            {/* Total Sales */}
            <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue from Sales</p>
                  <p className="text-xl font-semibold text-foreground">${performanceData.totalSales.toLocaleString()}</p>
                </div>
                <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            {/* Client Reviews */}
            <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Reviews</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-semibold text-foreground">{performanceData.totalReviews}</p>
                    {performanceData.avgRating > 0 && (
                      <span className="text-sm text-muted-foreground">
                        ({performanceData.avgRating.toFixed(1)}★)
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 w-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
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
            onClockInChange={setIsClockedIn} 
            onLunchChange={setIsOnLunch}
            onTimeUpdate={handleTimeUpdate}
            maxHoursBeforeOvertime={employeeSettings.maxHoursBeforeOvertime}
            hourlyRate={employeeSettings.hourlyRate}
            onClockOut={onClockOut}
          />
        </div>
      </div>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Today's Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Hours Worked</span>
                <span className="text-sm">
                  {timeStatus === "idle" ? "0h 00m" : formatTime(currentElapsedTime)} / {employeeSettings.maxHoursBeforeOvertime}h 00m
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
                    : currentElapsedTime / 3600 > employeeSettings.maxHoursBeforeOvertime
                    ? "You're in overtime - earning 1x rate"
                    : "You'll be notified when you reach overtime"
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
                      {request.current_overtime_hours && (
                        <p className="text-sm">
                          <span className="font-medium">Current Overtime:</span> {request.current_overtime_hours} hours
                        </p>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {requests.length === 0 ? "No requests submitted yet." : "No requests found matching your filters."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#005cb3]" />
            <CardTitle>This Week's Performance</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Hours Worked by Day</h4>
            <div className="text-sm text-muted-foreground">
              {weeklyData.reduce((total, day) => total + day.hoursWorked, 0).toFixed(1)}h total
            </div>
          </div>
          
          {/* Vertical Bar Chart Container */}
          <div className="flex items-end justify-between gap-2 h-40 bg-muted/10 rounded-lg p-4">
            {weeklyData.map((day) => {
              const maxHours = getMaxHours();
              const percentage = maxHours > 0 ? (day.hoursWorked / maxHours) * 100 : 0;
              const isToday = day.isToday;
              
              // Format hours and minutes
              const hours = Math.floor(day.hoursWorked);
              const minutes = Math.round((day.hoursWorked - hours) * 60);
              const timeDisplay = hours === 0 && minutes === 0 
                ? "0hrs" 
                : minutes === 0 
                  ? `${hours}hrs`
                  : hours === 0
                    ? `${minutes}mins`
                    : `${hours}hrs ${minutes}mins`;
              
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
        onOpenChange={setRequestDialogOpen} 
      />

      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />
    </div>
  );
}