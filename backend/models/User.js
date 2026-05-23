const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  availability: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    }
  }],
  sleepTime: {
    start: String,
    end: String
  },
  calendarType: {
    type: String,
    enum: ['google_calendar', 'calendly'],
    default: 'google_calendar'
  },
  googleTokens: {
    access_token: String,
    refresh_token: String,
    expiry_date: Number
  },
  calendlyToken: String,
  calendlyUserUri: {
    type: String,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  timezone: {
    type: String,
    default: 'Asia/Karachi'
  },
  plan: {
    type: String,
    enum: ['free', 'plus', 'pro'],
    default: 'free'
  },
  usage: {
    tasksToday: { type: Number, default: 0 },
    meetingsToday: { type: Number, default: 0 },
    voiceToday: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now },
    totalTasks: { type: Number, default: 0 },
    totalMeetings: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Hash password before saving - using bcryptjs v3 API
userSchema.pre('save', function(next) {
  if (!this.isModified('password')) return;

  try {
    const salt = bcrypt.genSaltSync(10);
    this.password = bcrypt.hashSync(this.password, salt);
  } catch (error) {
    console.log(error)
  }
});

// Compare password method
userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compareSync(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
