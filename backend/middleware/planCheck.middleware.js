const PLAN_LIMITS = require('../utils/planLimits');

const Task = require('../models/Task');

/**
 * Robust middleware/helper to check plan limits and operational permissions.
 * Can be used as a standard Express middleware or called manually in controllers.
 * 
 * @param {Object} user - The Mongoose user document
 * @param {Object} options - Request details (messageType, action, type, priority)
 * @returns {Object} { allowed: boolean, message: string }
 */
const checkPlanLimits = async (user, options = {}) => {
  const { 
    messageType = 'text', 
    action = 'create', 
    type = 'task', 
    priority = null 
  } = options;

  const userPlan = user.plan || 'free';
  const limits = PLAN_LIMITS[userPlan];

  if (!limits) {
    return { allowed: false, message: "Invalid plan configuration. Please contact support." };
  }

  // 1. Reset usage counters if a new day has started
  const now = new Date();
  const lastReset = new Date(user.usage.lastResetDate);
  const isNewDay = now.toDateString() !== lastReset.toDateString();

  if (isNewDay) {
    user.usage.tasksToday = 0;
    user.usage.meetingsToday = 0;
    user.usage.voiceToday = 0;
    user.usage.lastResetDate = now;
  }

  // 2. Check Daily Consumption (Cumulative tasks + meetings)
  // 'list' action does not count towards daily creation limits
  if (action === 'create') {
    const currentTotal = user.usage.tasksToday + user.usage.meetingsToday;
    if (currentTotal >= limits.dailyLimit) {
      return {
        allowed: false,
        message: `Daily limit reached (${limits.dailyLimit}/${limits.dailyLimit}). ${limits.upgradeMessage || 'Upgrade for more!'}`
      };
    }
  }

  // 3. Check Message Format (Text vs Voice)
  if (messageType === 'voice' && !limits.allowedFormats.includes('voice')) {
    return {
      allowed: false,
      message: `Voice messages are not supported on the ${userPlan.toUpperCase()} plan. ${limits.upgradeMessage}`
    };
  }

  // 4. Check Operation Type (Task vs Meeting)
  if (type === 'meeting' && !limits.allowedTypes.includes('meeting')) {
    return {
      allowed: false,
      message: `Meeting scheduling is not available on the ${userPlan.toUpperCase()} plan. ${limits.upgradeMessage}`
    };
  }

  // 5. Check Action (Create vs Update/Delete/Complete vs List)
  if (action === 'list') {
    return { allowed: true }; // Everyone can list their schedule
  }

  if (action !== 'create' && !limits.allowedActions.includes(action)) {
    // Check for Correction Window (10 minutes)
    const tenMinutesAgo = new Date(Date.now() - limits.correctionWindowMinutes * 60 * 1000);
    const recentTask = await Task.findOne({
      userId: user._id,
      createdAt: { $gte: tenMinutesAgo },
      status: 'scheduled'
    });

    if (!recentTask) {
      return {
        allowed: false,
        message: `The '${action.replace('_', ' ')}' operation is restricted on your current plan. ${limits.upgradeMessage}`
      };
    }
    // If recent task exists, we allow the correction (delete/update)
    console.log(`[Correction Window] Allowing '${action}' for ${user.name} via correction window.`);
  }

  // 6. Check Priority Boundaries
  if (priority) {
    const pLevel = parseInt(priority.replace('p', '')) || 0;
    if (pLevel > limits.maxPriority) {
      return {
        allowed: false,
        message: `Priority ${priority} exceeds your plan limit (Max: p${limits.maxPriority}). ${limits.upgradeMessage}`
      };
    }
  }

  return { allowed: true };
};

/**
 * Standard Express Middleware wrapper for early checks (e.g., messageType and consumption)
 */
const planMiddleware = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ allowed: false, message: "Unauthorized" });

    // Initial check (before AI parsing)
    const result = await checkPlanLimits(user, { 
      messageType: req.body.MediaUrl0 ? 'voice' : 'text' // Twilio specific check example
    });

    if (!result.allowed) {
      return res.status(403).json(result);
    }

    next();
  } catch (error) {
    console.error("Middleware Error:", error);
    res.status(500).json({ allowed: false, message: "Plan validation failed." });
  }
};

/**
 * Increments usage after successful operation
 */
const incrementUsage = async (user, type, isVoice = false) => {
  if (type === 'meeting') {
    user.usage.meetingsToday += 1;
    user.usage.totalMeetings += 1;
  } else {
    user.usage.tasksToday += 1;
    user.usage.totalTasks += 1;
  }

  if (isVoice) {
    user.usage.voiceToday += 1;
  }

  await user.save();
};

module.exports = {
  checkPlanLimits,
  planMiddleware,
  incrementUsage
};
