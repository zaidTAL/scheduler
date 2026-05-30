const nodemailer = require('nodemailer');
const User = require('../models/User');
const GoogleCalendarService = require('./googleCalendar.service');
const cron = require('node-cron');

class ReminderService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      // Configure your SMTP settings here or in .env
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Start the reminder cron job
   * Default: Every 10 minutes for testing
   */
  startCron() {
    // Testing: '*/10 * * * *' (Every 10 minutes)
    // Production: '0 */4 * * *' (Every 4 hours)
    cron.schedule('*/10 * * * *', async () => {
      console.log('[Cron] Running Task Reminder Check...');
      await this.sendTaskReminders();
    });
    console.log('[Cron] Task Reminder System initialized (10-min interval)');
  }

  /**
   * Iterate through users and send pending task summaries
   */
  async sendTaskReminders() {
    try {
      const users = await User.find({ googleTokens: { $exists: true } });

      for (const user of users) {
        try {
          // Refresh tokens if needed
          let tokens;
          try {
            tokens = await GoogleCalendarService.refreshTokenIfNeeded(user);
            user.googleTokens = tokens;
            await user.save();
          } catch (refreshErr) {
            if (refreshErr.message.includes('invalid_grant')) {
              console.warn(`[Reminder] Revoking tokens for ${user.email} due to invalid_grant`);
              user.googleTokens = undefined; // Clear invalid tokens
              await user.save();
              continue; // Skip this user for this run
            }
            throw refreshErr;
          }

          // Fetch next 10 tasks
          const tasks = await GoogleCalendarService.listTasks(tokens, 10);
          
          if (tasks.length > 0) {
            await this.sendEmail(user, tasks);
            console.log(`[Reminder] Sent task summary to ${user.email}`);
          }
        } catch (err) {
          console.error(`[Reminder Error] Failed for ${user.email}: ${err.message}`);
        }
      }
    } catch (error) {
      console.error(`[Reminder Fatal Error] ${error.message}`);
    }
  }

  /**
   * Send formatted email
   */
  async sendEmail(user, tasks) {
    const taskListHtml = tasks.map(t => {
      const pMatch = t.title.match(/^\[(P[1-3])\]/);
      const p = pMatch ? `<span style="color: #d32f2f; font-weight: bold;">${pMatch[1]}</span>` : '';
      return `<li>${p} ${t.title.replace(/^\[P[1-3]\]\s*/, '')}</li>`;
    }).join('');

    const mailOptions = {
      from: `"Scheduler AI" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: `📌 Your Pending Tasks - ${new Date().toLocaleDateString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4f46e5; text-align: center;">Task Summary 🚀</h2>
          <p>Hi ${user.name},</p>
          <p>Here are your pending tasks to keep you on track today:</p>
          <ul style="line-height: 1.6; color: #374151;">
            ${taskListHtml}
          </ul>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            Sent by Scheduler AI. Managing your day, one message at a time.
          </p>
        </div>
      `
    };

    return this.transporter.sendMail(mailOptions);
  }
}

module.exports = new ReminderService();
