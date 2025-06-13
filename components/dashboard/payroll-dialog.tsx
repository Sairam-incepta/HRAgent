"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Download, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName?: string | null;
}

export function PayrollDialog({ open, onOpenChange, employeeName }: PayrollDialogProps) {
  const [payrollData, setPayrollData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && employeeName) {
      loadPayrollData();
    }
  }, [open, employeeName]);

  const loadPayrollData = async () => {
    setLoading(true);
    
    // Simulate quick data loading
    setTimeout(() => {
      setPayrollData({
        employeeName: employeeName || "John Doe",
        employeeId: "EMP001",
        payPeriod: "May 1-15, 2025",
        department: "Sales",
        position: "Sales Representative",
        regularHours: 80,
        overtimeHours: 5,
        hourlyRate: 25.00,
        overtimeRate: 37.50,
        grossPay: 2187.50,
        netPay: 2187.50 // No deductions, so net pay equals gross pay
      });
      setLoading(false);
    }, 300); // Reduced from 5 seconds to 300ms
  };

  const handleClose = () => {
    setPayrollData(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Employee Payroll Report</DialogTitle>
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
                <h3 className="text-lg font-semibold">Payroll Report</h3>
                <p className="text-sm text-muted-foreground">Pay Period: {payrollData.payPeriod}</p>
              </div>

              {/* Employee Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Employee Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Name:</span>
                    <span className="text-sm font-medium">{payrollData.employeeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Employee ID:</span>
                    <span className="text-sm font-medium">{payrollData.employeeId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Department:</span>
                    <span className="text-sm font-medium">{payrollData.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Position:</span>
                    <span className="text-sm font-medium">{payrollData.position}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Hours & Earnings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Hours & Earnings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Regular Hours:</span>
                    <span className="text-sm font-medium">{payrollData.regularHours} hrs @ ${payrollData.hourlyRate}/hr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Overtime Hours:</span>
                    <span className="text-sm font-medium">{payrollData.overtimeHours} hrs @ ${payrollData.overtimeRate}/hr</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span className="text-sm">Gross Pay:</span>
                    <span className="text-sm">${payrollData.grossPay.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Net Pay */}
              <Card className="bg-[#005cb3]/5 border-[#005cb3]/20">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Net Pay:</span>
                    <span className="text-2xl font-bold text-[#005cb3]">${payrollData.netPay.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="space-y-2">
                <Button 
                  className="w-full bg-[#005cb3] hover:bg-[#005cb3]/90"
                  onClick={() => {
                    // Handle download here
                    handleClose();
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF Report
                </Button>
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
              <CreditCard className="mx-auto h-12 w-12 text-[#005cb3]" />
              <p className="text-lg font-medium">
                {employeeName ? `View payroll for ${employeeName}` : 'View payroll report'}
              </p>
              <p className="text-sm text-muted-foreground">
                Click below to view the detailed payroll report for the current pay period.
              </p>
              <Button 
                onClick={loadPayrollData}
                className="w-full bg-[#005cb3] hover:bg-[#005cb3]/90"
              >
                View Report
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}