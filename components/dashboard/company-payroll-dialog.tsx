"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getEmployees, getPolicySales } from "@/lib/database";

interface CompanyPayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrollPeriod?: string;
}

export function CompanyPayrollDialog({ open, onOpenChange, payrollPeriod }: CompanyPayrollDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [progress, setProgress] = useState(0);
  const [payrollData, setPayrollData] = useState<any>(null);

  useEffect(() => {
    if (open && !isGenerated) {
      loadPayrollData();
    }
  }, [open, isGenerated]);

  const loadPayrollData = async () => {
    try {
      const employees = await getEmployees();
      const activeEmployees = employees.filter(emp => emp.status === 'active');
      
      // Calculate department breakdown
      const departmentMap = new Map();
      activeEmployees.forEach(emp => {
        if (!departmentMap.has(emp.department)) {
          departmentMap.set(emp.department, { employees: 0, grossPay: 0 });
        }
        const dept = departmentMap.get(emp.department);
        dept.employees += 1;
        dept.grossPay += emp.hourly_rate * 80; // 80 hours bi-weekly
      });

      const departmentBreakdown = Array.from(departmentMap.entries()).map(([dept, data]) => ({
        department: dept,
        employees: data.employees,
        grossPay: data.grossPay,
        netPay: data.grossPay // No deductions
      }));

      const totalGrossPay = departmentBreakdown.reduce((sum, dept) => sum + dept.grossPay, 0);
      const totalHours = activeEmployees.length * 80; // 80 hours bi-weekly per employee
      const averageHourlyRate = activeEmployees.reduce((sum, emp) => sum + emp.hourly_rate, 0) / activeEmployees.length;

      setPayrollData({
        payPeriod: payrollPeriod || "Current Period",
        totalEmployees: employees.length,
        activeEmployees: activeEmployees.length,
        totalHours,
        totalOvertimeHours: Math.floor(Math.random() * 20), // Mock overtime
        averageHourlyRate: Math.round(averageHourlyRate * 100) / 100,
        totalGrossPay: Math.round(totalGrossPay),
        totalNetPay: Math.round(totalGrossPay),
        departmentBreakdown
      });
    } catch (error) {
      console.error('Error loading payroll data:', error);
    }
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setProgress(0);

    // Simulate generation progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setIsGenerated(true);
          return 100;
        }
        return prev + 8;
      });
    }, 400);
  };

  const handleClose = () => {
    setIsGenerating(false);
    setIsGenerated(false);
    setProgress(0);
    setPayrollData(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isGenerated ? "Company Payroll Report" : "Generate Company Payroll Report"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!isGenerating && !isGenerated ? (
            <div className="text-center space-y-4">
              <Users className="mx-auto h-12 w-12 text-[#005cb3]" />
              <p className="text-lg font-medium">
                Generate company-wide payroll report
              </p>
              <p className="text-sm text-muted-foreground">
                This will generate a comprehensive payroll report for all employees for the period: {payrollData?.payPeriod || payrollPeriod}
              </p>
              <Button 
                onClick={handleGenerate}
                className="w-full bg-[#005cb3] hover:bg-[#005cb3]/90"
              >
                Generate Company Report
              </Button>
            </div>
          ) : isGenerating ? (
            <div className="space-y-4">
              <p className="text-center">Generating company payroll report...</p>
              <Progress value={progress} className="[&>div]:bg-[#005cb3]" />
              <p className="text-sm text-center text-muted-foreground">
                Processing {payrollData?.totalEmployees || 0} employees across multiple departments
              </p>
            </div>
          ) : payrollData ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-[#005cb3]/10 mx-auto flex items-center justify-center">
                  <FileText className="h-6 w-6 text-[#005cb3]" />
                </div>
                <h3 className="text-lg font-semibold">Company Payroll Report Generated</h3>
                <p className="text-sm text-muted-foreground">Pay Period: {payrollData.payPeriod}</p>
              </div>

              {/* Company Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Company Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Employees:</span>
                    <span className="text-sm font-medium">{payrollData.totalEmployees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Active Employees:</span>
                    <span className="text-sm font-medium">{payrollData.activeEmployees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Hours Worked:</span>
                    <span className="text-sm font-medium">{payrollData.totalHours.toLocaleString()} hrs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Overtime Hours:</span>
                    <span className="text-sm font-medium">{payrollData.totalOvertimeHours} hrs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Average Hourly Rate:</span>
                    <span className="text-sm font-medium">${payrollData.averageHourlyRate.toFixed(2)}/hr</span>
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
                        <span className="text-sm text-muted-foreground">{dept.employees} employees</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Department Total:</span>
                        <span className="font-medium">${dept.netPay.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Total Expenditure */}
              <Card className="bg-[#005cb3]/5 border-[#005cb3]/20">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Total Company Expenditure:</span>
                      <span className="text-2xl font-bold text-[#005cb3]">${payrollData.totalNetPay.toLocaleString()}</span>
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
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}