const User = require('../models/User');
const Task = require('../models/Task');
const GoogleCalendarService = require('../services/googleCalendar.service');

/**
 * Get user profile
 * GET /api/user/profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
};

/**
 * Update user profile
 * PUT /api/user/profile
 */
const updateProfile = async (req, res) => {
  try {
    const {
      name,
      availability,
      sleepTime,
      calendarType,
      calendlyToken
    } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields
    if (name) user.name = name;
    if (availability) user.availability = availability;
    if (sleepTime) user.sleepTime = sleepTime;
    if (calendarType) user.calendarType = calendarType;
    if (calendlyToken !== undefined) user.calendlyToken = calendlyToken;

    await user.save();

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

/**
 * Get user's tasks
 * GET /api/user/tasks
 */
const getTasks = async (req, res) => {
  try {
    const { status, limit = 20 } = req.query;

    const query = { userId: req.user.id };
    if (status) {
      query.status = status;
    }

    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error('Get tasks error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get tasks',
      error: error.message
    });
  }
};

/**
 * Save Google OAuth tokens to user
 * POST /api/user/google-tokens
 */
const saveGoogleTokens = async (req, res) => {
  try {
    const { access_token, refresh_token, expiry_date } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.googleTokens = {
      access_token,
      refresh_token,
      expiry_date
    };

    await user.save();

    res.json({
      success: true,
      message: 'Google Calendar connected successfully'
    });
  } catch (error) {
    console.error('Save Google tokens error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to save Google tokens',
      error: error.message
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getTasks,
  saveGoogleTokens
};
