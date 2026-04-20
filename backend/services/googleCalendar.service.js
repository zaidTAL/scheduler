const { google } = require('googleapis');
const axios = require('axios');

class GoogleCalendarService {
  constructor() {
    this.oauth2Client = null;
    this.calendar = null;
  }

  /**
   * Initialize OAuth2 client with tokens
   * @param {object} tokens - Google OAuth tokens
   */
  initOAuth(tokens) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Create a calendar event
   * @param {object} tokens - Google OAuth tokens
   * @param {object} eventData - Event data (title, description, dateTime, duration)
   * @returns {Promise<object>} Created event
   */
  async createEvent(tokens, eventData) {
    try {
      console.log('Creating Google Calendar event:', eventData);
      this.initOAuth(tokens);

      // Parse the input dateTime - could be ISO (UTC) or local time string
      let startDate;
      const inputDateTime = eventData.dateTime;

      if (inputDateTime.endsWith('Z')) {
        // UTC time from test script - convert to Asia/Karachi local time
        startDate = new Date(inputDateTime);
      } else {
        // Local time string from AI (Asia/Karachi)
        startDate = new Date(inputDateTime + '+05:00');
      }

      // Calculate end time
      const endDate = new Date(startDate.getTime() + eventData.duration * 60000);

      // Format for Google Calendar: local time string in Asia/Karachi timezone
      // Google Calendar interprets dateTime + timeZone together
      const formatForGoogleCal = (date) => {
        // Convert UTC date to Asia/Karachi time (UTC+5)
        const utcTime = date.getTime();
        const pktTime = utcTime + (5 * 60 * 60 * 1000); // Add 5 hours
        const pktDate = new Date(pktTime);

        const year = pktDate.getUTCFullYear();
        const month = String(pktDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(pktDate.getUTCDate()).padStart(2, '0');
        const hours = String(pktDate.getUTCHours()).padStart(2, '0');
        const minutes = String(pktDate.getUTCMinutes()).padStart(2, '0');
        const seconds = String(pktDate.getUTCSeconds()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      };

      const startDateTime = formatForGoogleCal(startDate);
      const endDateTime = formatForGoogleCal(endDate);

      console.log('Event dates:', {
        input: inputDateTime,
        start: startDateTime,
        end: endDateTime,
        timezone: 'Asia/Karachi (UTC+5)'
      });

      const event = {
        summary: eventData.title,
        description: eventData.description || '',
        start: {
          dateTime: startDateTime,
          timeZone: 'Asia/Karachi'
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'Asia/Karachi'
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 15 },
            { method: 'popup', minutes: 10 }
          ]
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event
      });

      console.log('Event created successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error creating Google Calendar event:', {
        message: error.message,
        details: error.response?.data,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Refresh access token if expired
   * @param {object} user - User document with googleTokens
   * @returns {Promise<object>} Updated tokens
   */
  async refreshTokenIfNeeded(user) {
    try {
      const tokens = user.googleTokens;

      if (!tokens || !tokens.expiry_date) {
        throw new Error('No Google tokens found');
      }

      // Check if token is expired (add 5 minute buffer)
      const now = Date.now();
      if (tokens.expiry_date > now + 300000) {
        // Token still valid for at least 5 minutes
        return tokens;
      }

      // Refresh the token
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      this.oauth2Client.setCredentials({
        refresh_token: tokens.refresh_token
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Update user's tokens
      const updatedTokens = {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
        expiry_date: credentials.expiry_date
      };

      return updatedTokens;
    } catch (error) {
      console.error('Error refreshing Google token:', error.message);
      throw error;
    }
  }
}

module.exports = new GoogleCalendarService();
