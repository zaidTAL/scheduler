const express = require('express');
const router = express.Router();
const { handleWhatsAppMessage, handleStatusUpdate } = require('../controllers/webhook.controller');

// WhatsApp webhook - receives incoming messages
router.post('/whatsapp', handleWhatsAppMessage);

// WhatsApp status updates (optional)
router.post('/whatsapp-status', handleStatusUpdate);

module.exports = router;
