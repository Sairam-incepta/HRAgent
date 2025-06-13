"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Download, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName?: string | null;
}

export function PayrollDialog({ open, onOpenChange, employeeName }: PayrollDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [progress, setProgress] = useState(0);

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
        return prev + 10;
      });
    }, 500);
  };

  const handleClose = () => {
    setIsGenerating(false);
    setIsGenerated(false);
    setProgress(0);
    onOpenChange(false);
  };

  const samplePayrollData = {
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
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isGenerated ? "Payroll Report" : "Generate Payroll Report"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!isGenerating && !isGenerated ? (
            <div className="text-center space-y-4">
              <CreditCard className="mx-auto h-12 w-12 text-[#005cb3]" />
              <p className="text-lg font-medium">
                {employeeName ? `Generate payroll for ${employeeName}` : 'Generate payroll report'}
              </p>
              <p className="text-sm text-muted-foreground">
                This will generate a detailed payroll report for the current pay period.
              </p>
              <Button 
                onClick={handleGenerate}
                className="w-full bg-[#005cb3] hover:bg-[#005cb3]/90"
              >
                Generate Report
              </Button>
            </div>
          ) : isGenerating ? (
            <div className="space-y-4">
              <p className="text-center">Generating payroll report...</p>
              <Progress value={progress} className="[&>div]:bg-[#005cb3]" />
              <p className="text-sm text-center text-muted-foreground">
                Please wait while we process the data
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-[#005cb3]/10 mx-auto flex items-center justify-center">
                  <FileText className="h-6 w-6 text-[#005cb3]" />
                </div>
                <h3 className="text-lg font-semibold">Payroll Report Generated</h3>
                <p className="text-sm text-muted-foreground">Pay Period: {samplePayrollData.payPeriod}</p>
              </div>

              {/* Employee Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Employee Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Name:</span>
                    <span className="text-sm font-medium">{samplePayrollData.employeeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Employee ID:</span>
                    <span className="text-sm font-medium">{samplePayrollData.employeeId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Department:</span>
                    <span className="text-sm font-medium">{samplePayrollData.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Position:</span>
                    <span className="text-sm font-medium">{samplePayrollData.position}</span>
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
                    <span className="text-sm font-medium">{samplePayrollData.regularHours} hrs @ ${samplePayrollData.hourlyRate}/hr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Overtime Hours:</span>
                    <span className="text-sm font-medium">{samplePayrollData.overtimeHours} hrs @ ${samplePayrollData.overtimeRate}/hr</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span className="text-sm">Gross Pay:</span>
                    <span className="text-sm">${samplePayrollData.grossPay.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Net Pay */}
              <Card className="bg-[#005cb3]/5 border-[#005cb3]/20">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Net Pay:</span>
                    <span className="text-2xl font-bold text-[#005cb3]">${samplePayrollData.netPay.toFixed(2)}</span>
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}