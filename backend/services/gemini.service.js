const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });
  }

  /**
   * Get system prompt for task/meeting parser
   */
  getSystemPrompt(timezone = 'Asia/Karachi', isMultilingual = false) {
    const currentTime = new Date().toLocaleString('en-US', { timeZone: timezone });

    let prompt = `You are a task and calendar event parser. Extract scheduling information from natural language messages.

Detect the action:
- Creating new → action = "create"
- "delete", "remove", "cancel" → action = "delete"
- "change priority", "move to p1/p2/p3", "reprioritize" → action = "update_priority"
- "change time", "move to", "reschedule", "change duration", "update" → action = "update"
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
  "action": "create" | "delete" | "update_priority" | "update" | "complete" | "list",
  "type": "task" | "meeting",
  "title": "string",
  "description": "string",
  "dateTime": "ISO 8601 string or null",
  "duration": minutes_as_number_or_null,
  "priority": "p1" | "p2" | "p3" | null,
  "targetTitle": "keyword to find existing task/event (for delete/update/complete actions)",
  "newPriority": "p1" | "p2" | "p3" | null (only for update_priority action)
}

Current date/time (${timezone}): ${currentTime}
Return ONLY the JSON object. No explanation.`;

    if (isMultilingual) {
      prompt += `\n\nThe user may write in Urdu or Roman Urdu. Understand and parse correctly. Always return JSON in English regardless of input language.`;
    }

    return prompt;
  }

  /**
   * Parse task from natural language using Gemini
   */
  async parseTaskWithAI(message, timezone = 'Asia/Karachi', isMultilingual = false) {
    try {
      const systemPrompt = this.getSystemPrompt(timezone, isMultilingual);
      
      const result = await this.model.generateContent([
        { text: systemPrompt },
        { text: `User message: ${message}` }
      ]);

      const response = await result.response;
      let text = response.text().trim();
      
      // Sanitization: Remove markdown if Gemini included it despite generationConfig
      text = text.replace(/^```(?:json)?\s*/, '').replace(/```$/, '');
      
      return JSON.parse(text);
    } catch (error) {
      console.error('Error parsing task with Gemini:', error.message);
      throw error;
    }
  }

  /**
   * Transcribe audio using Gemini 1.5 Flash (Supports audio files directly)
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} mimeType - MIME type of the audio
   */
  async transcribeAudio(audioBuffer, mimeType = 'audio/ogg', isMultilingual = false) {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = isMultilingual 
        ? "Transcribe this audio. It might be in English, Urdu, or Roman Urdu. Return only the transcription text."
        : "Transcribe this audio in English. Return only the transcription text.";

      const result = await model.generateContent([
        {
          inlineData: {
            data: audioBuffer.toString('base64'),
            mimeType: mimeType
          }
        },
        { text: prompt }
      ]);

      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error transcribing audio with Gemini:', error.message);
      throw error;
    }
  }
}

module.exports = new GeminiService();
