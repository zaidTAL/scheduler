const User = require('../models/User');
const jwt = require('jsonwebtoken');
const TwilioService = require('../services/twilio.service');
const { sanitizePhoneNumber } = require('../utils/phoneUtils');

/**
 * Generate JWT token for user
 * @param {string} userId - User ID
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const {
      name,
      email,
      phone: rawPhone,
      password,
      availability,
      sleepTime,
      calendarType,
      calendlyToken,
      timezone
    } = req.body;

    // Sanitize phone number to strict E.164
    let phone;
    try {
      phone = sanitizePhoneNumber(rawPhone);
    } catch (sanitizationError) {
      return res.status(400).json({
        success: false,
        message: sanitizationError.message
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }

    // Validate Calendly token if provided
    let calendlyUserUri = null;
    if (calendarType === 'calendly' && calendlyToken) {
      try {
        const CalendlyService = require('../services/calendly.service');
        const userInfo = await CalendlyService.getCalendlyUser(calendlyToken);
        // Store the user URI for future API calls
        calendlyUserUri = userInfo.uri;
      } catch (calendlyError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Calendly API token. Please check and try again.'
        });
      }
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      phone,
      password,
      availability: availability || [],
      sleepTime: sleepTime || {},
      calendarType: calendarType || 'google_calendar',
      calendlyToken: calendlyToken || null,
      calendlyUserUri,
      timezone: timezone || 'Asia/Karachi',
      isVerified: true
    });

    // Send welcome WhatsApp message
    try {
      const templateSid = process.env.TWILIO_TEMPLATE_SID;

      if (templateSid) {
        // Use Template (Best for Production)
        // Since your template 'scheduler_welcome' has no variables, 
        // we call this with an empty object so the service omits contentVariables.
        await TwilioService.sendWhatsAppTemplate(user.phone, templateSid, {});
        console.log(`Welcome template [${templateSid}] triggered successfully for ${user.phone}`);
      } else {
        // Fallback for development/sandbox
        console.log('No TWILIO_TEMPLATE_SID configured, skipping template send.');
      }
    } catch (whatsappError) {
      console.error('WhatsApp registration message failure:', whatsappError.message);
      // We don't block registration if the message fails
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        calendarType: user.calendarType
      }
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    console.error('Full error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        calendarType: user.calendarType
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

/**
 * Get current user
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
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
    console.error('Get me error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get user',
      error: error.message
    });
  }
};

/**
 * Initiate Google OAuth
 * GET /api/auth/google
 */
const googleAuth = (req, res) => {
  try {
    const { google } = require('googleapis');
    const jwt = require('jsonwebtoken');

    // Get token from Authorization header or query param
    const authHeader = req.headers.authorization;
    const tokenFromQuery = req.query.token;
    const token = authHeader?.split(' ')[1] || tokenFromQuery;

    if (!token) {
      return res.redirect(`${process.env.FRONTEND_URL}/?error=auth_token_required`);
    }

    // Verify the token to get user ID
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      return res.redirect(`${process.env.FRONTEND_URL}/?error=invalid_token`);
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/tasks',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    // Pass user ID in state parameter (base64 encoded for safety)
    const state = Buffer.from(JSON.stringify({ userId: decoded.id })).toString('base64');

    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      include_granted_scopes: false,
      state
    });

    res.redirect(authorizeUrl);
  } catch (error) {
    console.error('Google auth error:', error.message);
    res.redirect(`${process.env.FRONTEND_URL}/?error=google_auth_failed`);
  }
};

/**
 * Google OAuth callback
 * GET /api/auth/google/callback
 */
const googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const { google } = require('googleapis');

    // Decode state to get user ID
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch (decodeError) {
      console.error('State decode failed:', decodeError.message);
      return res.redirect(`${process.env.FRONTEND_URL}/?error=invalid_state`);
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Set credentials to get user info
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Find user by ID from state (not by email)
    const user = await User.findById(stateData.userId);

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/?error=user_not_found`);
    }

    // Save Google tokens to user
    user.googleTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    };
    await user.save();

    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL}/?calendar=connected`);
  } catch (error) {
    console.error('Google callback error:', error.message);
    res.redirect(`${process.env.FRONTEND_URL}/?calendar=error&reason=token_failed`);
  }
};

module.exports = {
  register,
  login,
  getMe,
  googleAuth,
  googleCallback
};
