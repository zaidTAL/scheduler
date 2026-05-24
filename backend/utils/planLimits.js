const PLAN_LIMITS = {
  free: {
    dailyLimit: 7,
    allowedFormats: ['text', 'meeting'],
    allowedTypes: ['task'],
    allowedActions: ['create'], // 'delete' and 'update' allowed via 10-min correction window in middleware
    maxPriority: 3,
    correctionWindowMinutes: 10,
    upgradeMessage: "Upgrade to Plus for voice support and meeting scheduling!"
  },
  plus: {
    dailyLimit: 20,
    allowedFormats: ['text', 'voice'],
    allowedTypes: ['task', 'meeting'],
    allowedActions: ['create'], // 'delete' and 'update' allowed via 10-min correction window in middleware
    maxPriority: 10,
    correctionWindowMinutes: 10,
    upgradeMessage: "Upgrade to Pro for unlimited usage and full operational control!"
  },
  pro: {
    dailyLimit: Infinity,
    allowedFormats: ['text', 'voice'],
    allowedTypes: ['task', 'meeting'],
    allowedActions: ['create', 'delete', 'update_priority', 'complete'],
    maxPriority: Infinity,
    correctionWindowMinutes: Infinity,
    multilingual: true
  }
};

module.exports = PLAN_LIMITS;
