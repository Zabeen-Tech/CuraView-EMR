const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['admin', 'doctor', 'patient'], 
    default: 'patient' 
  },
  specialization: { 
    type: String, 
    default: 'General Practice' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// No password hashing for now
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return this.password === candidatePassword;
};

module.exports = mongoose.model('User', UserSchema);