const User = require('../models/User');
const Task = require('../models/Task');
const TwilioService = require('../services/twilio.service');
const GroqService = require('../services/groq.service');
const GoogleCalendarService = require('../services/googleCalendar.service');
const CalendlyService = require('../services/calendly.service');

/**
 * Handle incoming WhatsApp messages
 * POST /api/webhook/whatsapp
 */
const handleWhatsAppMessage = async (req, res) => {
  try {
    // Extract data from Twilio request
    const from = req.body.From; // Phone number (e.g., whatsapp:+923302713461)
    const body = req.body.Body; // Message text
    const mediaUrl0 = req.body.MediaUrl0; // Voice message URL (if any)

    console.log(`Received message from ${from}: ${body || '[voice message]'}`);

    // Strip 'whatsapp:' prefix to match stored phone number format
    const phoneNumber = from.replace('whatsapp:', '');

    // Find user by phone number
    const user = await User.findOne({ phone: phoneNumber });
    if (!user) {
      // Send error message
      await TwilioService.sendWhatsAppMessage(
        from,
        'Sorry, we could not find your account. Please register first at Digital GK Book.'
      );
      return res.status(200).send('OK');
    }

    let messageText = body;
    let source = 'text';

    // Handle voice message
    if (mediaUrl0) {
      console.log('Processing voice message...');
      try {
        messageText = await TwilioService.transcribeVoice(mediaUrl0);
        source = 'voice';
        console.log(`Transcribed: ${messageText}`);
      } catch (transcriptionError) {
        await TwilioService.sendWhatsAppMessage(
          from,
          'Sorry, I could not understand your voice message. Please try again or send a text message.'
        );
        return res.status(200).send('OK');
      }
    }

    // Parse task using AI (Groq)
    let parsedData;
    try {
      parsedData = await GroqService.parseTaskWithAI(messageText);
      console.log('Parsed task:', parsedData);
    } catch (parseError) {
      await TwilioService.sendWhatsAppMessage(
        from,
        'Sorry, I could not understand your request. Please be more specific about the task/meeting details.\n\nExample: "Schedule meeting with Ali tomorrow at 3pm for 1 hour"'
      );
      return res.status(200).send('OK');
    }

    // Create calendar event based on user's calendar type
    let calendarEventId = null;
    let status = 'pending';

    try {
      if (user.calendarType === 'google_calendar' && user.googleTokens) {
        // Create Google Calendar event
        const event = await GoogleCalendarService.createEvent(
          user.googleTokens,
          parsedData
        );
        calendarEventId = event.id;
        status = 'scheduled';

        // Update user's tokens if refreshed
        if (event.updatedTokens) {
          user.googleTokens = event.updatedTokens;
          await user.save();
        }
      } else if (user.calendarType === 'calendly' && user.calendlyToken) {
        // Create Calendly event
        const event = await CalendlyService.createScheduledEvent(
          user.calendlyToken,
          parsedData
        );
        calendarEventId = event.id || event.uri;
        status = 'scheduled';
      }
    } catch (calendarError) {
      console.error('Calendar error:', {
        message: calendarError.message,
        stack: calendarError.stack,
        calendarType: user.calendarType,
        hasTokens: !!user.googleTokens
      });
      status = 'failed';
    }

    // Save task to database
    const task = await Task.create({
      userId: user._id,
      rawMessage: messageText,
      parsedData,
      calendarEventId,
      status,
      source
    });

    // Send confirmation message
    if (status === 'scheduled') {
      const eventDate = new Date(parsedData.dateTime);
      const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      const formattedTime = eventDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      await TwilioService.sendWhatsAppMessage(
        from,
        `✅ ${parsedData.type === 'meeting' ? 'Meeting' : 'Task'} Scheduled!\n\n` +
        `📌 ${parsedData.title}\n` +
        `📅 ${formattedDate} at ${formattedTime}\n` +
        `⏱️ Duration: ${parsedData.duration} minutes\n` +
        `${parsedData.description ? `\n📝 ${parsedData.description}\n` : ''}` +
        `\nReply "cancel" to cancel this ${parsedData.type}.`
      );
    } else {
      await TwilioService.sendWhatsAppMessage(
        from,
        `⚠️ I understood your request but could not add it to your calendar.\n\n` +
        `Task: ${parsedData.title}\n` +
        `Time: ${new Date(parsedData.dateTime).toLocaleString()}\n\n` +
        `Please check your calendar connection settings.`
      );
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(500).send('Error processing message');
  }
};

/**
 * Handle WhatsApp status updates (optional)
 * POST /api/webhook/whatsapp-status
 */
const handleStatusUpdate = async (req, res) => {
  try {
    const { MessageSid, MessageStatus } = req.body;
    console.log(`Message ${MessageSid} status: ${MessageStatus}`);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Status update error:', error.message);
    res.status(500).send('Error');
  }
};

module.exports = {
  handleWhatsAppMessage,
  handleStatusUpdate
};
