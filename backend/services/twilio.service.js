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
  }

  /**
   * Send WhatsApp message via Twilio
   * @param {string} to - Recipient phone number
   * @param {string} body - Message body
   */
  async sendWhatsAppMessage(to, body) {
    try {
      // Ensure the number has the whatsapp: prefix
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      const message = await this.client.messages.create({
        from: this.twilioWhatsAppNumber,
        to: formattedTo,
        body: body
      });
      console.log(`WhatsApp message sent: ${message.sid}`);
      return message;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error.message);
      throw error;
    }
  }

  /**
   * Download audio from Twilio and transcribe using Groq Whisper
   * @param {string} mediaUrl - Media URL from Twilio
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeVoice(mediaUrl) {
    try {
      // Download the audio file
      const audioResponse = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'audio/*'
        }
      });

      // Create blob from audio data
      const audioBlob = new Blob([audioResponse.data], { type: 'audio/ogg' });

      // Use Groq Whisper API to transcribe
      const transcription = await GroqService.transcribeAudio(audioBlob);
      return transcription;
    } catch (error) {
      console.error('Error transcribing voice message:', error.message);
      throw error;
    }
  }
}

module.exports = new TwilioService();
