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
import { getPolicySales, getEmployee, calculateActualHoursForPeriod, getClientReviews } from "@/lib/database";
import { supabase } from "@/lib/supabase";
import { dashboardEvents } from "@/lib/events";

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

  // Generate user-friendly employee ID (first 3 letters of name + last 4 of UUID)
  const generateUserFriendlyId = (name: string, id: string): string => {
    if (name && name !== "Unknown") {
      const namePrefix = name.replace(/\s+/g, '').substring(0, 3).toUpperCase();
      const idSuffix = id.slice(-4);
      return `${namePrefix}${idSuffix}`;
    }
    return `EMP${id.slice(-4) || '0001'}`;
  };

  useEffect(() => {
    if (open && employeeName) {
      loadPayrollData();
    }
  }, [open, employeeName]);

  const loadPayrollData = async () => {
    setLoading(true);
    
    try {
      // Get employee data first
      const employeeData = await getEmployee(employeeName || ""); // employeeName is actually employee ID
      
      // Get high-value policies for manual bonus setting - FOR THIS EMPLOYEE ONLY
      const allPolicies = await getPolicySales(); // Get all policies
      // Filter by employee ID (employeeName is actually employee ID now) and high-value amount
      const highValuePols = allPolicies.filter(policy => 
        policy.amount > 5000 && 
        policy.employee_id === employeeName // employeeName is actually employee ID
      );
      setHighValuePolicies(highValuePols);
      
      // Initialize additional bonuses for high-value policies (separate from base bonus)
      const initialAdditionalBonuses: {[key: string]: number | null} = {};
      highValuePols.forEach(policy => {
        // Load existing admin_bonus if available
        const existingAdminBonus = (policy as any).admin_bonus || 0;
        initialAdditionalBonuses[policy.id] = existingAdminBonus;
      });
      setAdditionalBonuses(initialAdditionalBonuses);
      
      // Calculate actual hours worked from time logs for current biweekly period
      const now = new Date();
      
      // Use the same biweekly calculation as the main payroll system
      const referenceDate = new Date('2025-01-06'); // Monday, January 6, 2025 as reference
      const daysSinceReference = Math.floor((now.getTime() - referenceDate.getTime()) / (24 * 60 * 60 * 1000));
      const biweeklyPeriodsSinceReference = Math.floor(daysSinceReference / 14);
      
      // Get current biweekly period
      const startDate = new Date(referenceDate);
      startDate.setDate(referenceDate.getDate() + (biweeklyPeriodsSinceReference * 14));
      
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 13); // 14 days total (0-13)
      
      const actualHours = await calculateActualHoursForPeriod(employeeName!, startDate, endDate);
      
      // Get all policy sales and client reviews for this employee
      const [policySales, clientReviews] = await Promise.all([
        getPolicySales(employeeName!),
        getClientReviews(employeeName!)
      ]);
      
      // Calculate different types of bonuses separately
      let brokerFeeBonuses = 0;
      let crossSellingBonuses = 0; 
      let lifeInsuranceBonuses = 0;
      let highValuePolicyBonuses = 0;
      let totalBrokerFees = 0;
      
      // Process policy sales for bonuses
      policySales.forEach(sale => {
        // Track total broker fees
        totalBrokerFees += sale.broker_fee || 0;
        
        // Broker fee bonus: 10% of (broker fee - 100)
        if (sale.broker_fee > 100) {
          const baseBrokerBonus = (sale.broker_fee - 100) * 0.1;
          brokerFeeBonuses += baseBrokerBonus;
          
          // Cross-selling bonus: double the broker fee bonus (additional amount)
          if (sale.cross_sold) {
            crossSellingBonuses += baseBrokerBonus; // Additional amount for cross-selling
          }
        }
        
        // Life insurance bonus: $10 for life insurance policies
        if (sale.policy_type.toLowerCase().includes('life') || 
            (sale.cross_sold_type && sale.cross_sold_type.toLowerCase().includes('life'))) {
          lifeInsuranceBonuses += 10.00;
        }
        
        // High-value policy admin bonuses
        const adminBonus = (sale as any).admin_bonus || 0;
        if (adminBonus > 0) {
          highValuePolicyBonuses += adminBonus;
        }
      });
      
      // Review bonuses: $10 for each 5-star review
      const reviewBonuses = clientReviews.filter(review => review.rating === 5).length * 10;
      
      // Calculate hourly pay
      const hourlyRate = employeeData?.hourly_rate || 25;
      const regularHours = Math.min(actualHours, 8);
      const overtimeHours = Math.max(0, actualHours - 8);
      const regularPay = regularHours * hourlyRate;
      const overtimePay = overtimeHours * hourlyRate * 1.0; // 1x rate for overtime
      const totalHourlyPay = regularPay + overtimePay;
      
      // Total bonuses
      const totalBonuses = brokerFeeBonuses + crossSellingBonuses + lifeInsuranceBonuses + reviewBonuses + highValuePolicyBonuses;
      
      // Total pay
      const totalPay = totalHourlyPay + totalBonuses;
      
      setPayrollData({
        employeeName: employeeData?.name || "Unknown Employee",
        employeeId: generateUserFriendlyId(employeeData?.name || "Unknown", employeeName || ""),
        totalHours: actualHours,
        regularHours,
        overtimeHours,
        hourlyRate,
        regularPay,
        overtimePay,
        totalHourlyPay,
        brokerFeeBonuses,
        crossSellingBonuses,
        lifeInsuranceBonuses,
        reviewBonuses,
        highValuePolicyBonuses,
        totalBonuses,
        totalBrokerFees,
        totalPay,
        period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
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
    // Save additional bonuses to database
    const savePromises = Object.entries(additionalBonuses).map(async ([policyId, additionalBonus]) => {
      if (additionalBonus && additionalBonus > 0) {
        try {
          // Update the policy sale with the additional bonus
          const { error } = await supabase
            .from('policy_sales')
            .update({ 
              admin_bonus: additionalBonus,
              updated_at: new Date().toISOString()
            })
            .eq('id', policyId);
          
          if (error) {
            console.error('Error updating policy bonus:', error);
            throw error;
          }
        } catch (error) {
          console.error('Error saving bonus for policy:', policyId, error);
          throw error;
        }
      }
    });

    Promise.all(savePromises).then(() => {
      // Emit events to update dashboards
      dashboardEvents.emit('high_value_policy_updated');
      dashboardEvents.emit('policy_sale'); // This will update employee personal payroll
      
      toast({
        title: "Payroll Updated",
        description: "Additional bonuses have been saved and payroll has been updated.",
      });
      handleClose();
    }).catch((error) => {
      console.error('Error saving bonuses:', error);
      toast({
        title: "Error",
        description: "Failed to save bonuses. Please try again.",
        variant: "destructive"
      });
    });
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Personal Payroll{payrollData ? ` - ${payrollData.employeeName}` : ''}
          </DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3">Loading payroll data...</span>
          </div>
        ) : !payrollData ? (
          <div className="text-center space-y-4 py-12">
            <p className="text-lg font-medium">
              {employeeName ? `Review payroll for employee` : 'Review payroll report'}
            </p>
            <p className="text-sm text-muted-foreground">
              Click the button below to load the payroll data.
            </p>
            <Button 
              onClick={loadPayrollData}
              className="w-full bg-primary hover:bg-primary/90"
            >
              Load Payroll Data
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Employee Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <span className="text-sm text-muted-foreground">Employee ID:</span>
                <span className="ml-2 font-medium">{payrollData.employeeId}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Pay Period:</span>
                <span className="ml-2 font-medium">{payrollData.period}</span>
              </div>
            </div>

            {/* Hours & Pay Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hours & Base Pay</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Total Hours:</span>
                    <span className="ml-2 font-medium">{payrollData.totalHours.toFixed(1)}h</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Hourly Rate:</span>
                    <span className="ml-2 font-medium">${payrollData.hourlyRate}/hr</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Regular Hours:</span>
                    <span className="ml-2 font-medium">{payrollData.regularHours.toFixed(1)}h</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Regular Pay:</span>
                    <span className="ml-2 font-medium">${payrollData.regularPay.toFixed(2)}</span>
                  </div>
                  {payrollData.overtimeHours > 0 && (
                    <>
                      <div>
                        <span className="text-sm text-muted-foreground">Overtime Hours:</span>
                        <span className="ml-2 font-medium text-amber-600">{payrollData.overtimeHours.toFixed(1)}h</span>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Overtime Pay:</span>
                        <span className="ml-2 font-medium text-amber-600">${payrollData.overtimePay.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Hourly Pay:</span>
                    <span className="font-medium text-lg">${payrollData.totalHourlyPay.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bonus Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bonus Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Broker Fee Bonuses:</span>
                    <span className="ml-2 font-medium text-green-600">${payrollData.brokerFeeBonuses.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Cross-Selling Bonuses:</span>
                    <span className="ml-2 font-medium text-blue-600">${payrollData.crossSellingBonuses.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Life Insurance Bonuses:</span>
                    <span className="ml-2 font-medium text-purple-600">${payrollData.lifeInsuranceBonuses.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Review Bonuses:</span>
                    <span className="ml-2 font-medium text-indigo-600">${payrollData.reviewBonuses.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">High Value Policy Bonuses:</span>
                    <span className="ml-2 font-medium text-amber-600">${payrollData.highValuePolicyBonuses.toFixed(2)}</span>
                  </div>
                </div>
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Broker Fees Earned:</span>
                    <span className="text-sm font-medium text-blue-600">${payrollData.totalBrokerFees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Bonuses:</span>
                    <span className="font-medium text-lg text-green-600">${payrollData.totalBonuses.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* High Value Policy Warning */}
            {highValuePolicies.some(policy => (policy as any).status !== 'reviewed' && (policy as any).status !== 'resolved') && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">High Value Policy Review Required</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                  You have unreviewed high value policies that may affect your final bonus calculation.
                </p>
              </div>
            )}

            {/* Total Pay */}
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="text-lg text-center">Total Pay</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">${payrollData.totalPay.toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Hours: ${payrollData.totalHourlyPay.toFixed(2)} + Bonuses: ${payrollData.totalBonuses.toFixed(2)} | Broker Fees: ${payrollData.totalBrokerFees.toFixed(2)}
                  </div>
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
        )}
      </DialogContent>
    </Dialog>
  );
}