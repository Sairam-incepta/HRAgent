// Simple event system for dashboard refreshes
type EventType = 'policy_sale' | 'client_review' | 'request_submitted' | 'time_logged' | 'daily_summary';

type EventListener = () => void;

class EventEmitter {
  private listeners: Map<EventType, EventListener[]> = new Map();

  on(event: EventType, listener: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: EventType, listener: EventListener) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  emit(event: EventType) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener());
    }
  }
}

export const dashboardEvents = new EventEmitter();

// Helper functions to emit events when data changes
export const notifyPolicySale = () => dashboardEvents.emit('policy_sale');
export const notifyClientReview = () => dashboardEvents.emit('client_review');
export const notifyRequestSubmitted = () => dashboardEvents.emit('request_submitted');
export const notifyTimeLogged = () => dashboardEvents.emit('time_logged');
export const notifyDailySummary = () => dashboardEvents.emit('daily_summary'); 