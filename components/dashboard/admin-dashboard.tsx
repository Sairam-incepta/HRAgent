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
  Building
} from "lucide-react";
import { EmployeeTable } from "@/components/dashboard/employee-table";
import { AdminStats } from "@/components/dashboard/admin-stats";
import { AdminRequests } from "@/components/dashboard/admin-requests";
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
import { getEmployees, getPolicySales, getPayrollPeriods, type PayrollPeriod } from "@/lib/database";

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
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [employees, periods] = await Promise.all([
        getEmployees(),
        getPayrollPeriods()
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
    } catch (error) {
      console.error('Error loading admin dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentExpenditure = expenditureData[expenditureFilter as keyof typeof expenditureData];

  const handleCompanyPayrollGenerate = (period: string) => {
    setSelectedPayrollPeriod(period);
    setCompanyPayrollDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage employees, track time, and generate reports.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <AdminStats />
          
          {/* Expenditure Card with Filter */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Company Expenditure</CardTitle>
                <CardDescription>Track spending across different time periods</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={expenditureFilter} onValueChange={setExpenditureFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="quarter">Quarterly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">${currentExpenditure.amount.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{currentExpenditure.period}</p>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant="outline" 
                      className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    >
                      {currentExpenditure.change}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">vs previous period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Employee Table with Filter */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Employee Directory</CardTitle>
                <CardDescription>Manage and view all employees with status filters</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <EmployeeTable showInOverview={true} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <AdminRequests />
        </TabsContent>
        
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bi-Weekly Payroll Reports</CardTitle>
              <CardDescription>Generate company-wide payroll reports every 2 weeks</CardDescription>
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
                      onClick={() => handleCompanyPayrollGenerate(payroll.period)}
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
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        className={payroll.status === "current" ? "bg-[#005cb3] hover:bg-[#005cb3]/90" : ""}
                        variant={payroll.status === "current" ? "default" : "outline"}
                      >
                        Generate
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
                      Payroll reports are automatically generated every 2 weeks. Company expenditure is calculated based on total employee compensation.
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