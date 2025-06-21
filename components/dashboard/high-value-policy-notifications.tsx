"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, DollarSign, Eye, CheckCircle } from "lucide-react";
import { getHighValuePolicyNotificationsList, updateHighValuePolicyNotification, getEmployees } from "@/lib/database";
import { PayrollDialog } from "./payroll-dialog";
import { useToast } from "@/hooks/use-toast";
import type { HighValuePolicyNotification } from "@/lib/supabase";

interface HighValuePolicyWithEmployee extends HighValuePolicyNotification {
  employee_name?: string;
}

export function HighValuePolicyNotifications() {
  const [highValuePolicies, setHighValuePolicies] = useState<HighValuePolicyWithEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadHighValuePolicies();
  }, []);

  // Auto-refresh every 30 seconds to catch new high-value policies
  useEffect(() => {
    const interval = setInterval(() => {
      loadHighValuePolicies();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadHighValuePolicies = async () => {
    try {
      setLoading(true);
      const [notifications, employees] = await Promise.all([
        getHighValuePolicyNotificationsList(),
        getEmployees()
      ]);
      
      // Create a map of employee IDs to names
      const employeeMap = new Map(employees.map(emp => [emp.clerk_user_id, emp.name]));
      
      // Add employee names to notifications
      const policiesWithNames = notifications.map(notification => ({
        ...notification,
        employee_name: employeeMap.get(notification.employee_id) || "Unknown Employee"
      }));
      
      setHighValuePolicies(policiesWithNames);
    } catch (error) {
      console.error('Error loading high-value policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewPayroll = (employeeName: string) => {
    setSelectedEmployee(employeeName);
    setPayrollDialogOpen(true);
  };

  const handleMarkAsReviewed = async (notificationId: string) => {
    try {
      await updateHighValuePolicyNotification(notificationId, {
        status: 'reviewed'
      });
      
      toast({
        title: "Notification Reviewed",
        description: "High-value policy has been marked as reviewed.",
      });
      
      // Refresh the list
      loadHighValuePolicies();
    } catch (error) {
      console.error('Error marking notification as reviewed:', error);
      toast({
        title: "Error",
        description: "Failed to mark notification as reviewed.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            High-Value Policy Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (highValuePolicies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            High-Value Policy Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No high-value policies requiring review</p>
            <p className="text-sm text-muted-foreground mt-1">
              Policies over $5,000 will appear here for bonus review
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            High-Value Policy Alerts ({highValuePolicies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {highValuePolicies.slice(0, 5).map((policy) => (
              <div 
                key={policy.id}
                className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <span>{policy.policy_number}</span>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                        High Value
                      </Badge>
                      {policy.is_cross_sold_policy && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                          Cross-Sold
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sold by {policy.employee_name} • ${policy.policy_amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Broker Fee: ${policy.broker_fee} • Current Bonus: ${policy.current_bonus}
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col gap-2">
                  <div className="font-bold text-lg">${policy.policy_amount.toLocaleString()}</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReviewPayroll(policy.employee_name || "Unknown")}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      Review Payroll
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkAsReviewed(policy.id)}
                    >
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Mark Reviewed
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            {highValuePolicies.length > 5 && (
              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground">
                  +{highValuePolicies.length - 5} more high-value policies
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <PayrollDialog
        open={payrollDialogOpen}
        onOpenChange={setPayrollDialogOpen}
        employeeName={selectedEmployee}
      />
    </>
  );
} 