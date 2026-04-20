const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  getTasks,
  saveGoogleTokens
} = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes are protected
router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/tasks', getTasks);
router.post('/google-tokens', saveGoogleTokens);

module.exports = router;
