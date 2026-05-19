const twilio = require('twilio');
const axios = require('axios');
const GroqService = require('./groq.service');

class TwilioService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    
    // Check ensure karein ke agar configuration mein galti se HX key aa jaye toh use clear karein
    const serviceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    this.messagingServiceSid = (serviceSid && serviceSid.startsWith('MG')) ? serviceSid : null;
  }

  /**
   * Strictly sanitizes numbers for WhatsApp E.164 format
   * Handles: 0330..., 92330..., +92330..., 330...
   */
  formatE164(phoneNumber) {
    if (!phoneNumber) return '';
    
    // 1. Remove all non-numeric characters
    let cleaned = phoneNumber.toString().replace(/\D/g, '');

    // 2. Handle Pakistani local format (starts with 03)
    if (cleaned.startsWith('03') && cleaned.length === 11) {
      cleaned = '92' + cleaned.substring(1);
    } 
    // 3. Handle cases where user starts with 3 (missing 0 or 92)
    else if (cleaned.startsWith('3') && cleaned.length === 10) {
      cleaned = '92' + cleaned;
    }
    
    // Prefix clean checking for the final format
    return `whatsapp:+${cleaned}`;
  }

  /**
   * Send WhatsApp message via Twilio (Regular session messages)
   * @param {string} to - Recipient phone number
   * @param {string} body - Message body
   */
  async sendWhatsAppMessage(to, body) {
    try {
      const formattedTo = this.formatE164(to);
      
      const messageOptions = {
        to: formattedTo,
        body: body
      };

      if (this.messagingServiceSid) {
        messageOptions.messagingServiceSid = this.messagingServiceSid;
      } else if (this.twilioWhatsAppNumber) {
        messageOptions.from = this.formatE164(this.twilioWhatsAppNumber);
      } else {
        throw new Error('Neither TWILIO_WHATSAPP_NUMBER nor TWILIO_MESSAGING_SERVICE_SID is configured.');
      }

      const message = await this.client.messages.create(messageOptions);
      console.log(`WhatsApp message sent: ${message.sid}`);
      return message;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error.message);
      throw error;
    }
  }

  /**
   * Send WhatsApp message using a Template (Required for outbound production messages)
   * @param {string} to - Recipient phone number
   * @param {string} contentSid - Twilio Content SID (starts with HX...)
   * @param {object} variables - Template variables (e.g., { "1": "John" })
   */
  async sendWhatsAppTemplate(to, contentSid, variables = {}) {
    try {
      const formattedTo = this.formatE164(to);
      
      // Target correct key from parameter fallback to environment variable if empty
      const targetContentSid = contentSid || process.env.TWILIO_TEMPLATE_SID;

      if (!targetContentSid) {
        throw new Error('Template Content SID (HX...) is missing.');
      }

      const messageOptions = {
        to: formattedTo,
        contentSid: targetContentSid // Always mapped correctly to contentSid property
      };

      // Only add contentVariables if there are actually variables to send
      if (variables && Object.keys(variables).length > 0) {
        messageOptions.contentVariables = JSON.stringify(variables);
      }

      // Safeguard: Content/Template API requires standard routing validation
      if (this.messagingServiceSid) {
        messageOptions.messagingServiceSid = this.messagingServiceSid;
      } else if (this.twilioWhatsAppNumber) {
        messageOptions.from = this.formatE164(this.twilioWhatsAppNumber);
      } else {
        throw new Error('Valid Sender (TWILIO_WHATSAPP_NUMBER) is required for templates.');
      }

      const message = await this.client.messages.create(messageOptions);
      console.log(`WhatsApp template sent successfully: ${message.sid} (To: ${formattedTo})`);
      return message;
    } catch (error) {
      console.error('Error sending WhatsApp template:', error.message);
      throw error;
    }
  }

  /**
   * Download audio from Twilio and transcribe using Groq Whisper
   */
  async transcribeVoice(mediaUrl, isMultilingual = false) {
    try {
      const audioResponse = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'audio/*'
        }
      });

      const audioBlob = new Blob([audioResponse.data], { type: 'audio/ogg' });
      const transcription = await GroqService.transcribeAudio(audioBlob, isMultilingual);
      return transcription;
    } catch (error) {
      console.error('Error transcribing voice message:', error.message);
      throw error;
    }
  }
}

module.exports = new TwilioService();