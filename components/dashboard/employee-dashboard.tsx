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
  FileText
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
  type Request 
} from "@/lib/database";

interface EmployeeDashboardProps {
  initialTab?: string;
}

export function EmployeeDashboard({ initialTab = "overview" }: EmployeeDashboardProps) {
  const { user } = useUser();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isWeeklySummaryOpen, setIsWeeklySummaryOpen] = useState(false);
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
    if (user?.firstName) {
      return user.firstName;
    }
    return "Employee";
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
      if (!user?.id) return;
      
      try {
        const data = await getEmployeeRequests(user.id);
        setRequests(data);
      } catch (error) {
        console.error('Error loading requests:', error);
      } finally {
        setRequestsLoading(false);
      }
    };

    loadRequests();
  }, [user?.id]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {getUserName()}</h1>
        <p className="text-muted-foreground">
          Here's your performance overview and time tracking for today.
        </p>
      </div>

      {/* Performance Overview Cards (NO BONUS CARD) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Policies Sold</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {performanceData.loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">{performanceData.totalPolicies}</div>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {performanceData.loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">${performanceData.totalSales.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Revenue generated
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Client Reviews</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {performanceData.loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">{performanceData.totalReviews}</div>
                <p className="text-xs text-muted-foreground">
                  {performanceData.avgRating > 0 ? `Avg: ${performanceData.avgRating.toFixed(1)}/5` : 'No reviews yet'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <TimeTracker 
            onClockInChange={setIsClockedIn} 
            onLunchChange={setIsOnLunch}
            onTimeUpdate={handleTimeUpdate}
            maxHoursBeforeOvertime={employeeSettings.maxHoursBeforeOvertime}
            hourlyRate={employeeSettings.hourlyRate}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Hours</CardTitle>
          <CardDescription>
            Track your daily work hours and progress (Max: {employeeSettings.maxHoursBeforeOvertime}h before overtime)
          </CardDescription>
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
                    ? "You're in overtime - earning 1.5x rate"
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Requests & Communication</CardTitle>
              <CardDescription>Manage your requests and view approval status</CardDescription>
            </div>
            <Button 
              onClick={() => setRequestDialogOpen(true)}
              className="bg-[#005cb3] hover:bg-[#005cb3]/90"
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
                  <div className="p-4 bg-white dark:bg-card border rounded-lg">
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

      <Collapsible
        open={isWeeklySummaryOpen}
        onOpenChange={setIsWeeklySummaryOpen}
        className="bg-card rounded-lg border"
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="font-semibold">Weekly Summary</span>
            </div>
            {isWeeklySummaryOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4 pt-0 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Monday</p>
              <p className="text-sm text-muted-foreground">8:30 AM - 5:30 PM</p>
            </div>
            <div className="text-right">
              <p>8h 15m</p>
              <p className="text-sm text-muted-foreground">Regular Hours</p>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Tuesday</p>
              <p className="text-sm text-muted-foreground">9:00 AM - 5:45 PM</p>
            </div>
            <div className="text-right">
              <p>8h 30m</p>
              <p className="text-sm text-muted-foreground">Regular Hours</p>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Wednesday</p>
              <p className="text-sm text-muted-foreground">8:45 AM - 6:00 PM</p>
            </div>
            <div className="text-right">
              <p>8h 45m</p>
              <p className="text-sm text-muted-foreground">Regular Hours</p>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Today</p>
              <p className="text-sm text-muted-foreground">
                {timeStatus === "idle" ? "Not clocked in" : 
                 timeStatus === "lunch" ? "On lunch break" :
                 "Currently working"}
              </p>
            </div>
            <div className="text-right">
              <p>{timeStatus === "idle" ? "0h 00m" : formatTime(currentElapsedTime)}</p>
              <p className="text-sm text-muted-foreground">
                {timeStatus === "idle" ? "Not started" : "In Progress"}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

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