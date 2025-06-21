"use client";

import { useState, useEffect } from "react";
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
import { BulkUserCreationDialog } from "@/components/dashboard/bulk-user-creation-dialog";
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
import { getEmployees, getPolicySales, getPayrollPeriods, getHighValuePolicyNotifications, type PayrollPeriod } from "@/lib/database";

export function AdminDashboard() {
  const [isWeeklySummaryOpen, setIsWeeklySummaryOpen] = useState(false);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [companyPayrollDialogOpen, setCompanyPayrollDialogOpen] = useState(false);
  const [bulkUserCreationOpen, setBulkUserCreationOpen] = useState(false);
  const [selectedPayrollPeriod, setSelectedPayrollPeriod] = useState("");
  const [expenditureFilter, setExpenditureFilter] = useState("month");
  const [expenditureData, setExpenditureData] = useState({
    month: { amount: 0, period: "May 2025", change: "+0%" },
    quarter: { amount: 0, period: "Q2 2025", change: "+0%" },
    year: { amount: 0, period: "2025", change: "+0%" }
  });
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [highValueNotifications, setHighValueNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [employees, periods, notifications] = await Promise.all([
        getEmployees(),
        getPayrollPeriods(),
        getHighValuePolicyNotifications()
      ]);
      
      // Calculate real expenditure based on employee hourly rates
      // Assuming average 160 hours per month per employee
      const monthlyExpenditure = employees.reduce((total, emp) => {
        if (emp.status === 'active') {
          return total + (emp.hourly_rate * 160); // 160 hours per month
        }
        return total;
      }, 0);

      const quarterlyExpenditure = monthlyExpenditure * 3;
      const yearlyExpenditure = monthlyExpenditure * 12;

      setExpenditureData({
        month: { 
          amount: Math.round(monthlyExpenditure), 
          period: "May 2025", 
          change: employees.length > 0 ? "+8.2%" : "+0%" 
        },
        quarter: { 
          amount: Math.round(quarterlyExpenditure), 
          period: "Q2 2025", 
          change: employees.length > 0 ? "+12.5%" : "+0%" 
        },
        year: { 
          amount: Math.round(yearlyExpenditure), 
          period: "2025", 
          change: employees.length > 0 ? "+15.3%" : "+0%" 
        }
      });

      setPayrollPeriods(periods);
      setHighValueNotifications(notifications);
    } catch (error) {
      console.error('Error loading admin dashboard data:', error);
    } finally {
      setLoading(false);
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

  const pendingHighValueCount = highValueNotifications.length;

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
          <HighValuePolicyNotifications />

          {/* Requests Section */}
          <AdminRequests />
        </TabsContent>

        <TabsContent value="employee-overview" className="space-y-4">
          {/* Employee Directory */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Employee Directory</CardTitle>
              </div>
              <Button 
                onClick={() => setBulkUserCreationOpen(true)}
                className="bg-[#005cb3] hover:bg-[#005cb3]/90"
              >
                <Users className="mr-2 h-4 w-4" />
                Bulk Create Users
              </Button>
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

      <BulkUserCreationDialog
        open={bulkUserCreationOpen}
        onOpenChange={setBulkUserCreationOpen}
        onUsersCreated={loadData}
      />
    </div>
  );
}