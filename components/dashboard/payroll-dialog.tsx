"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Download, FileText, AlertTriangle, Edit, Check, X } from "lucide-react";
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
  const [additionalBonuses, setAdditionalBonuses] = useState<{[key: string]: number | null}>({});
  const [editingBonus, setEditingBonus] = useState<{[key: string]: boolean}>({});
  const { toast } = useToast();

  useEffect(() => {
    if (open && employeeName) {
      loadPayrollData();
    }
  }, [open, employeeName]);

  const loadPayrollData = async () => {
    setLoading(true);
    
    try {
      // Get policies over $5000 for manual bonus setting
      const policies = await getPolicySales(); // Get all policies to find high-value ones
      const highValuePols = policies.filter(policy => policy.amount > 5000);
      setHighValuePolicies(highValuePols);
      
      // Initialize additional bonuses for high-value policies (separate from base bonus)
      const initialAdditionalBonuses: {[key: string]: number | null} = {};
      highValuePols.forEach(policy => {
        initialAdditionalBonuses[policy.id] = null; // Start with null to show placeholder
      });
      setAdditionalBonuses(initialAdditionalBonuses);
      
      // Calculate total additional bonus
      const totalAdditionalBonus = Object.values(initialAdditionalBonuses).reduce((sum: number, bonus) => sum + (bonus ?? 0), 0);
      
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
        standardBonuses: 450.00, // Bonuses from policies under $5000 + base bonuses from high-value policies
        additionalBonusTotal: totalAdditionalBonus, // Additional bonuses for high-value policies
        totalBaseBonuses: highValuePols.reduce((sum, policy) => sum + policy.bonus, 0) // Base bonuses from high-value policies
      });
    } catch (error) {
      console.error('Error loading payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdditionalBonusChange = (policyId: string, additionalBonus: number) => {
    setAdditionalBonuses(prev => ({
      ...prev,
      [policyId]: additionalBonus
    }));
    
    // Update total additional bonus in payroll data
    const newAdditionalBonusTotal = Object.values({
      ...additionalBonuses,
      [policyId]: additionalBonus
    }).reduce((sum: number, b) => sum + (b ?? 0), 0);
    
    setPayrollData((prev: any) => ({
      ...prev,
      additionalBonusTotal: newAdditionalBonusTotal,
      grossPay: prev.grossPay - (prev.additionalBonusTotal ?? 0) + newAdditionalBonusTotal,
      netPay: prev.netPay - (prev.additionalBonusTotal ?? 0) + newAdditionalBonusTotal
    }));
  };

  const handleEditBonus = (policyId: string) => {
    setEditingBonus(prev => ({
      ...prev,
      [policyId]: true
    }));
  };

  const handleSaveBonus = (policyId: string) => {
    setEditingBonus(prev => ({
      ...prev,
      [policyId]: false
    }));
    
    toast({
      title: "Bonus Updated",
      description: "Additional bonus has been set for this high-value policy.",
    });
  };

  const handleCancelEdit = (policyId: string) => {
    setEditingBonus(prev => ({
      ...prev,
      [policyId]: false
    }));
    
    // Reset to previous value
    setAdditionalBonuses(prev => ({
      ...prev,
      [policyId]: null
    }));
  };

  const handleClose = () => {
    setPayrollData(null);
    setHighValuePolicies([]);
    setAdditionalBonuses({});
    setEditingBonus({});
    onOpenChange(false);
  };

  const handleGeneratePayroll = () => {
    toast({
      title: "Payroll Updated",
      description: "Payroll has been successfully updated.",
    });
    handleClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[#005cb3]" />
            Payroll Review & Bonus Setting
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {payrollData ? (
            <div className="space-y-4">
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
                      High-Value Policy Bonuses (Over $5,000)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Note:</strong> Set additional bonuses for high-value policies. These are <strong>on top of</strong> the base broker fee bonuses already calculated.
                      </p>
                    </div>
                    {highValuePolicies.map((policy) => (
                      <div key={policy.id} className="border rounded-lg p-3 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{policy.policy_number}</h4>
                            <p className="text-sm text-muted-foreground">{policy.client_name}</p>
                            <p className="text-sm text-muted-foreground">{policy.policy_type}</p>
                            {policy.is_cross_sold_policy && (
                              <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs mt-1">
                                Cross-Sold Policy
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-lg">${policy.amount.toLocaleString()}</p>
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              High Value
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Broker Fee:</span>
                            <span className="ml-2 font-medium">${policy.broker_fee}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Base Bonus:</span>
                            <span className="ml-2 font-medium text-[#005cb3]">${policy.bonus}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                          <Label htmlFor={`additional-bonus-${policy.id}`} className="text-sm font-medium">
                            Additional Bonus:
                          </Label>
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-sm">$</span>
                            {editingBonus[policy.id] ? (
                              <Input
                                id={`additional-bonus-${policy.id}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={additionalBonuses[policy.id] ?? ""}
                                placeholder="0.00"
                                onChange={(e) => handleAdditionalBonusChange(policy.id, parseFloat(e.target.value) || 0)}
                                className="w-24"
                                autoFocus
                              />
                            ) : (
                              <span className="text-sm font-medium w-24 px-3 py-1 bg-white dark:bg-gray-800 border rounded">
                                ${(additionalBonuses[policy.id] ?? 0).toFixed(2)}
                              </span>
                            )}
                            <div className="flex gap-1">
                              {editingBonus[policy.id] ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSaveBonus(policy.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCancelEdit(policy.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditBonus(policy.id)}
                                  className="h-8 w-8 p-0"
                                  title="Edit additional bonus"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground bg-green-50 dark:bg-green-950/20 p-2 rounded">
                          <strong>Total Bonus for this policy:</strong> ${(policy.bonus + (additionalBonuses[policy.id] ?? 0)).toFixed(2)} 
                          (Base: ${policy.bonus} + Additional: ${(additionalBonuses[policy.id] ?? 0).toFixed(2)})
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
                    <span className="text-sm text-muted-foreground">High-Value Base Bonuses:</span>
                    <span className="text-sm font-medium">${payrollData.totalBaseBonuses.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Additional High-Value Bonuses:</span>
                    <span className="text-sm font-medium text-green-600">${payrollData.additionalBonusTotal.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span className="text-sm">Gross Pay:</span>
                    <span className="text-sm">${(payrollData.grossPay + payrollData.additionalBonusTotal).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Net Pay */}
              <Card className="bg-[#005cb3]/5 border-[#005cb3]/20">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Net Pay:</span>
                    <span className="text-2xl font-bold text-[#005cb3]">${(payrollData.netPay + payrollData.additionalBonusTotal).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="space-y-2">
                <Button 
                  className="w-full bg-[#005cb3] hover:bg-[#005cb3]/90"
                  onClick={handleGeneratePayroll}
                >
                  Update Payroll
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
                {employeeName ? `Review payroll for ${employeeName}` : 'Review payroll report'}
              </p>
              <p className="text-sm text-muted-foreground">
                Review and set additional bonuses for high-value policies, then generate the payroll report.
              </p>
              <Button 
                onClick={loadPayrollData}
                className="w-full bg-[#005cb3] hover:bg-[#005cb3]/90"
              >
                Load Payroll Data
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}