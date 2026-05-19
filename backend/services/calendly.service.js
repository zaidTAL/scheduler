const axios = require('axios');

class CalendlyService {
  constructor() {
    this.baseURL = 'https://api.calendly.com';
  }

  /**
   * Get current user info (to get user URI needed for other calls)
   * @param {string} token - Calendly API token
   * @returns {Promise<object>} User resource
   */
  async getCalendlyUser(token) {
    try {
      const res = await axios.get(`${this.baseURL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.resource;
    } catch (error) {
      console.error('Error getting Calendly user:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get user's event types (like "30 min meeting", "1 hour call")
   * @param {string} token - Calendly API token
   * @param {string} userUri - User URI from getCalendlyUser
   * @returns {Promise<Array>} Event types collection
   */
  async getEventTypes(token, userUri) {
    try {
      const res = await axios.get(`${this.baseURL}/event_types`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { user: userUri }
      });
      return res.data.collection;
    } catch (error) {
      console.error('Error getting Calendly event types:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a one-off meeting (Calendly v2 one-off events)
   * NOTE: Calendly does not support creating arbitrary events via API like Google Calendar.
   * Instead, we create a "scheduling link" for a one-off meeting.
   * @param {string} token - Calendly API token
   * @param {string} userUri - User URI from getCalendlyUser
   * @param {object} eventData - { title, startTime (ISO), duration (minutes) }
   * @returns {Promise<object>} Created one-off event type
   */
  async createOneOffMeeting(token, userUri, eventData) {
    try {
      // eventData: { title, startTime (ISO), duration (minutes) }
      const res = await axios.post(`${this.baseURL}/one_off_event_types`, {
        name: eventData.title,
        host: userUri,
        duration: eventData.duration || 30,
        date_setting: {
          type: 'date_range',
          start_date: eventData.startTime.split('T')[0],
          end_date: eventData.startTime.split('T')[0]
        },
        location: { kind: 'custom', location: 'To be determined' }
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return res.data.resource;
    } catch (error) {
      console.error('Error creating Calendly one-off meeting:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * List scheduled events
   * @param {string} token - Calendly API token
   * @param {string} userUri - User URI from getCalendlyUser
   * @returns {Promise<Array>} Scheduled events collection
   */
  async getScheduledEvents(token, userUri) {
    try {
      const res = await axios.get(`${this.baseURL}/scheduled_events`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { user: userUri, status: 'active' }
      });
      return res.data.collection;
    } catch (error) {
      console.error('Error getting Calendly scheduled events:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Cancel a scheduled event
   * @param {string} token - Calendly API token
   * @param {string} eventUuid - Event UUID to cancel
   * @param {string} reason - Cancellation reason
   */
  async cancelEvent(token, eventUuid, reason) {
    try {
      await axios.post(`${this.baseURL}/scheduled_events/${eventUuid}/cancellation`, {
        reason: reason || 'Cancelled by user'
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error cancelling Calendly event:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Validate Calendly token by making a test API call
   * @param {string} token - Calendly API token to validate
   * @returns {Promise<object>} User resource if valid
   */
  async validateToken(token) {
    try {
      return await this.getCalendlyUser(token);
    } catch (error) {
      throw new Error('Invalid Calendly API token');
    }
  }
}

module.exports = new CalendlyService();
