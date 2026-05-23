const { google } = require('googleapis');
const axios = require('axios');

class GoogleCalendarService {
  constructor() {
    this.oauth2Client = null;
    this.calendar = null;
    this.tasksClient = null;
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
    this.tasksClient = google.tasks({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Create a calendar event
   * @param {object} tokens - Google OAuth tokens
   * @param {object} eventData - Event data (title, description, dateTime, duration)
   * @param {string} timezone - User's timezone
   * @returns {Promise<object>} Created event
   */
  async createEvent(tokens, eventData, timezone = 'Asia/Karachi') {
    try {
      console.log('Creating Google Calendar event:', eventData);
      this.initOAuth(tokens);

      const startDate = new Date(eventData.dateTime);
      const endDate = new Date(startDate.getTime() + eventData.duration * 60000);

      const event = {
        summary: eventData.title,
        description: eventData.description || '',
        start: {
          dateTime: startDate.toISOString(),
          timeZone: timezone
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: timezone
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
   * List upcoming calendar events
   * @param {object} tokens - Google OAuth tokens
   * @param {number} maxResults - Max events to return
   * @returns {Promise<Array>} List of events
   */
  async listEvents(tokens, maxResults = 10) {
    try {
      this.initOAuth(tokens);
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      });
      return response.data.items || [];
    } catch (error) {
      console.error('Error listing Google Calendar events:', error.message);
      throw error;
    }
  }

  /**
   * List upcoming tasks with optional priority filtering
   * @param {object} tokens - Google OAuth tokens
   * @param {number} maxResults - Max tasks to return
   * @param {string} priorityFilter - Optional priority to filter by (e.g., 'p1')
   * @returns {Promise<Array>} List of tasks
   */
  async listTasks(tokens, maxResults = 10, priorityFilter = null) {
    try {
      this.initOAuth(tokens);
      const response = await this.tasksClient.tasks.list({
        tasklist: '@default',
        showCompleted: false,
        maxResults: 50 // Fetch more to allow for filtering
      });
      
      let tasks = response.data.items || [];

      if (priorityFilter) {
        const filterTag = `[${priorityFilter.toUpperCase()}]`;
        tasks = tasks.filter(task => 
          task.title && task.title.toUpperCase().includes(filterTag)
        );
      }

      return tasks.slice(0, maxResults);
    } catch (error) {
      console.error('Error listing Google Tasks:', error.message);
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

  /**
   * Create a task in Google Tasks
   * @param {object} tokens - Google OAuth tokens
   * @param {object} taskData - Task data { title, notes, due, priority }
   * @returns {Promise<object>} Created task
   */
  async createTask(tokens, taskData) {
    try {
      console.log('Creating Google Task:', taskData);
      this.initOAuth(tokens);

      // Format title with priority prefix
      let title = taskData.title;
      if (taskData.priority) {
        title = `[${taskData.priority.toUpperCase()}] ${taskData.title}`;
      }

      // Format notes with priority info
      let notes = taskData.notes || '';
      if (taskData.priority) {
        notes = `PRIORITY: ${taskData.priority}\n${notes}`;
      }

      // Format due date as ISO string
      const due = taskData.due ? new Date(taskData.due).toISOString() : null;

      const task = {
        title,
        notes,
        due
      };

      const response = await this.tasksClient.tasks.insert({
        tasklist: '@default',
        requestBody: task
      });

      console.log('Task created successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error creating Google Task:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update task priority
   * @param {object} tokens - Google OAuth tokens
   * @param {string} taskId - Task ID to update
   * @param {string} newPriority - New priority: 'p1', 'p2', or 'p3'
   * @returns {Promise<object>} Updated task
   */
  async updateTaskPriority(tokens, taskId, newPriority) {
    try {
      console.log('Updating task priority:', { taskId, newPriority });
      this.initOAuth(tokens);

      // Get current task to preserve other fields
      const currentTask = await this.tasksClient.tasks.get({
        tasklist: '@default',
        task: taskId
      });

      // Update title with new priority prefix
      let title = currentTask.data.title;
      // Remove existing priority prefix if present
      title = title.replace(/^\[(P[1-3])\]\s*/, '');
      title = `[${newPriority.toUpperCase()}] ${title}`;

      // Update notes with new priority
      let notes = currentTask.data.notes || '';
      // Remove existing priority line if present
      notes = notes.replace(/^PRIORITY: p[1-3]\n/, '');
      notes = `PRIORITY: ${newPriority}\n${notes}`;

      const response = await this.tasksClient.tasks.patch({
        tasklist: '@default',
        task: taskId,
        requestBody: {
          title,
          notes
        }
      });

      console.log('Task priority updated:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error updating task priority:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete a task from Google Tasks
   * @param {object} tokens - Google OAuth tokens
   * @param {string} taskId - Task ID to delete
   */
  async deleteTask(tokens, taskId) {
    try {
      console.log('Deleting Google Task:', taskId);
      this.initOAuth(tokens);

      await this.tasksClient.tasks.delete({
        tasklist: '@default',
        task: taskId
      });

      console.log('Task deleted successfully');
    } catch (error) {
      console.error('Error deleting Google Task:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get task by title keyword
   * @param {object} tokens - Google OAuth tokens
   * @param {string} titleKeyword - Keyword to search in task titles
   * @returns {Promise<object|null>} Task object or null if not found
   */
  async getTaskByTitle(tokens, titleKeyword) {
    try {
      console.log('Searching for task with keyword:', titleKeyword);
      this.initOAuth(tokens);

      const response = await this.tasksClient.tasks.list({
        tasklist: '@default'
      });

      const tasks = response.data.items || [];

      // Find task whose title contains the keyword (case insensitive)
      const foundTask = tasks.find(task =>
        task.title && task.title.toLowerCase().includes(titleKeyword.toLowerCase())
      );

      if (foundTask) {
        return {
          id: foundTask.id,
          title: foundTask.title,
          notes: foundTask.notes,
          due: foundTask.due,
          completed: foundTask.status === 'completed'
        };
      }

      return null;
    } catch (error) {
      console.error('Error searching for task:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Mark a task as completed
   * @param {object} tokens - Google OAuth tokens
   * @param {string} taskId - Task ID to mark as completed
   * @returns {Promise<object>} Updated task
   */
  async completeTask(tokens, taskId) {
    try {
      console.log('Marking task as completed:', taskId);
      this.initOAuth(tokens);

      const response = await this.tasksClient.tasks.update({
        tasklist: '@default',
        task: taskId,
        requestBody: {
          status: 'completed',
          completed: new Date().toISOString()
        }
      });

      console.log('Task marked as completed:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error completing task:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new GoogleCalendarService();
