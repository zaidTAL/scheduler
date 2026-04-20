require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const GoogleCalendarService = require('./services/googleCalendar.service');

async function testCalendar() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    // Find any user with Google tokens
    const user = await User.findOne({ googleTokens: { $exists: true, $ne: null } });

    if (!user) {
      console.log('No user found. Create a user first or modify the email in this script.');
      process.exit(1);
    }

    console.log(`Testing with user: ${user.name} (${user.email})`);
    console.log(`Has Google tokens: ${!!user.googleTokens}`);

    if (!user.googleTokens) {
      console.log('No Google tokens found. Connect Google Calendar from the frontend first.');
      process.exit(1);
    }

    // Test event data - schedule for tomorrow at 3 PM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(15, 0, 0, 0);

    const eventData = {
      title: 'Test Meeting from Script',
      description: 'This is a test event created by test-calendar.js',
      dateTime: tomorrow.toISOString(),
      duration: 60,
      type: 'meeting'
    };

    console.log('\nCreating event:', eventData);

    const result = await GoogleCalendarService.createEvent(user.googleTokens, eventData);

    console.log('\n✅ Event created successfully!');
    console.log('Event ID:', result.id);
    console.log('Event Link:', result.htmlLink);
    console.log('Event Summary:', result.summary);
    console.log('Start Time:', result.start.dateTime);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Google API Error:', error.response.data);
    }
    process.exit(1);
  }
}

testCalendar();
