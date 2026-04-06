require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// --- MODELS ---
const User = require('./models/user');
const Patient = require('./models/patient');

const app = express();

// --- MIDDLEWARE ---
app.use(cors({
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());

// --- DATABASE CONNECTION ---
const localURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/CuraView";

mongoose.connect(localURI)
    .then(async () => {
        console.log("------------------------------------------");
        console.log("🌿 CURAVIEW DATABASE: ONLINE");

        const adminEmail = "admin@clinic.com";
        const adminExists = await User.findOne({ email: adminEmail });

        if (!adminExists) {
            const masterAdmin = new User({
                name: "Master Admin",
                email: adminEmail,
                password: "admin123",
                role: "admin",
                specialization: "Clinic Management"
            });
            await masterAdmin.save();
            console.log("✅ MASTER ADMIN CREATED: admin@clinic.com");
        }
        console.log("------------------------------------------");
    })
    .catch((err) => {
        console.error("❌ DATABASE OFFLINE!", err.message);
    });

// --- 🔐 AUTH & STAFF REGISTRATION ---

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

        res.status(200).json({
            success: true,
            userId: user._id, // This is what gets saved to localStorage
            name: user.name,
            role: user.role,
            specialization: user.specialization || "General Practice"
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role, specialization } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "Email already registered" });

        const newUser = new User({
            name, email, password,
            role: role || 'doctor',
            specialization: specialization || 'General Practice'
        });

        await newUser.save();
        res.status(201).json({ success: true, message: "Staff registered successfully" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/patient-login', async (req, res) => {
    try {
        const { phone } = req.body;
        const patient = await Patient.findOne({ phone: phone.trim() });
        if (!patient) return res.status(404).json({ success: false, message: "Phone number not registered." });

        res.status(200).json({
            success: true,
            userId: patient._id, // Changed to userId to match the frontend key
            name: patient.name,
            role: 'patient'
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- 📅 PATIENT & QUEUE MANAGEMENT ---

// *** NEW ROUTE: GET SINGLE PATIENT BY ID (Required for Patient Dashboard) ***
app.get('/api/patients/:id', async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: "Patient not found" });
        res.json(patient);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 1. Update Patient Status (Waiting/In-Room/Discharged)
app.put('/api/patients/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const updatedPatient = await Patient.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        res.json({ success: true, patient: updatedPatient });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 2. Respond to Appointment
app.put('/api/patients/:id/respond-appointment', async (req, res) => {
    try {
        const { decision, adminNotes } = req.body;
        const updatedPatient = await Patient.findByIdAndUpdate(
            req.params.id,
            { bookingStatus: decision, adminNotes },
            { new: true }
        );
        res.json({ success: true, patient: updatedPatient });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 3. FULL UPDATE & DISCHARGE HISTORY
app.put('/api/patients/:id', async (req, res) => {
    try {
        const updateData = { ...req.body };
        const updateQuery = {};
        if (updateData.$push) {
            updateQuery.$push = updateData.$push;
            delete updateData.$push; 
        }
        updateQuery.$set = updateData;

        const updatedPatient = await Patient.findByIdAndUpdate(
            req.params.id,
            updateQuery,
            { new: true }
        );
        res.json(updatedPatient);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 4. DELETE PATIENT
app.delete('/api/patients/:id', async (req, res) => {
    try {
        await Patient.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Patient deleted" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/patients', async (req, res) => {
    try {
        const newPatient = new Patient({
            ...req.body,
            age: Number(req.body.age),
            bookingStatus: 'Accepted',
            status: req.body.status || 'Waiting',
            timeSlot: req.body.timeSlot || 'Walk-in',
            visitHistory: [] 
        });
        const savedPatient = await newPatient.save();
        res.status(201).json(savedPatient);
    } catch (err) {
        let errorMsg = "Failed to create patient";
        if (err.code === 11000) errorMsg = "Phone number already exists";
        res.status(400).json({ message: errorMsg });
    }
});

app.get('/api/patients', async (req, res) => {
    try {
        const patients = await Patient.find().sort({ createdAt: -1 });
        res.json(patients);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- 🩺 DOCTOR ROUTES ---

app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await User.find({ role: 'doctor' });
        res.json(doctors);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));