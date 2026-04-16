const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  adminName: { type: String, default: 'Mehak Zabeen' },
  email: { type: String, default: 'mehak@gmail.com' },
  clinicName: { type: String, default: 'Healthcare Clinic' },
  address: { type: String, default: 'Address Street, City' },
  contact: { type: String, default: '95383638933' }
}, { 
  timestamps: true 
});

// IMPORTANT: This must be 'Settings' and use SettingsSchema
module.exports = mongoose.model('Settings', SettingsSchema);