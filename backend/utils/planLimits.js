const PLAN_LIMITS = {
  free: {
    dailyLimit: 2,
    allowedFormats: ['text'],
    allowedTypes: ['task'],
    allowedActions: ['create'],
    maxPriority: 3, // Default p1-p3
    upgradeMessage: "Upgrade to Plus for voice support and higher daily limits!"
  },
  plus: {
    dailyLimit: 8,
    allowedFormats: ['text', 'voice'],
    allowedTypes: ['task'],
    allowedActions: ['create'],
    maxPriority: 10,
    upgradeMessage: "Upgrade to Pro for full operational access (meetings, updates, deletes) and unlimited priorities!"
  },
  pro: {
    dailyLimit: 25,
    allowedFormats: ['text', 'voice'],
    allowedTypes: ['task', 'meeting'],
    allowedActions: ['create', 'delete', 'update_priority', 'complete'],
    maxPriority: Infinity,
    multilingual: true
  }
};

module.exports = PLAN_LIMITS;
