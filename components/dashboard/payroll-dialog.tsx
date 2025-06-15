"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Download, FileText, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getPolicySales, getEmployee } from "@/lib/database";

interface PayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName?: string | null;
}

export function PayrollDialog({ open, onOpenChange, employeeName }: PayrollDialogProps) {
  const [payrollData, setPayrollData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [highValuePolicies, setHighValuePolicies] = useState<any[]>([]);
  const [customBonuses, setCustomBonuses] = useState<{[key: string]: number}>({});
  const { toast } = useToast();

  useEffect(() => {
    if (open && employeeName) {
      loadPayrollData();
    }
  }, [open, employeeName]);

  const loadPayrollData = async () => {
    setLoading(true);
    
    try {
      // In a real implementation, you'd find the employee by name and get their data
      // For now, we'll simulate this with sample data and check for high-value policies
      
      // Get policies over $5000 for manual bonus setting
      const policies = await getPolicySales(); // Get all policies to find high-value ones
      const highValuePols = policies.filter(policy => policy.amount > 5000);
      setHighValuePolicies(highValuePols);
      
      // Initialize custom bonuses for high-value policies
      const initialCustomBonuses: {[key: string]: number} = {};
      highValuePols.forEach(policy => {
        initialCustomBonuses[policy.id] = policy.bonus; // Start with current bonus
      });
      setCustomBonuses(initialCustomBonuses);
      
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
        netPay: 2187.50,
        standardBonuses: 450.00, // Bonuses from policies under $5000
        customBonusTotal: Object.values(initialCustomBonuses).reduce((sum, bonus) => sum + bonus, 0)
      });
    } catch (error) {
      console.error('Error loading payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomBonusChange = (policyId: string, bonus: number) => {
    setCustomBonuses(prev => ({
      ...prev,
      [policyId]: bonus
    }));
    
    // Update total custom bonus in payroll data
    const newCustomBonusTotal = Object.values({
      ...customBonuses,
      [policyId]: bonus
    }).reduce((sum, b) => sum + b, 0);
    
    setPayrollData((prev: any) => ({
      ...prev,
      customBonusTotal: newCustomBonusTotal,
      grossPay: prev.grossPay - prev.customBonusTotal + newCustomBonusTotal,
      netPay: prev.netPay - prev.customBonusTotal + newCustomBonusTotal
    }));
  };

  const handleClose = () => {
    setPayrollData(null);
    setHighValuePolicies([]);
    setCustomBonuses({});
    onOpenChange(false);
  };

  const handleGeneratePayroll = () => {
    toast({
      title: "Payroll Generated",
      description: `Payroll for ${employeeName} has been generated with custom bonuses applied.`,
    });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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

              {/* High-Value Policies Bonus Management */}
              {highValuePolicies.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      High-Value Policies (Over $5,000)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Set custom bonuses for policies over $5,000. Default calculation may not apply.
                    </p>
                    {highValuePolicies.map((policy) => (
                      <div key={policy.id} className="border rounded-lg p-3 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{policy.policy_number}</h4>
                            <p className="text-sm text-muted-foreground">{policy.client_name}</p>
                            <p className="text-sm text-muted-foreground">{policy.policy_type}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-lg">${policy.amount.toLocaleString()}</p>
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              High Value
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`bonus-${policy.id}`} className="text-sm">Custom Bonus:</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">$</span>
                            <Input
                              id={`bonus-${policy.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={customBonuses[policy.id] || 0}
                              onChange={(e) => handleCustomBonusChange(policy.id, parseFloat(e.target.value) || 0)}
                              className="w-24"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

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
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Standard Bonuses:</span>
                    <span className="text-sm font-medium">${payrollData.standardBonuses.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">High-Value Policy Bonuses:</span>
                    <span className="text-sm font-medium">${payrollData.customBonusTotal.toFixed(2)}</span>
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
                  onClick={handleGeneratePayroll}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Generate Payroll Report
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