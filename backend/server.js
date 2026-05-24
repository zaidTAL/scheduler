require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth.routes');
const webhookRoutes = require('./routes/webhook.routes');
const userRoutes = require('./routes/user.routes');

// Initialize Express app
const app = express();

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

// 5. DATA SANITIZATION (NoSQL Injection & XSS)
app.use(mongoSanitize());
app.use(xss());

// 6. HTTP PARAMETER POLLUTION (Prevent HPP attacks)
app.use(hpp());

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
