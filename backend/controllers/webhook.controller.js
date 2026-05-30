const User = require('../models/User');
const Task = require('../models/Task');
const TwilioService = require('../services/twilio.service');
const OpenRouterService = require('../services/openRouter.service');
const GoogleCalendarService = require('../services/googleCalendar.service');
const CalendlyService = require('../services/calendly.service');
const { checkPlanLimits, incrementUsage } = require('../middleware/planCheck.middleware');
const { sanitizePhoneNumber } = require('../utils/phoneUtils');

/**
 * Handle incoming WhatsApp messages with strict plan enforcement and phone sanitization.
 * POST /api/webhook/whatsapp
 */
const handleWhatsAppMessage = async (req, res) => {
  try {
    const { From, Body, MediaUrl0 } = req.body;
    const messageType = MediaUrl0 ? 'voice' : 'text';

    // 1. Strict Phone Sanitization
    let sanitizedPhone;
    try {
      // Twilio From usually looks like "whatsapp:+923366107910"
      const rawNumber = From.replace('whatsapp:', '');
      sanitizedPhone = sanitizePhoneNumber(rawNumber);
    } catch (phoneError) {
      console.error(`[Webhook] Phone Sanitization Failed: ${phoneError.message}`);
      return res.status(200).send('OK'); // Always return 200 to Twilio to avoid retries
    }

    // 2. Identify User & Early Plan Check (Daily Consumption & Format)
    const user = await User.findOne({ phone: sanitizedPhone });

    if (!user) {
      await TwilioService.sendWhatsAppMessage(
        From,
        "Welcome! It looks like you're not registered yet. Please sign up at our portal to start using the AI Scheduler."
      );
      return res.status(200).send('OK');
    }

    // Early Check: Daily limit and format (voice vs text)
    const earlyCheck = await checkPlanLimits(user, { messageType });
    if (!earlyCheck.allowed) {
      await TwilioService.sendWhatsAppMessage(From, earlyCheck.message);
      return res.status(200).send('OK');
    }

    let messageText = Body;

    // 3. Handle Voice Processing
    if (messageType === 'voice') {
      try {
        const isMultilingual = user.plan === 'pro';
        messageText = await TwilioService.transcribeVoice(MediaUrl0, isMultilingual);
        console.log(`[Voice] Transcribed for ${user.name}: ${messageText}`);
      } catch (transcribeError) {
        await TwilioService.sendWhatsAppMessage(From, "Sorry, I couldn't process that voice message. Please try sending text or a clearer voice note.");
        return res.status(200).send('OK');
      }
    }

    if (!messageText || messageText.trim() === '') {
      return res.status(200).send('OK');
    }

    // 4. AI Parsing (Groq)
    let parsedData;
    try {
      const isMultilingual = user.plan === 'pro';
      parsedData = await OpenRouterService.parseTaskWithAI(messageText, user.timezone, isMultilingual);
    } catch (parseError) {
      await TwilioService.sendWhatsAppMessage(From, "I'm having trouble understanding that request. Could you try rephrasing it?");
      return res.status(200).send('OK');
    }

    // 5. Secondary Plan Check (Operation Type, Action, Priority)
    // Now that we have parsed results, we check if the requested operation is allowed.
    const operationCheck = await checkPlanLimits(user, {
      messageType,
      action: parsedData.action,
      type: parsedData.type,
      priority: parsedData.priority
    });

    if (!operationCheck.allowed) {
      await TwilioService.sendWhatsAppMessage(From, operationCheck.message);
      return res.status(200).send('OK');
    }

    // 6. Execute Operation
    let resultMessage = '';
    const { action, type, title, dateTime, duration, priority, targetTitle, newPriority } = parsedData;

    try {
      if (action === 'create') {
        if (type === 'meeting') {
          // Meeting Logic
          if (user.calendarType === 'google_calendar' && user.googleTokens) {
            user.googleTokens = await GoogleCalendarService.refreshTokenIfNeeded(user);
            await user.save();
            await GoogleCalendarService.createEvent(user.googleTokens, parsedData, user.timezone);
            
            const dateStr = new Date(dateTime).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short', timeZone: user.timezone });
            resultMessage = `✅ *Meeting Scheduled!*\n\n📍 ${title}\n📅 ${dateStr}\n⏳ Duration: ${duration}m`;
          } 
          await incrementUsage(user, 'meeting', messageType === 'voice');
        } else {
          // Task Logic
          if (user.googleTokens) {
            user.googleTokens = await GoogleCalendarService.refreshTokenIfNeeded(user);
            await user.save();
            await GoogleCalendarService.createTask(user.googleTokens, { title, notes: parsedData.description, due: dateTime, priority });
            
            const pLabel = priority ? ` [${priority.toUpperCase()}]` : '';
            resultMessage = `✅ *Task Created*${pLabel}!\n\n📌 ${title}`;
          }
          await incrementUsage(user, 'task', messageType === 'voice');
        }
      } 
      // Handle 'list' action (Query/Read gap) - with priority filter support
      else if (action === 'list') {
        user.googleTokens = await GoogleCalendarService.refreshTokenIfNeeded(user);
        await user.save();
        
        // Extract priority filter if present (e.g. from targetTitle or priority field)
        const filter = priority || (targetTitle && targetTitle.match(/p[1-3]/i) ? targetTitle : null);
        
        const events = await GoogleCalendarService.listEvents(user.googleTokens, 5);
        const tasks = await GoogleCalendarService.listTasks(user.googleTokens, 10, filter);
        
        const filterLabel = filter ? ` [${filter.toUpperCase()}]` : '';
        resultMessage = `📅 *Your Upcoming${filterLabel} Schedule:*\n\n`;
        
        if (events.length > 0 && !filter) { // Only show meetings if no specific priority filter
          resultMessage += `*Meetings:*\n`;
          events.forEach((evt, i) => {
            const start = new Date(evt.start.dateTime || evt.start.date).toLocaleString('en-PK', { 
              timeZone: user.timezone,
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
            });
            resultMessage += `${i+1}. ${evt.summary} (${start})\n`;
          });
          resultMessage += `\n`;
        }
        
        if (tasks.length > 0) {
          resultMessage += `*Tasks${filterLabel}:*\n`;
          tasks.forEach((tsk, i) => {
            const pMatch = tsk.title.match(/^\[(P[1-3])\]/);
            const p = pMatch ? ` ${pMatch[0]}` : '';
            const t = tsk.title.replace(/^\[P[1-3]\]\s*/, '');
            resultMessage += `${i+1}.${p} ${t}\n`;
          });
        }
        
        if (tasks.length === 0 && (events.length === 0 || filter)) {
          resultMessage = `📅 Your${filterLabel} schedule is clear! Nothing coming up.`;
        }
      }
      // General Update logic (time, duration, title)
      else if (action === 'update') {
        if (user.googleTokens) {
          user.googleTokens = await GoogleCalendarService.refreshTokenIfNeeded(user);
          await user.save();

          if (type === 'meeting') {
            const event = await GoogleCalendarService.getEventByTitle(user.googleTokens, targetTitle);
            if (event) {
              await GoogleCalendarService.updateEvent(user.googleTokens, event.id, {
                title: title || event.summary,
                description: parsedData.description || '',
                dateTime: dateTime || event.start.dateTime,
                duration: duration || 30
              }, user.timezone);
              resultMessage = `🔄 Meeting "${targetTitle}" updated successfully.`;
            } else {
              resultMessage = `⚠️ Could not find meeting "${targetTitle}" to update.`;
            }
          } else {
            // Task update (currently limited to title/notes/due)
            const task = await GoogleCalendarService.getTaskByTitle(user.googleTokens, targetTitle);
            if (task) {
              // Reuse priority logic if not provided
              const p = priority || (task.title.match(/\[(P[1-3])\]/) ? task.title.match(/\[(P[1-3])\]/)[1].toLowerCase() : null);
              await GoogleCalendarService.createTask(user.googleTokens, { 
                title: title || task.title.replace(/^\[P[1-3]\]\s*/, ''), 
                notes: parsedData.description || task.notes, 
                due: dateTime || task.due, 
                priority: p 
              });
              await GoogleCalendarService.deleteTask(user.googleTokens, task.id); // Simple replace
              resultMessage = `🔄 Task "${targetTitle}" updated successfully.`;
            }
          }
        }
      }
      // Pro-only actions (delete, update, complete) - Now allowed via correction window
      else if (action === 'delete') {
        if (user.googleTokens) {
          user.googleTokens = await GoogleCalendarService.refreshTokenIfNeeded(user);
          await user.save();
          
          if (type === 'task') {
            const task = await GoogleCalendarService.getTaskByTitle(user.googleTokens, targetTitle);
            if (task) {
              await GoogleCalendarService.deleteTask(user.googleTokens, task.id);
              resultMessage = `🗑️ Task "${targetTitle}" deleted successfully.`;
            } else {
              resultMessage = `⚠️ Could not find task "${targetTitle}" to delete.`;
            }
          } else if (type === 'meeting') {
            const event = await GoogleCalendarService.getEventByTitle(user.googleTokens, targetTitle);
            if (event) {
              await GoogleCalendarService.deleteEvent(user.googleTokens, event.id);
              resultMessage = `🗑️ Meeting "${targetTitle}" deleted successfully.`;
            } else {
              resultMessage = `⚠️ Could not find meeting "${targetTitle}" to delete.`;
            }
          }
        }
      } else if (action === 'update_priority') {
        if (user.googleTokens) {
          user.googleTokens = await GoogleCalendarService.refreshTokenIfNeeded(user);
          await user.save();
          const task = await GoogleCalendarService.getTaskByTitle(user.googleTokens, targetTitle);
          if (task) {
            await GoogleCalendarService.updateTaskPriority(user.googleTokens, task.id, newPriority);
            resultMessage = `🔄 Task "${targetTitle}" priority updated to ${newPriority.toUpperCase()}.`;
          }
        }
      } else if (action === 'complete') {
        if (user.googleTokens) {
          user.googleTokens = await GoogleCalendarService.refreshTokenIfNeeded(user);
          await user.save();
          const task = await GoogleCalendarService.getTaskByTitle(user.googleTokens, targetTitle);
          if (task) {
            await GoogleCalendarService.completeTask(user.googleTokens, task.id);
            resultMessage = `🎉 Task "${targetTitle}" marked as complete!`;
          }
        }
      }

    } catch (opError) {
      console.error(`[Operation Error] ${opError.message}`);
      resultMessage = `⚠️ I understood your request but couldn't sync it with your calendar. Please check your connections.`;
    }

    // 7. Final Response & Log
    if (resultMessage) {
      await TwilioService.sendWhatsAppMessage(From, resultMessage);
    }

    // Ensure title exists for database log (even if AI didn't return it for an update)
    if (!parsedData.title && targetTitle) {
      parsedData.title = targetTitle;
    }

    await Task.create({
      userId: user._id,
      rawMessage: messageText,
      parsedData,
      status: resultMessage.includes('✅') || resultMessage.includes('🎉') || resultMessage.includes('🔄') ? 'scheduled' : 'failed',
      source: messageType
    });

    res.status(200).send('OK');
  } catch (error) {
    console.error(`[Fatal Webhook Error] ${error.message}`);
    // No response to user here to avoid multiple messages on crash, but log it.
    res.status(200).send('OK');
  }
};

/**
 * Handle Twilio status updates (sent, delivered, read).
 * POST /api/webhook/whatsapp-status
 */
const handleStatusUpdate = async (req, res) => {
  try {
    const { MessageSid, MessageStatus, To } = req.body;
    console.log(`[Twilio Status] Message ${MessageSid} to ${To}: ${MessageStatus}`);
    res.status(200).send('OK');
  } catch (error) {
    console.error(`[Webhook Status Error] ${error.message}`);
    res.status(200).send('OK');
  }
};

module.exports = {
  handleWhatsAppMessage,
  handleStatusUpdate
};
