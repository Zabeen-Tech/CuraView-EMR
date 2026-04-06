const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  // --- BASIC PROFILE ---
  name: { type: String, required: true, trim: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  
  // Unique: false allows family members to use the same contact number
  phone: { type: String, required: true, unique: false }, 

  // --- CLINIC LOGISTICS ---
  // condition represents the current reason for the visit
  condition: { type: String, required: true }, 
  
  timeSlot: { type: String, default: "Walk-in" }, 
  // ADDED: This is required for the Appointment Calendar filtering to work
  appointmentDate: { type: String, default: "" }, 
  appointmentTime: { type: String, default: "Not Scheduled" },
  roomNumber: { type: String, default: "Not Assigned" },
  
  // Stored as String to match Admin/Doctor Dashboard name-based filtering
  assignedDoctor: { 
    type: String, 
    default: "" 
  },

  // --- 📅 BOOKING & QUEUE WORKFLOW ---
  // Keeps your "Pending" queue working for the external registration link
  bookingStatus: { 
    type: String, 
    enum: ["None", "Pending", "Accepted", "Cancelled", "Doctor Busy", "Doctor Not Available"], 
    default: "Accepted" 
  },

  // Core workflow status
  status: { 
    type: String, 
    enum: ["Requested", "Waiting", "In-Consultation", "Discharged"], 
    default: "Waiting" 
  }, 

  adminNotes: { type: String, default: "" },
  
  // --- MEDICAL DATA (From Doctor Dashboard) ---
  notes: { type: String, default: "" }, 

  // --- 🏥 NURSE VITALS (Added for Nurse Station) ---
  vitals: {
    weight: { type: String, default: "" },
    height: { type: String, default: "" },
    bp: { type: String, default: "" },
    temp: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now }
  },
  
  // --- BILLING ---
  billingAmount: { type: Number, default: 0 },
  isPaid: { type: Boolean, default: false },

  // --- HISTORY (Preserved for Re-appointments) ---
  // UPDATED: Renamed to visitHistory to match your Doctor Dashboard frontend logic
  // Added medications field so Rx saves correctly
  visitHistory: [
    {
      date: { type: String, default: () => new Date().toLocaleDateString() },
      diagnosis: { type: String },
      treatment: { type: String },
      notes: { type: String },
      medications: { type: String }, // Added to capture Rx
      doctor: { type: String },      // Added to capture Dr. Name
      doctorName: { type: String }   // Kept for backward compatibility
    }
  ],

  // Kept 'history' as an alias so existing data doesn't break
  history: { type: Array, default: [] } 
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Patient', PatientSchema);