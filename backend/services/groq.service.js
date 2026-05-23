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
   * Get system prompt for task/meeting parser
   * @param {string} timezone - User's timezone
   * @param {boolean} isMultilingual - Whether to allow Urdu/Roman Urdu
   * @returns {string} System prompt
   */
  getSystemPrompt(timezone = 'Asia/Karachi', isMultilingual = false) {
    const currentTime = new Date().toLocaleString('en-US', { timeZone: timezone });

    let prompt = `You are a task and calendar event parser. Extract scheduling information from natural language messages.

Detect the action:
- Creating new → action = "create"
- "delete", "remove", "cancel" → action = "delete"
- "change priority", "move to p1/p2/p3", "reprioritize" → action = "update_priority"
- "mark done", "complete", "finished" → action = "complete"
- "list", "show my schedule", "what am i doing", "whats next", "upcoming" → action = "list"

Detect the type:
- If message contains words like "meeting", "call", "appointment", "schedule with someone", "discussion" → type = "meeting" (goes to Google Calendar)
- If message contains words like "task", "todo", "remind me to", "don't forget", "complete", "finish", "submit" → type = "task" (goes to Google Tasks)
- If unclear → default to "task"

Detect priority:
- "p1", "priority 1", "most important", "urgent", "asap" → priority = "p1"
- "p2", "priority 2", "important" → priority = "p2"
- "p3", "priority 3", "low priority", "whenever" → priority = "p3"
- No priority mentioned → priority = null

Return ONLY valid JSON:
{
  "action": "create" | "delete" | "update_priority" | "complete" | "list",
  "type": "task" | "meeting",
  "title": "string",
  "description": "string",
  "dateTime": "ISO 8601 string or null",
  "duration": minutes_as_number_or_null,
  "priority": "p1" | "p2" | "p3" | null,
  "targetTitle": "keyword to find existing task/event (for delete/update/list actions)",
  "newPriority": "p1" | "p2" | "p3" | null (only for update_priority action)
}

Current date/time (${timezone}): ${currentTime}
Return ONLY the JSON object. No markdown. No explanation.`;

    if (isMultilingual) {
      prompt += `

The user may write in Urdu or Roman Urdu. Understand and parse correctly. Always return JSON in English regardless of input language.`;
    }

    return prompt;
  }

  /**
   * Parse task from natural language using Groq (Llama 4 Scout)
   * @param {string} message - Natural language message
   * @param {string} timezone - User's timezone
   * @param {boolean} isMultilingual - Whether user is on Pro plan (allows Urdu/Roman Urdu)
   * @returns {Promise<object>} Parsed task data
   */
  async parseTaskWithAI(message, timezone = 'Asia/Karachi', isMultilingual = false) {
    try {
      const systemPrompt = this.getSystemPrompt(timezone, isMultilingual);

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
        temperature: 0.1,
        max_tokens: 500
      });

      let raw = response.choices[0].message.content.trim();

      // Remove markdown code blocks if present
      raw = raw.replace(/^```(?:json)?\s*/, '').replace(/```$/, '');

      const parsedContent = JSON.parse(raw);
      return parsedContent;
    } catch (error) {
      console.error('Error parsing task with Groq:', error.message);
      throw error;
    }
  }

  /**
   * Transcribe audio using Groq Whisper API
   * @param {Blob} audioBlob - Audio file blob
   * @param {boolean} isMultilingual - Whether to allow auto-detection (Pro plan)
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(audioBlob, isMultilingual = false) {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.ogg');
      formData.append('model', 'whisper-large-v3');
      formData.append('response_format', 'json');

      // Pro plan: auto-detect language, Plus plan: force English
      if (!isMultilingual) {
        formData.append('language', 'en');
      }

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
