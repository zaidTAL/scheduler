const Groq = require('groq-sdk');
const axios = require('axios');
const FormData = require('form-data');

class GroqService {
  constructor() {
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }

  /**
   * Parse task from natural language using Groq (Llama 3.1 70B)
   * @param {string} message - Natural language message
   * @returns {Promise<object>} Parsed task data
   */
  async parseTaskWithAI(message) {
    try {
      const currentDate = new Date().toISOString();
      const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });

      const systemPrompt = `You are a task parser. Extract scheduling information from natural language.
Return ONLY valid JSON with this structure:
{
  "title": "string",
  "description": "string",
  "dateTime": "ISO 8601 string in Asia/Karachi timezone",
  "duration": minutes_as_number,
  "type": "task" or "meeting"
}
Current time in Asia/Karachi timezone: ${currentTime}
If date/time is relative (e.g. 'tomorrow at 3pm'), resolve it to Asia/Karachi timezone.
For example: "tomorrow at 3pm" means 3:00 PM Pakistan Standard Time.
Output dateTime as ISO 8601 format (e.g., "2026-04-18T15:00:00").
If any field is unclear, make a reasonable assumption.
Return ONLY the JSON object, no markdown, no explanation.`;

      const response = await this.client.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      const parsedContent = JSON.parse(response.choices[0].message.content);
      return parsedContent;
    } catch (error) {
      console.error('Error parsing task with Groq:', error.message);
      throw error;
    }
  }

  /**
   * Transcribe audio using Groq Whisper API
   * @param {Blob} audioBlob - Audio file blob
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(audioBlob) {
    try {
      // Groq Whisper API requires multipart form data
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.ogg');
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'json');
      formData.append('language', 'en');

      const response = await axios.post(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            ...formData.getHeaders()
          }
        }
      );

      return response.data.text;
    } catch (error) {
      console.error('Error transcribing audio with Groq:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new GroqService();
