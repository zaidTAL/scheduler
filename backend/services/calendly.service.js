const axios = require('axios');

class CalendlyService {
  constructor() {
    this.baseURL = 'https://api.calendly.com';
  }

  /**
   * Create a scheduled event in Calendly
   * @param {string} token - Calendly API token
   * @param {object} eventData - Event data (title, description, dateTime, duration)
   * @returns {Promise<object>} Created event
   */
  async createScheduledEvent(token, eventData) {
    try {
      // Note: Calendly API works differently - you typically create scheduling links
      // For direct event creation, we'd use the Scheduled Events endpoint
      // This is a simplified implementation

      const response = await axios.post(
        `${this.baseURL}/scheduled_events`,
        {
          scheduled_event: {
            title: eventData.title,
            description: eventData.description || '',
            start_time: eventData.dateTime,
            timezone: 'Asia/Karachi',
            // Note: Calendly requires more setup for direct event creation
            // This is a basic implementation
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error creating Calendly event:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get user's Calendly profile
   * @param {string} token - Calendly API token
   * @returns {Promise<object>} User profile
   */
  async getUserProfile(token) {
    try {
      const response = await axios.get(
        `${this.baseURL}/users/me`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting Calendly profile:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new CalendlyService();
