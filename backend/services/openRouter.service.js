const { OpenRouter } = require('@openrouter/sdk');
const axios = require('axios');

class OpenRouterService {
  constructor() {
    this.client = new OpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      httpReferer: 'https://theailenders.github.io/Digital-GK-Book/', // Recommended for OpenRouter
      appTitle: 'AI Scheduler'
    });
    this.model = 'google/gemma-4-31b-it:free';
    this.transcriptionModel = 'nvidia/nemotron-3-nano-omni:free';
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
   * Parse task from natural language using OpenRouter (Gemma 4 Free)
   */
  async parseTaskWithAI(message, timezone = 'Asia/Karachi', isMultilingual = false) {
    try {
      const systemPrompt = this.getSystemPrompt(timezone, isMultilingual);
      
      const completion = await this.client.chat.send({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `User message: ${message}` }
        ],
        temperature: 0.1
      });

      let text = completion.choices[0].message.content.trim();
      
      // Sanitization: Remove markdown code blocks
      text = text.replace(/^```(?:json)?\s*/, '').replace(/```$/, '');
      
      return JSON.parse(text);
    } catch (error) {
      console.error('Error parsing task with OpenRouter:', error.message);
      throw error;
    }
  }

  /**
   * Transcribe audio using OpenRouter free multimodal models
   */
  async transcribeAudio(audioBuffer, mimeType = 'audio/ogg', isMultilingual = false) {
    try {
      // Using direct fetch for transcription as the SDK might be limited for audio
      const response = await axios.post(
        'https://openrouter.ai/api/v1/audio/transcriptions',
        {
          model: this.transcriptionModel,
          input_audio: {
            data: audioBuffer.toString('base64'),
            format: mimeType.split('/')[1] || 'ogg'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.text.trim();
    } catch (error) {
      // Fallback: If transcription endpoint fails, try sending as multimodal chat message
      try {
        const prompt = isMultilingual 
          ? "Transcribe this audio. Return only the transcription text."
          : "Transcribe this audio in English. Return only the transcription text.";

        const completion = await this.client.chat.send({
          model: this.transcriptionModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url', // OpenRouter often uses image_url for all media files in OpenAI format
                  url: `data:${mimeType};base64,${audioBuffer.toString('base64')}`
                }
              ]
            }
          ]
        });

        return completion.choices[0].message.content.trim();
      } catch (fallbackError) {
        console.error('Error transcribing audio with OpenRouter:', fallbackError.message);
        throw fallbackError;
      }
    }
  }
}

module.exports = new OpenRouterService();
