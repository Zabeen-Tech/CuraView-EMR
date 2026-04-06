const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true // Ensures no two doctors use the same email
  },
  password: { 
    type: String, 
    required: true 
  },
  specialization: { 
    type: String, 
    required: true // e.g., "General Physician", "Cardiologist"
  },
  experience: { 
    type: String 
  },
  phone: { 
    type: String 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Doctor', DoctorSchema);