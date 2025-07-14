"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, DollarSign, Eye, CheckCircle, Clock, Calendar, RotateCcw, Settings } from "lucide-react";
import { getHighValuePolicyNotificationsList, updateHighValuePolicyNotification } from "@/lib/util/high-value-policy-notifications";
import { getUrgentReviewPolicies } from "@/lib/util/policies";
import { shouldShowPeriodEndNotification, closeExpiredBiweeklyPeriods } from "@/lib/util/misc";
import { PayrollDialog } from "./payroll-dialog";
import { useToast } from "@/hooks/use-toast";
import type { HighValuePolicyNotification } from "@/lib/supabase";
import { dashboardEvents } from "@/lib/events";
import { Label } from "@/components/ui/label";

// Simplified - no need for employee names anymore

interface UrgentReviewInfo {
  policy_count: number;
  days_remaining: number;
  period_end: string;
}

export function HighValuePolicyNotifications() {
  const [highValuePolicies, setHighValuePolicies] = useState<HighValuePolicyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);
  const [bonusAmount, setBonusAmount] = useState<string>("");
  const [bonusNotes, setBonusNotes] = useState<string>("");
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [urgentReview, setUrgentReview] = useState<UrgentReviewInfo | null>(null);
  const [showPeriodNotification, setShowPeriodNotification] = useState(false);
  const [showAllPolicies, setShowAllPolicies] = useState(false);
  const lastSuccessfulData = useRef<HighValuePolicyNotification[]>([]);
  const { toast } = useToast();
  const [highValuePolicyThreshold, setHighValuePolicyThreshold] = useState(5000);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [tempThreshold, setTempThreshold] = useState(5000);
  const [processingActions, setProcessingActions] = useState<Set<string>>(new Set());

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
      
      console.log('🔍 Loading high value policies...', { showLoading, silentUpdate, hasInitiallyLoaded });
      const notifications = await getHighValuePolicyNotificationsList();
      console.log('🔍 Raw notifications from database:', notifications.length, notifications.map(n => ({
        id: n.id,
        policy_number: n.policy_number,
        status: n.status,
        policy_amount: n.policy_amount,
        biweekly_period_end: n.biweekly_period_end
      })));
      
      // No need to fetch employees or map employee names anymore
      // Store successful data for future reference
      lastSuccessfulData.current = notifications;
      
      // Always update the state with fresh data
      setHighValuePolicies(notifications);
      
      console.log('🔍 Updated state with notifications, pending count:', notifications.filter(n => n.status === 'pending').length);
      
      // Emit event to update admin dashboard alert count automatically (only for non-silent updates)
      if (!silentUpdate) {
        console.log('🔍 Emitting high_value_policy_updated event from loadHighValuePolicies');
        dashboardEvents.emit('high_value_policy_updated');
      }
      
      if (!hasInitiallyLoaded) {
        setHasInitiallyLoaded(true);
      }
    } catch (error) {
      console.error('❌ Error loading high-value policies:', error);
      
      // On error during silent update, keep the last successful data
      if (silentUpdate && lastSuccessfulData.current.length > 0) {
        console.log('🔍 Using cached data due to error during silent update');
        setHighValuePolicies(lastSuccessfulData.current);
      }
    } finally {
      if (showLoading && !hasInitiallyLoaded) {
        setLoading(false);
      }
    }
  };

  const handleReviewPayroll = (policy: any) => {
    setSelectedPolicy(policy);
    setBonusAmount(policy.admin_bonus?.toString() || "");
    setBonusNotes(policy.admin_notes || "");
    setBonusDialogOpen(true);
  };

  const handleMarkAsReviewed = async (notificationId: string) => {
    // Prevent double clicks
    if (processingActions.has(notificationId)) {
      return;
    }
    
    console.log('🔍 Marking policy as reviewed:', { notificationId, processingActions: Array.from(processingActions) });
    
    setProcessingActions(prev => new Set(prev).add(notificationId));
    
    try {
      console.log('🔍 Calling updateHighValuePolicyNotification...');
      const result = await updateHighValuePolicyNotification(notificationId, {
        status: 'reviewed'
      });
      
      console.log('🔍 Update result:', result);
      
      if (!result) {
        throw new Error('Failed to update policy status');
      }
      
      toast({
        title: "Policy Reviewed",
        description: "High-value policy has been reviewed and payroll will be updated.",
      });
      
      console.log('🔍 Emitting high_value_policy_updated event...');
      // Emit event for immediate updates across all components
      dashboardEvents.emit('high_value_policy_updated');
      
      console.log('🔍 Refreshing local data...');
      // Refresh the local data and clear processing state
      loadHighValuePolicies(false, false);
      
      // Add delay to ensure database sync and then force another refresh
      setTimeout(() => {
        console.log('🔍 Removing from processing set after delay...');
        setProcessingActions(prev => {
          const newSet = new Set(prev);
          newSet.delete(notificationId);
          return newSet;
        });
        
        // Force another refresh after delay to ensure UI is in sync
        console.log('🔍 Forcing additional refresh after delay...');
        loadHighValuePolicies(false, false);
        dashboardEvents.emit('high_value_policy_updated');
      }, 1000); // Increased delay to 1 second
      
    } catch (error) {
      console.error('❌ Error marking notification as reviewed:', error);
      toast({
        title: "Error",
        description: "Failed to mark notification as reviewed.",
        variant: "destructive",
      });
      
      // Remove from processing set on error
      setProcessingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const handleMarkAsResolved = async (notificationId: string) => {
    // Prevent double clicks
    if (processingActions.has(notificationId)) {
      return;
    }
    
    setProcessingActions(prev => new Set(prev).add(notificationId));
    
    try {
      const result = await updateHighValuePolicyNotification(notificationId, {
        status: 'resolved'
      });
      
      if (!result) {
        throw new Error('Failed to update policy status');
      }
      
      toast({
        title: "Policy Resolved",
        description: "High-value policy has been marked as resolved and will no longer appear in alerts.",
      });
      
      // Emit event for immediate updates across all components
      dashboardEvents.emit('high_value_policy_updated');
      
      // Refresh the local data and clear processing state
      loadHighValuePolicies(false, false);
      
      // Remove from processing set immediately
      setProcessingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
      
    } catch (error) {
      console.error('Error marking notification as resolved:', error);
      toast({
        title: "Error",
        description: "Failed to mark notification as resolved.",
        variant: "destructive",
      });
      
      // Remove from processing set on error
      setProcessingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const handleUnresolve = async (notificationId: string) => {
    // Prevent double clicks
    if (processingActions.has(notificationId)) {
      return;
    }
    
    setProcessingActions(prev => new Set(prev).add(notificationId));
    
    try {
      console.log('🔄 Attempting to unresolve policy with ID:', notificationId);
      
      const result = await updateHighValuePolicyNotification(notificationId, {
        status: 'pending'
      });
      
      console.log('✅ Unresolve result:', result);
      
      if (!result) {
        throw new Error('Failed to update policy status');
      }
      
      toast({
        title: "Policy Unresolved",
        description: "High-value policy has been marked as pending and will appear in alerts again.",
      });
      
      // Emit event for immediate updates across all components
      dashboardEvents.emit('high_value_policy_updated');
      
      // Refresh the local data and clear processing state
      loadHighValuePolicies(false, false);
      
      // Remove from processing set immediately
      setProcessingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
      
    } catch (error) {
      console.error('❌ Error unresolving notification:', error);
      toast({
        title: "Error",
        description: "Failed to unresolve notification.",
        variant: "destructive",
      });
      
      // Remove from processing set on error
      setProcessingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
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

  // Use the same logic that works correctly in payroll dialog
  const alertCount = highValuePolicies.filter(policy => policy.status === 'pending').length;
  
  // Filter out resolved and reviewed policies from display count for alerts (only show pending)
  const pendingPolicies = highValuePolicies.filter(policy => policy.status === 'pending');

  const handleUpdateThreshold = () => {
    setHighValuePolicyThreshold(tempThreshold);
    setSettingsDialogOpen(false);
    toast({
      title: "Threshold Updated",
      description: `High-value policy threshold updated to $${tempThreshold.toLocaleString()}`,
    });
  };

  const handleSaveBonus = async () => {
    if (!selectedPolicy) {
      console.error('No selected policy found');
      return;
    }
    
    console.log('Selected policy details:', {
      id: selectedPolicy.id,
      policy_id: selectedPolicy.policy_id,
      policy_number: selectedPolicy.policy_number,
      amount: selectedPolicy.amount,
      status: selectedPolicy.status
    });
    
    try {
      const bonusValue = parseFloat(bonusAmount) || 0;
      
      // Update the notification with admin bonus and notes
      // The selectedPolicy.id is the notification ID from high_value_policy_notifications table
      const notificationResult = await updateHighValuePolicyNotification(selectedPolicy.id, {
        status: 'reviewed',
        adminBonus: bonusValue,
        adminNotes: bonusNotes
      });
      
      if (!notificationResult) {
        throw new Error('Failed to update high-value policy notification');
      }
      
      console.log('Notification updated successfully:', notificationResult);
      
      toast({
        title: "Bonus Set Successfully",
        description: `Admin bonus of $${bonusValue} has been set for policy ${selectedPolicy.policy_number}.`,
      });
      
      // Emit events for real-time updates
      dashboardEvents.emit('high_value_policy_updated');
      dashboardEvents.emit('policy_sale');
      
      // Close dialog and refresh
      setBonusDialogOpen(false);
      setSelectedPolicy(null);
      setBonusAmount("");
      setBonusNotes("");
      loadHighValuePolicies(false, false);
      
    } catch (error) {
      console.error('Error setting bonus:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });
      console.error('Selected policy data:', JSON.stringify(selectedPolicy, null, 2));
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to set bonus. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Only show loading spinner on initial load, not during refreshes
  if (loading && !hasInitiallyLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            High Value Policy Alerts
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
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
              High Value Policy Alerts ({alertCount})
            </div>
            <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setTempThreshold(highValuePolicyThreshold)}>
                  <Settings className="h-4 w-4 mr-1" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>High Value Policy Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="threshold" className="text-sm font-medium">
                      High Value Policy Threshold
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">$</span>
                      <Input
                        id="threshold"
                        type="number"
                        value={tempThreshold}
                        onChange={(e) => setTempThreshold(Number(e.target.value))}
                        placeholder="5000"
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Policies above this amount will require manual bonus review
                    </p>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateThreshold}>
                      Update
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasInitiallyLoaded && highValuePolicies.length === 0 ? (
            <div className="text-center py-6">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No high-value policies requiring review</p>
              <p className="text-sm text-muted-foreground mt-1">
                Policies over ${highValuePolicyThreshold.toLocaleString()} will appear here during their biweekly review period
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
              {(showAllPolicies ? highValuePolicies : highValuePolicies.slice(0, 5)).map((policy) => {
                const daysUntilEnd = getDaysUntilPeriodEnd(policy.biweekly_period_end);
                const isUrgent = daysUntilEnd !== null && daysUntilEnd <= 2;
                const periodExpired = isPeriodExpired(policy.biweekly_period_end);
                
                return (
                  <div 
                    key={policy.id}
                    id={`policy-${policy.id}`}
                    className={`flex items-center justify-between p-4 border rounded-lg transition-all duration-300 ${
                      policy.status === 'resolved'
                        ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                        : policy.status === 'reviewed'
                        ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                        : isUrgent 
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' 
                        : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        policy.status === 'resolved'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : policy.status === 'reviewed'
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : isUrgent 
                          ? 'bg-red-100 dark:bg-red-900/30' 
                          : 'bg-amber-100 dark:bg-amber-900/30'
                      }`}>
                        <DollarSign className={`h-5 w-5 ${
                          policy.status === 'resolved'
                            ? 'text-green-600 dark:text-green-400'
                            : policy.status === 'reviewed'
                            ? 'text-blue-600 dark:text-blue-400'
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
                          Policy: ${policy.policy_amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Broker Fee: ${policy.broker_fee} • Auto Bonus: ${policy.current_bonus}
                          {policy.admin_bonus && policy.admin_bonus > 0 && (
                            <> • High Value Bonus: ${policy.admin_bonus}</>
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
                              disabled={processingActions.has(policy.id)}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              {processingActions.has(policy.id) ? 'Processing...' : 'Unresolve'}
                            </Button>
                          )
                        ) : policy.status === 'reviewed' ? (
                          // Show unreview button for reviewed policies
                          !periodExpired && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReviewPayroll(policy)}
                                title="Review and set additional bonus for this high-value policy"
                              >
                                <Eye className="mr-1 h-3 w-3" />
                                Set Bonus
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnresolve(policy.id)}
                                title="Mark this policy as pending again"
                                className="text-amber-700 border-amber-300 hover:bg-amber-50"
                                disabled={processingActions.has(policy.id)}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                {processingActions.has(policy.id) ? 'Processing...' : 'Unreview'}
                              </Button>
                            </>
                          )
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReviewPayroll(policy)}
                              title="Review and set additional bonus for this high-value policy"
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              Set Bonus
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                console.log('🖱️ Review button clicked for policy:', policy.id, 'status:', policy.status, 'processingActions:', Array.from(processingActions));
                                handleMarkAsReviewed(policy.id);
                              }}
                              title="Review this policy and update payroll"
                              className="bg-[#005cb3] hover:bg-[#005cb3]/90 text-white"
                              disabled={processingActions.has(policy.id)}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              {processingActions.has(policy.id) ? 'Processing...' : 'Review'}
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
      
      {/* Admin Bonus Management Dialog */}
      <Dialog open={bonusDialogOpen} onOpenChange={setBonusDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Admin Bonus</DialogTitle>
          </DialogHeader>
          
          {selectedPolicy && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Policy:</span>
                  <span className="ml-2 font-medium">{selectedPolicy.policy_number}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="ml-2 font-medium">${selectedPolicy.policy_amount?.toLocaleString()}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Auto Bonus:</span>
                  <span className="ml-2 font-medium">${selectedPolicy.current_bonus || 0}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bonus-amount">Admin Bonus Amount ($)</Label>
                <Input
                  id="bonus-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter bonus amount"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bonus-notes">Notes (Optional)</Label>
                <textarea
                  id="bonus-notes"
                  className="w-full p-2 border rounded-md text-sm"
                  rows={3}
                  placeholder="Add notes about this bonus decision..."
                  value={bonusNotes}
                  onChange={(e) => setBonusNotes(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleSaveBonus}
                  className="flex-1 bg-[#005cb3] hover:bg-[#005cb3]/90"
                >
                  Set Bonus
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setBonusDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export the scroll function for external use
export { HighValuePolicyNotifications as default }; 