const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  globalPosition: {
    type: Number,
    default: 0
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  patientName: {
    type: String,
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorName: {
    type: String,
    required: true
  },
  doctorSpecialization: {
    type: String,
    required: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },
  status: {
    type: String,
    enum: ['waiting', 'in-progress', 'completed'],
    default: 'waiting'
  },
  appointmentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  checkInTime: {
    type: Date,
    default: Date.now
  },
  startTime: {
    type: Date
  },
  completionTime: {
    type: Date
  }
});

// Auto-increment globalPosition
queueSchema.pre('save', async function(next) {
  if (this.isNew && this.globalPosition === 0) {
    try {
      const lastQueue = await this.constructor.findOne(
        {},
        {},
        { sort: { globalPosition: -1 } }
      );
      this.globalPosition = lastQueue ? lastQueue.globalPosition + 1 : 1;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('Queue', queueSchema);