"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Clock, DollarSign, TrendingUp, Calendar } from "lucide-react";
import { getEmployeePayrollHistory, getEmployee, formatHoursMinutes } from "@/lib/database";
import { dashboardEvents } from "@/lib/events";

interface EmployeePayrollHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
}

export function EmployeePayrollHistoryDialog({ 
  open, 
  onOpenChange, 
  employeeId 
}: EmployeePayrollHistoryDialogProps) {
  const [payrollHistory, setPayrollHistory] = useState<any[]>([]);
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && employeeId) {
      loadPayrollHistory();
    }
  }, [open, employeeId]);

  // Listen for high value policy updates to refresh payroll data
  useEffect(() => {
    const handleHighValuePolicyUpdate = () => {
      if (open && employeeId) {
        loadPayrollHistory();
      }
    };

    const cleanup = dashboardEvents.on('high_value_policy_updated', handleHighValuePolicyUpdate);
    return cleanup;
  }, [open, employeeId]);

  const loadPayrollHistory = async () => {
    if (!employeeId) return;
    
    setLoading(true);
    try {
      const [history, empData] = await Promise.all([
        getEmployeePayrollHistory(employeeId),
        getEmployee(employeeId)
      ]);
      
      setPayrollHistory(history);
      setEmployee(empData);
    } catch (error) {
      console.error('Error loading payroll history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPayrollHistory([]);
    setEmployee(null);
    onOpenChange(false);
  };

  const totalEarnings = payrollHistory.reduce((sum, period) => sum + period.totalPay, 0);
  const totalHours = payrollHistory.reduce((sum, period) => sum + period.regularHours + period.overtimeHours, 0);
  const totalSales = payrollHistory.reduce((sum, period) => sum + period.salesCount, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#005cb3]" />
            Payroll History
          </DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#005cb3]"></div>
            <span className="ml-3">Loading payroll history...</span>
          </div>
        ) : employee ? (
          <div className="space-y-6">
            {/* Employee Header */}
            <div className="bg-[#005cb3]/5 border border-[#005cb3]/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{employee.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {employee.position} • {employee.department}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ${employee.hourly_rate}/hr • {employee.max_hours_before_overtime}h before overtime
                  </p>
                </div>
                <Badge 
                  variant="outline"
                  className="bg-[#005cb3]/10 text-[#005cb3] dark:bg-[#005cb3]/30 dark:text-[#005cb3]"
                >
                  {employee.status}
                </Badge>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <DollarSign className="h-6 w-6 mx-auto mb-2 text-[#005cb3]" />
                  <div className="text-2xl font-bold">${totalEarnings.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Earnings</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-[#005cb3]" />
                  <div className="text-2xl font-bold">{formatHoursMinutes(totalHours)}</div>
                  <div className="text-xs text-muted-foreground">Total Hours</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-[#005cb3]" />
                  <div className="text-2xl font-bold">{totalSales}</div>
                  <div className="text-xs text-muted-foreground">Policies Sold</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Calendar className="h-6 w-6 mx-auto mb-2 text-[#005cb3]" />
                  <div className="text-2xl font-bold">{payrollHistory.length}</div>
                  <div className="text-xs text-muted-foreground">Pay Periods</div>
                </CardContent>
              </Card>
            </div>

            {/* Payroll History */}
            <Card>
              <CardHeader>
                <CardTitle>Biweekly Payroll History</CardTitle>
              </CardHeader>
              <CardContent>
                {payrollHistory.length > 0 ? (
                  <div className="space-y-4">
                    {payrollHistory.map((period, index) => (
                      <div 
                        key={index}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium">{period.period}</h4>
                            <p className="text-sm text-muted-foreground">
                              {new Date(period.startDate).toLocaleDateString()} - {new Date(period.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-[#005cb3]">
                              ${period.totalPay.toLocaleString()}
                            </div>
                            <div className="text-sm text-muted-foreground">Total Pay</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">                        
                          <div>
                            <span className="text-muted-foreground">Total Hours:</span>
                            <div className="font-medium">{formatHoursMinutes(period.regularHours)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Hourly Rate:</span>
                            <div className="font-medium">${employee?.hourly_rate || 25}/hr</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Bonuses:</span>
                            <div className="font-medium">${period.bonuses.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Policies Sold:</span>
                            <div className="font-medium">{period.salesCount}</div>
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-sm">                        
                          <div>
                            <span className="text-muted-foreground">Base Pay:</span>
                            <div className="font-medium">${period.regularPay.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Pay:</span>
                            <div className="font-medium">${period.totalPay.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Sales Amount:</span>
                            <div className="font-medium">${period.salesAmount.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No payroll history available yet.</p>
                    <p className="text-sm">Payroll records will appear here after you work some hours.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Employee not found.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}