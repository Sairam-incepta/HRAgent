class AppSettings {
  private _highValueThreshold: number = 5000;

  get highValueThreshold(): number {
    return this._highValueThreshold;
  }

  setHighValueThreshold(value: number): void {
    this._highValueThreshold = value;
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('highValueThreshold', value.toString());
    }
  }

  // Load from localStorage on startup
  loadSettings(): void {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('highValueThreshold');
      if (saved) {
        this._highValueThreshold = parseInt(saved, 10);
      }
    }
  }
}

export const appSettings = new AppSettings(); 