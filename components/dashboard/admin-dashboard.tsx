"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Users, 
  Clock, 
  CreditCard, 
  ArrowRight, 
  FileText, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  Building,
  Eye,
  AlertTriangle,
  MessageSquare,
  UserPlus
} from "lucide-react";
import { EmployeeTable } from "@/components/dashboard/employee-table";
import { AdminStats } from "@/components/dashboard/admin-stats";
import { AdminRequests } from "@/components/dashboard/admin-requests";
import { HighValuePolicyNotifications } from "@/components/dashboard/high-value-policy-notifications";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PayrollDialog } from "@/components/dashboard/payroll-dialog";
import { CompanyPayrollDialog } from "@/components/dashboard/company-payroll-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEmployees, getPolicySales, getPayrollPeriods, getHighValuePolicyNotificationsList, getAllRequests, type PayrollPeriod } from "@/lib/database";
import type { HighValuePolicyNotification } from "@/lib/supabase";
import { dashboardEvents } from "@/lib/events";

export function AdminDashboard() {
  const [isWeeklySummaryOpen, setIsWeeklySummaryOpen] = useState(false);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [companyPayrollDialogOpen, setCompanyPayrollDialogOpen] = useState(false);

  const [selectedPayrollPeriod, setSelectedPayrollPeriod] = useState("");
  const [expenditureFilter, setExpenditureFilter] = useState("month");
  const [expenditureData, setExpenditureData] = useState({
    month: { amount: 0, period: "May 2025", change: "+0%" },
    quarter: { amount: 0, period: "Q2 2025", change: "+0%" },
    year: { amount: 0, period: "2025", change: "+0%" }
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [policySales, setPolicySales] = useState<any[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [highValueNotifications, setHighValueNotifications] = useState<HighValuePolicyNotification[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [stablePendingCount, setStablePendingCount] = useState(0);

  // Add ref for scrolling to high-value notifications
  const highValueNotificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh data every 15 seconds with background loading to minimize visible refresh
  useEffect(() => {
    const interval = setInterval(() => {
      // Use a more subtle refresh that doesn't show loading states
      loadData(true); // Background refresh
    }, 15000); // Reduced from 30 seconds to 15 seconds

    return () => clearInterval(interval);
  }, []);

  // Listen for real-time events
  useEffect(() => {
    const handlePolicySale = () => {
      loadData(true); // Silent refresh when new policy is added
    };

    const handleClientReview = () => {
      loadData(true); // Silent refresh when new review is added
    };

    const handleRequest = () => {
      loadData(true); // Silent refresh when new request is added
    };

    const handleHighValuePolicyUpdate = () => {
      loadData(true); // Silent refresh when high-value policies are updated (resolved/unresolved)
    };

    // Subscribe to events and store cleanup functions
    const cleanupFunctions = [
      dashboardEvents.on('policy_sale', handlePolicySale),
      dashboardEvents.on('client_review', handleClientReview),
      dashboardEvents.on('request_submitted', handleRequest),
      dashboardEvents.on('high_value_policy_updated', handleHighValuePolicyUpdate)
    ];

    return () => {
      // Call all cleanup functions
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, []);

  const loadData = async (silentUpdate = false) => {
    if (!silentUpdate) {
      setLoading(true);
    }
    
    try {
      const [employeesData, salesData, periodsData, notificationsData, requestsData] = await Promise.all([
        getEmployees(),
        getPolicySales(),
        getPayrollPeriods(),
        getHighValuePolicyNotificationsList(),
        getAllRequests()
      ]);
      
      setEmployees(employeesData);
      setPolicySales(salesData);
      setPayrollPeriods(periodsData);
      setHighValueNotifications(notificationsData);
      
      // Count pending requests
      const pendingCount = requestsData.filter(req => req.status === 'pending').length;
      setPendingRequestsCount(pendingCount);
      
      // Update stable count for high-value policies (exclude resolved)
      const unresolvedCount = notificationsData.filter(n => n.status !== 'resolved').length;
      setStablePendingCount(unresolvedCount);
      
      if (!hasInitiallyLoaded) {
        setHasInitiallyLoaded(true);
      }
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      if (!silentUpdate) {
        setLoading(false);
      }
    }
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

  const currentExpenditure = expenditureData[expenditureFilter as keyof typeof expenditureData];

  const handleCompanyPayrollView = (period: string) => {
    setSelectedPayrollPeriod(period);
    setCompanyPayrollDialogOpen(true);
  };

  const handleReviewNowClick = () => {
    if (highValueNotificationsRef.current) {
      highValueNotificationsRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // Use stable count to prevent flicker during refreshes - exclude resolved policies
  const pendingHighValueCount = hasInitiallyLoaded ? stablePendingCount : highValueNotifications.filter(n => n.status !== 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Header with Live Date/Time */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
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

      {/* High-Value Policy Alert */}
      {pendingHighValueCount > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5" />
              High-Value Policy Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-700 dark:text-amber-300">
                  <strong>{pendingHighValueCount}</strong> policies over $5,000 require manual bonus review
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  These employees need their bonuses manually set for high-value policies
                </p>
              </div>
              <Button 
                variant="outline" 
                className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30"
                onClick={handleReviewNowClick}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Review Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employee-overview">Employee Overview</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <AdminStats />
          
          {/* Company Expenditure - Compact Top Section */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">Company Expenditure</h3>
                    {loading ? (
                      <div className="animate-pulse space-y-1 mt-1">
                        <div className="h-6 bg-muted rounded w-24"></div>
                        <div className="h-3 bg-muted rounded w-16"></div>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <p className="text-2xl font-bold">${currentExpenditure.amount.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{currentExpenditure.period}</p>
                      </div>
                    )}
                  </div>
                  {!loading && (
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      >
                        {currentExpenditure.change}
                      </Badge>
                      <span className="text-xs text-muted-foreground">vs previous</span>
                    </div>
                  )}
                </div>
                <Select value={expenditureFilter} onValueChange={setExpenditureFilter}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="quarter">Quarterly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* High-Value Policy Alerts - Full Width Below */}
          <div ref={highValueNotificationsRef} data-section="high-value-policies">
            <HighValuePolicyNotifications />
          </div>

          {/* Requests Section */}
          <div data-section="requests">
            <AdminRequests pendingCount={pendingRequestsCount} />
          </div>
        </TabsContent>

        <TabsContent value="employee-overview" className="space-y-4">
          {/* Employee Directory */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Directory</CardTitle>
            </CardHeader>
            <CardContent>
              <EmployeeTable showInOverview={true} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bi-Weekly Payroll Reports</CardTitle>
              <CardDescription>View company-wide payroll reports every 2 weeks</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-200 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {payrollPeriods.map((payroll, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-4 bg-white dark:bg-card border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-card/80 transition-colors"
                      onClick={() => handleCompanyPayrollView(payroll.period)}
                    >
                      <div className="flex items-center gap-3">
                        {payroll.status === "current" ? (
                          <Building className="h-8 w-8 text-[#005cb3]" />
                        ) : (
                          <FileText className="h-8 w-8 text-[#005cb3]" />
                        )}
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            <span>{payroll.period} Payroll</span>
                            {payroll.status === "current" && (
                              <Badge className="bg-[#005cb3] hover:bg-[#005cb3]/90 text-xs">Current Period</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {payroll.employees} employees, ${payroll.total.toLocaleString()} total expenditure
                          </p>
                          {payroll.details && (
                            <p className="text-xs text-muted-foreground">
                              {Math.round(payroll.details.regularHours + payroll.details.overtimeHours)}h total, 
                              {payroll.details.totalSales} policies sold, 
                              ${payroll.details.totalBonuses.toLocaleString()} bonuses
                            </p>
                          )}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        className={payroll.status === "current" ? "bg-[#005cb3] hover:bg-[#005cb3]/90" : ""}
                        variant={payroll.status === "current" ? "default" : "outline"}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">Bi-Weekly Payroll Schedule</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Payroll reports are automatically calculated every 2 weeks. Company expenditure includes total employee compensation, bonuses, and overtime pay.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PayrollDialog 
        open={payrollDialogOpen} 
        onOpenChange={setPayrollDialogOpen} 
      />

      <CompanyPayrollDialog
        open={companyPayrollDialogOpen}
        onOpenChange={setCompanyPayrollDialogOpen}
        payrollPeriod={selectedPayrollPeriod}
      />


    </div>
  );
}