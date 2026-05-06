const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorName: {
    type: String,
    required: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true
  },
  time: {
    type: String, // Format: "9:00 AM"
    required: true
  },
  status: {
    type: String,
    enum: ['ON-DUTY', 'OFF-DUTY'],
    default: 'OFF-DUTY'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure one shift per doctor per date per time
shiftSchema.index({ doctorId: 1, date: 1, time: 1 }, { unique: true });

module.exports = mongoose.model('Shift', shiftSchema);