// Group mutable popup state by responsibility.
export const state = {
  timers: {
    rateLimit: null,
    positionAge: null,
    manualRefresh: null
  },

  settings: {
    saving: false,
    detectedLocationAccuracyMiles: null
  },

  refresh: {
    inProgress: false,
    manualAvailableAt: 0,
    blockedByRateLimit: false,
    blockedByBudget: false
  }
};
