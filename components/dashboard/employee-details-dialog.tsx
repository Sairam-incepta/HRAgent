"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Calendar, BarChart, FileText, TrendingUp, DollarSign, Key } from "lucide-react";
import { getPolicySales, getClientReviews, getEmployeeBonus, getWeeklySummary, getTimeLogsForDay, getDailySummaries } from "@/lib/database";
import { PasswordResetDialog } from "./password-reset-dialog";
import { dashboardEvents } from "@/lib/events";
import { useUser } from '@clerk/nextjs';

interface EmployeeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    clerk_user_id: string;
    name: string;
    email: string;
    department: string;
    position: string;
    status: string;
  };
}

export function EmployeeDetailsDialog({
  open,
  onOpenChange,
  employee,
}: EmployeeDetailsDialogProps) {
  const [employeePolicies, setEmployeePolicies] = useState<any[]>([]);
  const [clientReviews, setClientReviews] = useState<any[]>([]);
  const [employeeBonus, setEmployeeBonus] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<Array<{
    date: string;
    dayName: string;
    hoursWorked: number;
    policiesSold: number;
    totalSales: number;
    isToday: boolean;
    isCurrentWeek: boolean;
    clockIn?: string;
    clockOut?: string;
  }>>([]);
  const [dailySummaries, setDailySummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [clockTimes, setClockTimes] = useState<Record<string, { firstIn: string | null, lastOut: string | null }>>({});

  // Calculate max daily hours once for consistent scaling across all progress bars
  const maxDailyHours = useMemo(() => {
    if (!weeklyData.length) return 12;
    const allDailyHours = weeklyData.map(d => d.hoursWorked);
    return Math.max(...allDailyHours, 12); // At least 12 hours for good visualization
  }, [weeklyData]);

  useEffect(() => {
    if (open && employee?.clerk_user_id) {
      loadEmployeeData();
    }
  }, [open, employee?.clerk_user_id]);

  // Listen for client review updates
  useEffect(() => {
    if (!open || !employee?.clerk_user_id) return;

    const handleClientReviewUpdate = () => {
      loadEmployeeData();
    };

    const handlePolicySaleUpdate = () => {
      loadEmployeeData();
    };

    // Subscribe to events and store cleanup functions
    const cleanupFunctions = [
      dashboardEvents.on('client_review', handleClientReviewUpdate),
      dashboardEvents.on('policy_sale', handlePolicySaleUpdate)
    ];

    return () => {
      // Call all cleanup functions
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [open, employee?.clerk_user_id]);

  useEffect(() => {
    async function fetchClockTimes() {
      if (!employee?.clerk_user_id || !weeklyData.length) return;
      const times: Record<string, { firstIn: string | null, lastOut: string | null }> = {};
      for (const day of weeklyData) {
        const logs = await getTimeLogsForDay(employee.clerk_user_id, day.date);
        if (logs && logs.length > 0) {
          logs.sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());
          const firstLog = logs[0];
          const lastLog = logs[logs.length - 1];
          times[day.date] = {
            firstIn: firstLog.clock_in ? new Date(firstLog.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
            lastOut: lastLog.clock_out ? new Date(lastLog.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
          };
        } else {
          times[day.date] = { firstIn: null, lastOut: null };
        }
      }
      setClockTimes(times);
    }
    fetchClockTimes();
  }, [employee?.clerk_user_id, weeklyData]);

  const loadEmployeeData = async () => {
    if (!employee?.clerk_user_id) return;
    
    setLoading(true);
    try {
      console.log('🔍 Loading employee data for:', employee.clerk_user_id);
      const [policies, reviews, bonus, weekly, summaries] = await Promise.all([
        getPolicySales(employee.clerk_user_id),
        getClientReviews(employee.clerk_user_id),
        getEmployeeBonus(employee.clerk_user_id),
        getWeeklySummary(employee.clerk_user_id),
        getDailySummaries(employee.clerk_user_id)
      ]);
      
      console.log('📊 Daily summaries loaded:', summaries.length, summaries);
      console.log('📋 Policies loaded:', policies.length);
      console.log('⭐ Reviews loaded:', reviews.length);
      console.log('📅 Weekly data loaded:', weekly.length);
      
      setEmployeePolicies(policies);
      setClientReviews(reviews);
      setEmployeeBonus(bonus);
      setWeeklyData(weekly);
      setDailySummaries(summaries);
    } catch (error) {
      console.error('Error loading employee data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPolicies = employeePolicies.length;
  const totalSales = employeePolicies.reduce((sum, policy) => sum + policy.amount, 0);
  const totalBonus = employeeBonus?.total_bonus || 0;
          const crossSoldCount = employeePolicies.filter(policy => policy.is_cross_sold_policy).length;

  const formatDate = (dateString: string) => {
    // Parse date string safely to avoid timezone issues (same fix as employee dashboard)
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    // Get today's date in the same format for comparison
    const today = new Date();
    const todayFormatted = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const isToday = date.getTime() === todayFormatted.getTime();
    
    if (isToday) {
      return "Today";
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes.toString().padStart(2, '0')}m`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {employee.name.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{employee.name}</h2>
                <p className="text-muted-foreground">{employee.email}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{employee.department}</Badge>
                  <Badge variant="outline">{employee.position}</Badge>
                  <Badge 
                    variant="outline"
                    className={
                      employee.status === "active" 
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : employee.status === "on_leave" 
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" 
                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                    }
                  >
                    {employee.status}
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPasswordResetOpen(true)}
                className="flex items-center gap-2"
              >
                <Key className="h-4 w-4" />
                Reset Password
              </Button>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="daily-hours">Daily Hours</TabsTrigger>
                <TabsTrigger value="daily-summaries">Daily Summaries</TabsTrigger>
                <TabsTrigger value="policies">Policies</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {loading ? (
                  <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-card rounded-lg border p-4 h-20">
                        <div className="animate-pulse flex items-center justify-between h-full">
                          <div className="flex flex-col justify-center space-y-2 flex-1">
                            <div className="h-3 bg-muted rounded w-2/3"></div>
                            <div className="h-6 bg-muted rounded w-1/3"></div>
                          </div>
                          <div className="h-8 w-8 bg-muted rounded-lg flex-shrink-0 ml-3"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                    {/* Policies Sold */}
                    <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow h-20">
                      <div className="flex items-center justify-between h-full">
                        <div className="flex flex-col justify-center min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground leading-tight truncate">Policies Sold</p>
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-semibold text-foreground leading-tight">{totalPolicies}</p>
                            <span className="text-xs text-muted-foreground">
                              {crossSoldCount} cross-sold
                            </span>
                          </div>
                        </div>
                        <div className="h-8 w-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
                          <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                      </div>
                    </div>

                                         {/* Total Sales */}
                     <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow h-20">
                       <div className="flex items-center justify-between h-full">
                         <div className="flex flex-col justify-center min-w-0 flex-1">
                           <p className="text-xs text-muted-foreground leading-tight truncate">Total Sales</p>
                           <p className="text-2xl font-semibold text-foreground leading-tight">${totalSales.toLocaleString()}</p>
                         </div>
                         <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
                           <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                         </div>
                       </div>
                     </div>

                     {/* Bonus Earned */}
                     <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow h-20">
                       <div className="flex items-center justify-between h-full">
                         <div className="flex flex-col justify-center min-w-0 flex-1">
                           <p className="text-xs text-muted-foreground leading-tight truncate">Bonus Earned</p>
                           <p className="text-2xl font-semibold text-foreground leading-tight">${totalBonus.toLocaleString()}</p>
                         </div>
                         <div className="h-8 w-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
                           <BarChart className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                         </div>
                       </div>
                     </div>

                    {/* Client Reviews */}
                    <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow h-20">
                      <div className="flex items-center justify-between h-full">
                        <div className="flex flex-col justify-center min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground leading-tight truncate">Client Reviews</p>
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-semibold text-foreground leading-tight">{clientReviews.length}</p>
                            <span className="text-xs text-muted-foreground">
                              {clientReviews.length > 0 
                                ? `Avg: ${(clientReviews.reduce((sum, r) => sum + r.rating, 0) / clientReviews.length).toFixed(2)}/5`
                                : 'No reviews'
                              }
                            </span>
                          </div>
                        </div>
                        <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
                          <FileText className="h-4 w-4 text-[#005cb3] dark:text-blue-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Activity List - Left Side */}
                        <div className="space-y-4">
                          {employeePolicies.slice(0, 3).map((policy, index) => (
                            <div key={index} className="flex items-center gap-4">
                              <div className="h-8 w-8 rounded-full bg-teal-600/10 flex items-center justify-center">
                                <FileText className="h-4 w-4 text-teal-600" />
                              </div>
                              <div>
                                <p className="font-medium">Policy Sale - {policy.policy_type}</p>
                                <p className="text-sm text-muted-foreground">
                                  {policy.client_name} - ${policy.amount.toLocaleString()} - {new Date(policy.sale_date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))}
                          {clientReviews.slice(0, 2).map((review, index) => (
                            <div key={`review-${index}`} className="flex items-center gap-4">
                              <div className="h-8 w-8 rounded-full bg-blue-600/10 flex items-center justify-center">
                                <BarChart className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium">Client Review - {review.rating}/5 stars</p>
                                <p className="text-sm text-muted-foreground">
                                  {review.client_name} - {new Date(review.review_date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))}
                          {employeePolicies.length === 0 && clientReviews.length === 0 && (
                            <p className="text-muted-foreground text-center py-4">No recent activity found.</p>
                          )}
                        </div>
                        
                        {/* Hours Visualization - Right Side */}
                        <div className="space-y-4">
                          <div className="bg-muted/50 rounded-lg p-8">
                            <h4 className="font-medium text-lg mb-6 flex items-center gap-2">
                              <Clock className="h-6 w-6" />
                              Weekly Hours Breakdown
                            </h4>
                            
                            {(() => {
                              const totalWeeklyHours = weeklyData.reduce((total, day) => total + day.hoursWorked, 0);
                              const weeklyOvertime = Math.max(0, totalWeeklyHours - 40);
                              const regularHours = Math.min(totalWeeklyHours, 40);
                              
                              return (
                                <div className="space-y-6">
                                  {/* Weekly Summary */}
                                  <div className="text-center space-y-3">
                                    <div className="text-3xl font-bold text-primary">
                                      {formatTime(totalWeeklyHours)}
                                    </div>
                                    <div className="text-base text-muted-foreground">
                                      Total Weekly Hours
                                    </div>
                                    {weeklyOvertime > 0 && (
                                      <div className="text-lg text-amber-600 font-semibold">
                                        {formatTime(weeklyOvertime)} overtime
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Weekly Progress Bar - Out of 40 hours */}
                                  <div className="space-y-3">
                                    <div className="flex justify-between text-base font-medium">
                                      <span>Weekly Hours</span>
                                      <span>{formatTime(totalWeeklyHours)} / 40h</span>
                                    </div>
                                    <div className="relative w-full bg-gray-200 rounded-full h-6">
                                      {/* Blue bar for regular hours (up to 40) */}
                                      <div 
                                        className="bg-blue-500 h-6 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min((regularHours / 40) * 100, 100)}%` }}
                                      ></div>
                                      {/* Orange overlay for overtime hours */}
                                      {weeklyOvertime > 0 && (
                                        <div 
                                          className="absolute top-0 left-0 bg-orange-500 h-6 rounded-full transition-all duration-500 opacity-80"
                                          style={{ width: `${Math.min((weeklyOvertime / 40) * 100, 100)}%` }}
                                        ></div>
                                      )}
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-blue-600">Regular: {formatTime(regularHours)}</span>
                                      {weeklyOvertime > 0 && (
                                        <span className="text-orange-600">Overtime: {formatTime(weeklyOvertime)}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          

                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="daily-hours" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Hours This Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-4">
                        {[...Array(7)].map((_, i) => (
                          <div key={i} className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2 pb-2 border-b">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Total Hours This Week</span>
                            <span className="font-bold text-lg">
                              {formatTime(weeklyData.reduce((total, day) => total + day.hoursWorked, 0))}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-amber-600">Total Overtime This Week</span>
                            <span className="font-bold text-lg text-amber-600">
                              {formatTime(Math.max(0, weeklyData.reduce((total, day) => total + day.hoursWorked, 0) - 40))}
                            </span>
                          </div>
                        </div>
                        
                        {/* Daily Hours with Progress Bars */}
                        <div className="space-y-3">
                          {weeklyData.map((day) => {
                            const dayClockTimes = clockTimes[day.date];
                              const isToday = day.isToday;
                              const hasClockData = dayClockTimes && (dayClockTimes.firstIn || dayClockTimes.lastOut);
                              
                              // Calculate overtime for this day (using 8-hour daily limit)
                              const dailyOvertimeLimit = 8;
                              const overtimeHours = Math.max(0, day.hoursWorked - dailyOvertimeLimit);
                              const regularHours = Math.min(day.hoursWorked, dailyOvertimeLimit);
                              
                              // Determine status for current day
                              let status = "Not worked";
                              if (day.hoursWorked > 0) {
                                if (isToday) {
                                  if (dayClockTimes?.firstIn && !dayClockTimes?.lastOut) {
                                    status = "Present";
                                  } else if (dayClockTimes?.firstIn && dayClockTimes?.lastOut) {
                                    status = "Completed";
                                  } else {
                                    status = "Present";
                                  }
                                } else {
                                  status = "Completed";
                                }
                              }
                            
                            return (
                              <div key={day.date} className="space-y-2">
                                {/* Date and Status Header */}
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-medium ${isToday ? 'text-[#005cb3]' : ''}`}>
                                      {formatDate(day.date)}
                                    </span>
                                    <span className="text-muted-foreground text-sm">
                                      {day.dayName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className="text-sm font-medium">
                                      {day.hoursWorked > 0 ? formatTime(day.hoursWorked) : '0h 00m'}
                                    </span>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${
                                        status === "Present" 
                                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                          : status === "Completed"
                                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                                      }`}
                                    >
                                      {status}
                                    </Badge>
                                  </div>
                                </div>
                                
                                {/* Progress Bar */}
                                <div className="space-y-1">
                                  <div className="relative bg-gray-200 rounded-full h-2">
                                    {/* Regular hours (green) */}
                                    <div 
                                      className="bg-green-500 h-2 rounded-full absolute left-0 top-0 transition-all duration-500"
                                      style={{ width: `${(regularHours / maxDailyHours) * 100}%` }}
                                    ></div>
                                    {/* Overtime hours (amber) - positioned after regular hours */}
                                    {overtimeHours > 0 && (
                                      <div 
                                        className="bg-amber-500 h-2 rounded-r-full absolute top-0 transition-all duration-500"
                                        style={{ 
                                          left: `${(regularHours / maxDailyHours) * 100}%`,
                                          width: `${(overtimeHours / maxDailyHours) * 100}%` 
                                        }}
                                      ></div>
                                    )}
                                  </div>
                                  
                                  {/* Time Details */}
                                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <div className="flex items-center gap-4">
                                      {dayClockTimes?.firstIn && (
                                        <span>In: {dayClockTimes.firstIn}</span>
                                      )}
                                      {dayClockTimes?.lastOut ? (
                                        <span>Out: {dayClockTimes.lastOut}</span>
                                      ) : isToday && dayClockTimes?.firstIn && (
                                        <span className="text-amber-600 font-medium">Currently Present</span>
                                      )}
                                    </div>
                                    {overtimeHours > 0 && (
                                      <span className="text-amber-600 font-medium">
                                        +{formatTime(overtimeHours)} OT
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="daily-summaries" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Summaries ({dailySummaries.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="animate-pulse border rounded-lg p-4">
                            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-3/4 mb-3"></div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="h-3 bg-gray-200 rounded"></div>
                              <div className="h-3 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : dailySummaries.length > 0 ? (
                      <div className="space-y-4">
                        {dailySummaries.map((summary, index) => {
                          // Get policies for this specific date
                          const summaryDate = new Date(summary.date).toDateString();
                          const dayPolicies = employeePolicies.filter(policy => 
                            new Date(policy.sale_date).toDateString() === summaryDate
                          );
                          const highNetworthPolicies = dayPolicies.filter(policy => policy.amount >= 100000);
                          
                          return (
                            <div key={index} className="border rounded-lg p-4 space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-semibold text-lg">
                                    {formatDate(summary.date)}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(summary.date).toLocaleDateString('en-US', { 
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium">
                                    Total Policies: <span className="text-[#005cb3]">{dayPolicies.length}</span>
                                  </p>
                                  {highNetworthPolicies.length > 0 && (
                                    <p className="text-sm font-medium">
                                      High Networth: <span className="text-amber-600">{highNetworthPolicies.length}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Hours Worked:</span>
                                  <span className="ml-2 font-medium">{formatTime(summary.hours_worked)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Policies Sold:</span>
                                  <span className="ml-2 font-medium">{summary.policies_sold}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Total Sales:</span>
                                  <span className="ml-2 font-medium">${summary.total_sales_amount.toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Broker Fees:</span>
                                  <span className="ml-2 font-medium">${summary.total_broker_fees.toLocaleString()}</span>
                                </div>
                              </div>
                              
                              {summary.description && (
                                <div className="bg-muted/50 rounded p-3">
                                  <p className="text-sm">
                                    <span className="font-medium">Summary:</span> {summary.description}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No daily summaries found.</p>
                        <p className="text-sm mt-2">Daily summaries are created when employees submit their end-of-day reports through the chat interface.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="policies" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Policies Sold ({totalPolicies})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse border rounded-lg p-4">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="h-3 bg-gray-200 rounded"></div>
                              <div className="h-3 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : employeePolicies.length > 0 ? (
                      <div className="space-y-4">
                        {employeePolicies.map((policy, index) => (
                          <div key={index} className="border rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold">{policy.policy_number}</h4>
                                <p className="text-sm text-muted-foreground">{policy.client_name}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">${policy.amount.toLocaleString()}</p>
                                <p className="text-sm text-muted-foreground">{new Date(policy.sale_date).toLocaleDateString()}</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Type:</span>
                                <span className="ml-2 font-medium">{policy.policy_type}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Broker Fee:</span>
                                <span className="ml-2 font-medium">${policy.broker_fee}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Bonus:</span>
                                <span className="ml-2 font-medium text-[#005cb3]">${policy.bonus}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Cross-sold:</span>
                                <span className="ml-2 font-medium">
                                  {policy.is_cross_sold_policy ? `Yes - ${policy.cross_sold_type}` : "No"}
                                </span>
                              </div>
                            </div>
                            
                            {policy.client_description && (
                              <div className="bg-muted/50 rounded p-3">
                                <p className="text-sm">
                                  <span className="font-medium">Client Notes:</span> {policy.client_description}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">No policies sold yet.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Client Reviews ({clientReviews.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse border rounded-lg p-4">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                            <div className="h-3 bg-gray-200 rounded w-full"></div>
                          </div>
                        ))}
                      </div>
                    ) : clientReviews.length > 0 ? (
                      <div className="space-y-4">
                        {clientReviews.map((review, index) => (
                          <div key={index} className="border rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold">{review.client_name}</h4>
                                <p className="text-sm text-muted-foreground">Policy: {review.policy_number}</p>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <span key={i} className={`text-sm ${i < review.rating ? 'text-yellow-500' : 'text-gray-300'}`}>
                                      ★
                                    </span>
                                  ))}
                                  <span className="ml-1 text-sm font-medium">{review.rating}/5</span>
                                </div>
                                <p className="text-sm text-muted-foreground">{new Date(review.review_date).toLocaleDateString()}</p>
                              </div>
                            </div>
                            
                            <div className="bg-muted/50 rounded p-3">
                              <p className="text-sm">"{review.review}"</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">No client reviews yet.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
      {passwordResetOpen && (
        <PasswordResetDialog
          open={passwordResetOpen}
          onOpenChange={setPasswordResetOpen}
          employeeId={employee.clerk_user_id}
          employeeName={employee.name}
          employeeEmail={employee.email}
        />
      )}
    </>
  );
}