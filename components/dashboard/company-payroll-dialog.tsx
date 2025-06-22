"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Users, TrendingUp, Clock, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPayrollPeriodDetails } from "@/lib/database";

interface CompanyPayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrollPeriod?: string;
}

export function CompanyPayrollDialog({ open, onOpenChange, payrollPeriod }: CompanyPayrollDialogProps) {
  const [payrollData, setPayrollData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && payrollPeriod) {
      // Auto-load data when dialog opens
      loadPayrollData();
    }
  }, [open, payrollPeriod]);

  const loadPayrollData = async () => {
    if (!payrollPeriod) return;
    
    setLoading(true);
    try {
      // Parse the period to get start and end dates
      // For simplicity, we'll calculate the last 14 days from today for current period
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 13);
      
      const details = await getPayrollPeriodDetails(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      // Group employees by department
      const departmentMap = new Map();
      details.employees.forEach(emp => {
        if (!departmentMap.has(emp.department)) {
          departmentMap.set(emp.department, {
            employees: 0,
            totalPay: 0,
            totalHours: 0,
            totalSales: 0
          });
        }
        const dept = departmentMap.get(emp.department);
        dept.employees += 1;
        dept.totalPay += emp.totalPay;
        dept.totalHours += emp.regularHours + emp.overtimeHours;
        dept.totalSales += emp.salesAmount;
      });

      const departmentBreakdown = Array.from(departmentMap.entries()).map(([dept, data]) => ({
        department: dept,
        employees: data.employees,
        totalPay: Math.round(data.totalPay),
        avgHours: Math.round((data.totalHours / data.employees) * 10) / 10,
        totalSales: data.totalSales
      }));

      setPayrollData({
        payPeriod: payrollPeriod,
        summary: details.summary,
        departmentBreakdown,
        topPerformers: details.employees
          .filter(emp => emp.salesAmount > 0)
          .sort((a, b) => b.salesAmount - a.salesAmount)
          .slice(0, 3)
      });
    } catch (error) {
      console.error('Error loading payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPayrollData(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Company Payroll Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#005cb3]"></div>
              <span className="ml-3">Loading payroll data...</span>
            </div>
          ) : payrollData ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-[#005cb3]/10 mx-auto flex items-center justify-center">
                  <FileText className="h-6 w-6 text-[#005cb3]" />
                </div>
                <h3 className="text-lg font-semibold">Company Payroll Report</h3>
                <p className="text-sm text-muted-foreground">Pay Period: {payrollData.payPeriod}</p>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Users className="h-6 w-6 mx-auto mb-2 text-[#005cb3]" />
                    <div className="text-2xl font-bold">{payrollData.summary.totalEmployees}</div>
                    <div className="text-xs text-muted-foreground">Employees</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="h-6 w-6 mx-auto mb-2 text-[#005cb3]" />
                    <div className="text-2xl font-bold">{Math.round(payrollData.summary.totalRegularHours)}</div>
                    <div className="text-xs text-muted-foreground">Total Hours</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 text-[#005cb3]" />
                    <div className="text-2xl font-bold">{payrollData.summary.totalSales}</div>
                    <div className="text-xs text-muted-foreground">Policies Sold</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <DollarSign className="h-6 w-6 mx-auto mb-2 text-[#005cb3]" />
                    <div className="text-2xl font-bold">${Math.round(payrollData.summary.totalBonuses).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Total Bonuses</div>
                  </CardContent>
                </Card>
              </div>

              {/* Company Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Payroll Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Hours:</span>
                        <span className="text-sm font-medium">{Math.round(payrollData.summary.totalRegularHours)} hrs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Base Pay:</span>
                        <span className="text-sm font-medium">${Math.round(payrollData.summary.totalRegularPay).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Sales Bonuses:</span>
                        <span className="text-sm font-medium">${Math.round(payrollData.summary.totalBonuses).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Pay:</span>
                        <span className="text-sm font-medium">${Math.round(payrollData.summary.totalPay).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Avg Hourly Rate:</span>
                        <span className="text-sm font-medium">${(payrollData.summary.totalRegularPay / payrollData.summary.totalRegularHours || 0).toFixed(2)}/hr</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Sales:</span>
                        <span className="text-sm font-medium">${Math.round(payrollData.summary.totalSalesAmount).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Department Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Department Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {payrollData.departmentBreakdown.map((dept: any, index: number) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{dept.department}</h4>
                        <Badge variant="outline">{dept.employees} employees</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total Pay:</span>
                          <div className="font-medium">${dept.totalPay.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Hours:</span>
                          <div className="font-medium">{dept.avgHours}h</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sales:</span>
                          <div className="font-medium">${dept.totalSales.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Top Performers */}
              {payrollData.topPerformers && payrollData.topPerformers.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Top Sales Performers</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {payrollData.topPerformers.map((performer: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <div>
                          <div className="font-medium">{performer.name}</div>
                          <div className="text-sm text-muted-foreground">{performer.department}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${performer.salesAmount.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">{performer.salesCount} policies</div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Total Expenditure */}
              <Card className="bg-[#005cb3]/5 border-[#005cb3]/20">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Total Company Expenditure:</span>
                      <span className="text-2xl font-bold text-[#005cb3]">${Math.round(payrollData.summary.totalPay).toLocaleString()}</span>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">
                        Bi-weekly payroll period: {payrollData.payPeriod}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleClose}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <Users className="mx-auto h-12 w-12 text-[#005cb3]" />
              <p className="text-lg font-medium">
                View company-wide payroll report
              </p>
              <p className="text-sm text-muted-foreground">
                This will show a comprehensive payroll report for all employees for the period: {payrollPeriod}
              </p>
              <Button 
                onClick={loadPayrollData}
                className="w-full bg-[#005cb3] hover:bg-[#005cb3]/90"
              >
                View Company Report
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}