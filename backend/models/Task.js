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
      required: false
    },
    description: String,
    dateTime: {
      type: Date,
      required: false
    },
    duration: {
      type: Number,
      required: false
    },
    type: {
      type: String,
      enum: ['task', 'meeting'],
      required: true
    },
    action: {
      type: String,
      enum: ['create', 'delete', 'update_priority', 'update', 'complete'],
      default: 'create'
    },
    priority: {
      type: String,
      enum: ['p1', 'p2', 'p3'],
      default: null
    },
    targetTitle: String,
    newPriority: {
      type: String,
      enum: ['p1', 'p2', 'p3'],
      default: null
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
