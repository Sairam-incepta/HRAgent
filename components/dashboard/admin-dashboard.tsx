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
import { 
  getEmployees, 
  getPolicySales, 
  getPayrollPeriods, 
  getHighValuePolicyNotificationsList,
  getAllRequests,
  debugDatabaseContents,
  type PayrollPeriod
} from "@/lib/database";
import type { HighValuePolicyNotification } from "@/lib/supabase";
import { dashboardEvents } from "@/lib/events";
import { useToast } from "@/hooks/use-toast";

export function AdminDashboard() {
  const { toast } = useToast();
  const [isWeeklySummaryOpen, setIsWeeklySummaryOpen] = useState(false);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [companyPayrollDialogOpen, setCompanyPayrollDialogOpen] = useState(false);

  const [selectedPayrollPeriod, setSelectedPayrollPeriod] = useState("");
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
      console.log('🔔 AdminDashboard: Received high_value_policy_updated event, refreshing data...');
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
    
    console.log('🔄 AdminDashboard: Loading data...', { silentUpdate });
    
    try {
      // Debug database contents
      await debugDatabaseContents();
      
      const [employeesData, salesData, periodsData, notificationsData, requestsData] = await Promise.all([
        getEmployees(),
        getPolicySales(),
        getPayrollPeriods(),
        getHighValuePolicyNotificationsList(),
        getAllRequests()
      ]);
      
      console.log('🔄 AdminDashboard: Loaded notifications:', notificationsData.length, notificationsData.map(n => ({
        id: n.id,
        policy_number: n.policy_number,
        status: n.status
      })));
      
      setEmployees(employeesData);
      setPolicySales(salesData);
      
      // Filter periods to only show ones with actual data or current/upcoming periods
      const filteredPeriods = periodsData.filter(period => {
        // Always show current and upcoming periods
        if (period.status === 'current' || period.status === 'upcoming') {
          return true;
        }
        // For completed periods, only show if there's actual data (hours worked or sales)
        return period.details.regularHours > 0 || period.details.totalSales > 0;
      });
      
      setPayrollPeriods(filteredPeriods);
      setHighValueNotifications(notificationsData);
      
      // Count pending requests
      const pendingRequestCount = requestsData.filter(req => req.status === 'pending').length;
      setPendingRequestsCount(pendingRequestCount);
      
      // Update stable count for high-value policies (only pending ones)
      const pendingHighValueCount = notificationsData.filter(n => n.status === 'pending').length;
      console.log('🔄 AdminDashboard: Setting pending count to:', pendingHighValueCount);
      setStablePendingCount(pendingHighValueCount);
      

      
      if (!hasInitiallyLoaded) {
        setHasInitiallyLoaded(true);
      }
      
    } catch (error) {
      console.error('❌ AdminDashboard: Error loading dashboard data:', error);
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



  const handleCompanyPayrollView = (period: string) => {
    // Find the payroll period to check if it's upcoming
    const payrollPeriod = payrollPeriods.find(p => p.period === period);
    
    if (payrollPeriod?.status === 'upcoming') {
      // Show toast message for upcoming periods
      toast({
        title: "Payroll Not Yet Generated",
        description: "Pay period has not begun. Payroll data will be available once the period starts.",
      });
      return;
    }
    
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

  // Use stable count to prevent flicker during refreshes - only pending policies
  const pendingHighValueCount = hasInitiallyLoaded ? stablePendingCount : highValueNotifications.filter(n => n.status === 'pending').length;

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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employee-overview">Employee Overview</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <AdminStats />
          


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
                        ) : payroll.status === "upcoming" ? (
                          <Calendar className="h-8 w-8 text-gray-400" />
                        ) : (
                          <FileText className="h-8 w-8 text-[#005cb3]" />
                        )}
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            <span>{payroll.period} Payroll</span>
                            {payroll.status === "current" && (
                              <Badge className="bg-[#005cb3] hover:bg-[#005cb3]/90 text-xs">Current Period</Badge>
                            )}
                            {payroll.status === "upcoming" && (
                              <Badge variant="outline" className="text-xs text-gray-500">Upcoming</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {payroll.status === "upcoming" ? (
                              `${payroll.employees} employees - Pay period has not begun`
                            ) : (
                              `${payroll.employees} employees, $${payroll.total.toLocaleString()} total expenditure`
                            )}
                          </p>
                          {payroll.details && payroll.status !== "upcoming" && (
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
                        disabled={payroll.status === "upcoming"}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        {payroll.status === "upcoming" ? "Not Available" : "View"}
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
                      Payroll reports are automatically calculated every 2 weeks. Company expenditure includes total employee compensation and bonuses.
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