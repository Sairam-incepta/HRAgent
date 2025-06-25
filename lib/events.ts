// Simple event system for dashboard refreshes
type EventType = 'policy_sale' | 'client_review' | 'request_submitted' | 'request_status_updated' | 'time_logged' | 'daily_summary' | 'policy_sales_updated' | 'high_value_policy_updated';

interface EventData {
  policy_sale: { employeeId: string; policyId: string };
  client_review: { employeeId: string; reviewId: string };
  request_submitted: { employeeId: string; requestId: string };
  request_status_updated: { requestId: string; status: string };
  time_logged: { employeeId: string; logId: string };
  daily_summary: { employeeId: string; summaryId: string };
  policy_sales_updated: { employeeId?: string; type: 'new' | 'updated' | 'deleted' };
  high_value_policy_updated: { notificationId: string; status: string };
}

class DashboardEvents {
  private listeners: Map<EventType, Set<(data?: any) => void>> = new Map();

  on<T extends EventType>(event: T, callback: (data?: EventData[T]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit<T extends EventType>(event: T, data?: EventData[T]) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  // Helper method to emit policy sales update with employee context
  emitPolicySaleUpdate(employeeId: string, type: 'new' | 'updated' | 'deleted' = 'new') {
    this.emit('policy_sales_updated', { employeeId, type });
    // Also emit the legacy event for backward compatibility
    this.emit('policy_sale', { employeeId, policyId: '' });
  }
}

export const dashboardEvents = new DashboardEvents();

// Helper functions to emit events when data changes
export const notifyPolicySale = (employeeId?: string) => {
  if (employeeId) {
    dashboardEvents.emitPolicySaleUpdate(employeeId, 'new');
  } else {
    dashboardEvents.emit('policy_sale');
  }
};

export const notifyClientReview = () => dashboardEvents.emit('client_review');
export const notifyRequestSubmitted = () => dashboardEvents.emit('request_submitted');
export const notifyTimeLogged = () => dashboardEvents.emit('time_logged');
export const notifyDailySummary = () => dashboardEvents.emit('daily_summary'); 