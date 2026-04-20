const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rawMessage: {
    type: String,
    required: true
  },
  parsedData: {
    title: {
      type: String,
      required: true
    },
    description: String,
    dateTime: {
      type: Date,
      required: true
    },
    duration: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['task', 'meeting'],
      required: true
    }
  },
  calendarEventId: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'failed'],
    default: 'pending'
  },
  source: {
    type: String,
    enum: ['text', 'voice'],
    default: 'text'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Task', taskSchema);
