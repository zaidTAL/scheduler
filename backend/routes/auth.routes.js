const express = require('express');
const router = express.Router();
const { register, login, getMe, googleAuth, googleCallback } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

// Protected routes
router.get('/me', protect, getMe);

module.exports = router;
