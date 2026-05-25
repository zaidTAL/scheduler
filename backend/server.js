require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// Environment Variable Validation
const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'GROQ_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`[FATAL] Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Import routes
const authRoutes = require('./routes/auth.routes');
const webhookRoutes = require('./routes/webhook.routes');
const userRoutes = require('./routes/user.routes');

// Initialize Express app
const app = express();

// Enable 'trust proxy' (Required for rate limiting when behind ngrok/proxies)
app.set('trust proxy', 1);

// 1. SECURITY HEADERS (Helmet)
app.use(helmet());

// 2. CORS (Restricted origin recommended for production)
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// 3. RATE LIMITING (DDoS Protection)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/', limiter); // Apply to all API routes

// Stricter limiter for auth (Brute-force protection)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 attempts per hour
  message: {
    success: false,
    message: 'Too many login/register attempts, please try again after an hour'
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// 4. PAYLOAD LIMITS (Prevent large body attacks)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/**
 * Express 5 Compatible Security Engine
 * Protects against NoSQL Injection, XSS, and HPP without overwriting req.query
 */
const securityEngine = (req, res, next) => {
  const sanitize = (data) => {
    if (typeof data !== 'object' || data === null) {
      return typeof data === 'string' ? data.replace(/<[^>]*>?/gm, '') : data;
    }

    for (let key in data) {
      // 1. NoSQL Injection: Remove keys starting with $ or containing .
      if (key.startsWith('$') || key.includes('.')) {
        delete data[key];
        continue;
      }

      // 2. XSS: Clean string values
      if (typeof data[key] === 'string') {
        data[key] = data[key].replace(/<[^>]*>?/gm, '');
      } 
      // 3. HPP (HTTP Parameter Pollution): If value is an array, take only the last element
      else if (Array.isArray(data[key])) {
        data[key] = data[key][data[key].length - 1];
        if (typeof data[key] === 'string') {
          data[key] = data[key].replace(/<[^>]*>?/gm, '');
        }
      }
      // Recursive call for nested objects
      else if (typeof data[key] === 'object') {
        sanitize(data[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

app.use(securityEngine);

// Connect to database
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/user', userRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Scheduler API is running' });
});

// Error handling middleware (Centralized)
app.use((err, req, res, next) => {
  // Log the error for developers
  console.error(`[Error] ${err.name}: ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Handle specific errors
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Resource not found (Invalid ID)' });
  }
  if (err.code === 11000) {
    return res.status(400).json({ success: false, message: 'Duplicate field value entered' });
  }
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({ success: false, message: message.join(', ') });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Your session has expired. Please log in again.' });
  }

  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Don't leak stack trace in production
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
});
