"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, DollarSign, Eye, CheckCircle, Clock, Calendar, RotateCcw } from "lucide-react";
import { 
  getHighValuePolicyNotificationsList, 
  updateHighValuePolicyNotification, 
  getEmployees,
  getUrgentReviewPolicies,
  shouldShowPeriodEndNotification,
  closeExpiredBiweeklyPeriods
} from "@/lib/database";
import { PayrollDialog } from "./payroll-dialog";
import { useToast } from "@/hooks/use-toast";
import type { HighValuePolicyNotification } from "@/lib/supabase";
import { dashboardEvents } from "@/lib/events";

interface HighValuePolicyWithEmployee extends HighValuePolicyNotification {
  employee_name?: string;
}

interface UrgentReviewInfo {
  policy_count: number;
  days_remaining: number;
  period_end: string;
}

export function HighValuePolicyNotifications() {
  const [highValuePolicies, setHighValuePolicies] = useState<HighValuePolicyWithEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [urgentReview, setUrgentReview] = useState<UrgentReviewInfo | null>(null);
  const [showPeriodNotification, setShowPeriodNotification] = useState(false);
  const [showAllPolicies, setShowAllPolicies] = useState(false);
  const lastSuccessfulData = useRef<HighValuePolicyWithEmployee[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadHighValuePolicies();
    checkUrgentReviews();
  }, []);

  // Listen for real-time events for immediate updates
  useEffect(() => {
    const handlePolicyUpdate = () => {
      // Use silent update to prevent infinite loops
      loadHighValuePolicies(false, true);
    };

    // Subscribe to events and store cleanup functions
    const cleanupFunctions = [
      dashboardEvents.on('policy_sale', handlePolicyUpdate),
      dashboardEvents.on('high_value_policy_updated', handlePolicyUpdate)
    ];

    return () => {
      // Call all cleanup functions
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, []);

  const checkUrgentReviews = async () => {
    try {
      const [urgentPolicies, shouldNotify] = await Promise.all([
        getUrgentReviewPolicies(),
        shouldShowPeriodEndNotification()
      ]);

      setUrgentReview(urgentPolicies);
      // Only show notification if 2 days or less remaining
      setShowPeriodNotification(shouldNotify && urgentPolicies && urgentPolicies.days_remaining <= 2);

      // Close expired periods
      await closeExpiredBiweeklyPeriods();
    } catch (error) {
      console.error('Error checking urgent reviews:', error);
    }
  };

  const loadHighValuePolicies = async (showLoading = true, silentUpdate = false) => {
    try {
      if (showLoading && !hasInitiallyLoaded) {
        setLoading(true);
      }
      
      console.log('🔍 Starting to fetch data...');
      const [notifications, employees] = await Promise.all([
        getHighValuePolicyNotificationsList(),
        getEmployees()
      ]);
      console.log('🔍 Data fetched successfully');
      
      // Create a map of employee IDs to names
      const employeeMap = new Map(employees.map(emp => [emp.clerk_user_id, emp.name]));
      
      // Debug: Check if John Smith is in the map
      const johnSmithInMap = employeeMap.get('user_2yQeD2Af9ndPLFcOiLMoQ2QyFmO');
      console.log('🔍 John Smith lookup result:', johnSmithInMap);
      
      // Add employee names to notifications
      const policiesWithNames = notifications.map(notification => {
        const foundName = employeeMap.get(notification.employee_id);
        const willShow = foundName || "Unknown Employee";
        
        // Only log for the specific policies we're interested in
        if (notification.policy_number === 'POL-2025-232' || notification.policy_number === 'POL-2025-233') {
          console.log(`🔍 Policy ${notification.policy_number}: employee_id="${notification.employee_id}", found_name="${foundName}", will_show="${willShow}"`);
        }
        
        return {
          ...notification,
          employee_name: willShow
        };
      });
      
      // Store successful data for future reference
      lastSuccessfulData.current = policiesWithNames;
      
      // Always update the state with fresh data
      setHighValuePolicies(policiesWithNames);
      
      // Emit event to update admin dashboard alert count automatically (only for non-silent updates)
      if (!silentUpdate) {
        dashboardEvents.emit('high_value_policy_updated');
      }
      
      if (!hasInitiallyLoaded) {
        setHasInitiallyLoaded(true);
      }
    } catch (error) {
      console.error('Error loading high-value policies:', error);
      
      // On error during silent update, keep the last successful data
      if (silentUpdate && lastSuccessfulData.current.length > 0) {
        setHighValuePolicies(lastSuccessfulData.current);
      }
    } finally {
      if (showLoading && !hasInitiallyLoaded) {
        setLoading(false);
      }
    }
  };

  const handleReviewPayroll = (employeeName: string, employeeId?: string) => {
    setSelectedEmployee(employeeId || employeeName);
    setPayrollDialogOpen(true);
  };

  const handleMarkAsReviewed = async (notificationId: string) => {
    try {
      await updateHighValuePolicyNotification(notificationId, {
        status: 'reviewed'
      });
      
      toast({
        title: "Policy Reviewed",
        description: "High-value policy has been marked as reviewed. It will remain editable until the biweekly period ends.",
      });
      
      // Emit event for immediate updates across all components
      dashboardEvents.emit('high_value_policy_updated');
      
      // Immediate refresh after user action (not silent)
      loadHighValuePolicies(false, false);
    } catch (error) {
      console.error('Error marking notification as reviewed:', error);
      toast({
        title: "Error",
        description: "Failed to mark notification as reviewed.",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsResolved = async (notificationId: string) => {
    try {
      await updateHighValuePolicyNotification(notificationId, {
        status: 'resolved'
      });
      
      toast({
        title: "Policy Resolved",
        description: "High-value policy has been marked as resolved and will no longer appear in alerts.",
      });
      
      // Emit event for immediate updates across all components
      dashboardEvents.emit('high_value_policy_updated');
      
      // Immediate refresh after user action (not silent)
      loadHighValuePolicies(false, false);
    } catch (error) {
      console.error('Error marking notification as resolved:', error);
      toast({
        title: "Error",
        description: "Failed to mark notification as resolved.",
        variant: "destructive",
      });
    }
  };

  const handleUnresolve = async (notificationId: string) => {
    try {
      console.log('🔄 Attempting to unresolve policy with ID:', notificationId);
      
      const result = await updateHighValuePolicyNotification(notificationId, {
        status: 'pending'
      });
      
      console.log('✅ Unresolve result:', result);
      
      toast({
        title: "Policy Unresolved",
        description: "High-value policy has been marked as pending and will appear in alerts again.",
      });
      
      // Emit event for immediate updates across all components
      dashboardEvents.emit('high_value_policy_updated');
      
      // Immediate refresh after user action (not silent)
      loadHighValuePolicies(false, false);
    } catch (error) {
      console.error('❌ Error unresolving notification:', error);
      toast({
        title: "Error",
        description: "Failed to unresolve notification.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysUntilPeriodEnd = (periodEnd?: string) => {
    if (!periodEnd) return null;
    const today = new Date();
    const endDate = new Date(periodEnd);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isPeriodExpired = (periodEnd?: string) => {
    if (!periodEnd) return false;
    const today = new Date();
    const endDate = new Date(periodEnd);
    return today > endDate;
  };

  // Function to scroll to a specific policy by ID
  const scrollToPolicy = (policyId: string) => {
    const element = document.getElementById(`policy-${policyId}`);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center'
      });
      // Add a highlight effect
      element.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
      }, 3000);
    }
  };

  // Filter out resolved policies from display count for alerts
  const unresolvedPolicies = highValuePolicies.filter(policy => policy.status !== 'resolved');

  // Only show loading spinner on initial load, not during refreshes
  if (loading && !hasInitiallyLoaded) {
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

  return (
    <>
      {/* Urgent Period End Notification - Only shown when 2 days or less remaining */}
      {showPeriodNotification && urgentReview && urgentReview.days_remaining <= 2 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Clock className="h-5 w-5" />
              Biweekly Period Ending Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-800 dark:text-amber-200">
                  {urgentReview.policy_count} high-value {urgentReview.policy_count === 1 ? 'policy' : 'policies'} need bonus review
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-300">
                  Period ends on {formatDate(urgentReview.period_end)} ({urgentReview.days_remaining} {urgentReview.days_remaining === 1 ? 'day' : 'days'} remaining)
                </p>
              </div>
              <Button
                variant="outline"
                className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200"
                onClick={() => setShowPeriodNotification(false)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            High-Value Policy Alerts ({unresolvedPolicies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasInitiallyLoaded && highValuePolicies.length === 0 ? (
            <div className="text-center py-6">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No high-value policies requiring review</p>
              <p className="text-sm text-muted-foreground mt-1">
                Policies over $5,000 will appear here during their biweekly review period
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
              {(showAllPolicies ? highValuePolicies : highValuePolicies.slice(0, 5)).map((policy) => {
                const daysUntilEnd = getDaysUntilPeriodEnd(policy.biweekly_period_end);
                const isUrgent = daysUntilEnd !== null && daysUntilEnd <= 2;
                const periodExpired = isPeriodExpired(policy.biweekly_period_end);
                
                console.log('🔍 Rendering policy:', {
                  id: policy.id,
                  policy_number: policy.policy_number,
                  status: policy.status,
                  periodExpired,
                  biweekly_period_end: policy.biweekly_period_end,
                  daysUntilEnd,
                  shouldShowUnresolve: policy.status === 'resolved' && !periodExpired
                });
                
                return (
                  <div 
                    key={policy.id}
                    id={`policy-${policy.id}`}
                    className={`flex items-center justify-between p-4 border rounded-lg transition-all duration-300 ${
                      policy.status === 'resolved'
                        ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                        : isUrgent 
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' 
                        : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        policy.status === 'resolved'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : isUrgent 
                          ? 'bg-red-100 dark:bg-red-900/30' 
                          : 'bg-amber-100 dark:bg-amber-900/30'
                      }`}>
                        <DollarSign className={`h-5 w-5 ${
                          policy.status === 'resolved'
                            ? 'text-green-600 dark:text-green-400'
                            : isUrgent 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-amber-600 dark:text-amber-400'
                        }`} />
                      </div>
                      
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <span>{policy.policy_number}</span>
                          {/* Only show Urgent tag if 2 days or less remaining and not resolved */}
                          {isUrgent && policy.status !== 'resolved' && (
                            <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs">
                              Urgent
                            </Badge>
                          )}
                          {/* Show Resolved tag if policy is resolved */}
                          {policy.status === 'resolved' && (
                            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                              Resolved
                            </Badge>
                          )}
                          {/* Show Reviewed tag if policy is reviewed but not resolved */}
                          {policy.status === 'reviewed' && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                              Reviewed
                            </Badge>
                          )}
                          {policy.is_cross_sold_policy && (
                            <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
                              Cross-Sold
                            </Badge>
                          )}
                          {periodExpired && (
                            <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 text-xs">
                              Period Expired
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Sold by {policy.employee_name} • ${policy.policy_amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Broker Fee: ${policy.broker_fee} • Base Bonus: ${policy.current_bonus}
                          {policy.admin_bonus && policy.admin_bonus > 0 && (
                            <> • Additional Bonus: ${policy.admin_bonus}</>
                          )}
                        </p>
                        {(policy.biweekly_period_start || policy.biweekly_period_end) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span className="font-medium">Biweekly Period:</span>
                            {policy.biweekly_period_start && policy.biweekly_period_end ? (
                              <>
                                {formatDate(policy.biweekly_period_start)} - {formatDate(policy.biweekly_period_end)}
                                {daysUntilEnd !== null && !periodExpired && (
                                  <span className={isUrgent && policy.status !== 'resolved' ? 'text-red-600 font-medium' : 'text-blue-600'}>
                                    ({daysUntilEnd} {daysUntilEnd === 1 ? 'day' : 'days'} remaining)
                                  </span>
                                )}
                                {periodExpired && (
                                  <span className="text-gray-600 font-medium">
                                    (Expired)
                                  </span>
                                )}
                              </>
                            ) : policy.biweekly_period_end ? (
                              <>
                                Ends: {formatDate(policy.biweekly_period_end)}
                                {daysUntilEnd !== null && !periodExpired && (
                                  <span className={isUrgent && policy.status !== 'resolved' ? 'text-red-600 font-medium' : 'text-blue-600'}>
                                    ({daysUntilEnd} {daysUntilEnd === 1 ? 'day' : 'days'} remaining)
                                  </span>
                                )}
                                {periodExpired && (
                                  <span className="text-gray-600 font-medium">
                                    (Expired)
                                  </span>
                                )}
                              </>
                            ) : (
                              `Starts: ${formatDate(policy.biweekly_period_start)}`
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="font-bold text-lg">${policy.policy_amount.toLocaleString()}</div>
                      <div className="flex gap-2">
                        {policy.status === 'resolved' ? (
                          // Only show unresolve button if period hasn't expired
                          !periodExpired && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                console.log('🖱️ Unresolve button clicked for policy:', policy.id, 'status:', policy.status, 'periodExpired:', periodExpired);
                                handleUnresolve(policy.id);
                              }}
                              title="Mark this policy as pending again"
                              className="text-amber-700 border-amber-300 hover:bg-amber-50"
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Unresolve
                            </Button>
                          )
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReviewPayroll(policy.employee_name || "Unknown", policy.employee_id)}
                              title="Review and set additional bonus for this high-value policy"
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              Set Bonus
                            </Button>
                            {policy.status !== 'reviewed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkAsReviewed(policy.id)}
                                title="Mark this policy as reviewed (no additional bonus)"
                              >
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Mark Reviewed
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkAsResolved(policy.id)}
                              title="Mark this policy as resolved and remove from alerts"
                              className="text-green-700 border-green-300 hover:bg-green-50"
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Resolve
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {highValuePolicies.length > 5 && !showAllPolicies && (
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllPolicies(true)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    +{highValuePolicies.length - 5} more high-value policies - Click to show all
                  </Button>
                </div>
              )}
              
              {showAllPolicies && highValuePolicies.length > 5 && (
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllPolicies(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Show less
                  </Button>
                </div>
              )}
            </div>
          )}
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

// Export the scroll function for external use
export { HighValuePolicyNotifications as default }; 