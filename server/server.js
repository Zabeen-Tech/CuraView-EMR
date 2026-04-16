require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io'); 

// --- MODELS ---
const User = require('./models/user');
const Patient = require('./models/patient');
const Invoice = require('./models/invoice'); 
const Service = require('./models/service'); 
const Settings = require('./models/settings'); // NEW: For Clinic Profile info

const app = express();
const server = http.createServer(app); 

// --- SOCKET.IO SETUP ---
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    }
});

io.on('connection', (socket) => {
    console.log(`📡 Client Connected: ${socket.id}`);
    socket.on('disconnect', () => console.log('🛑 Client Disconnected'));
});

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
        console.log("🌿 CURAVIEW DATABASE: ONLINE");
    })
    .catch((err) => console.error("❌ DATABASE OFFLINE!", err.message));

// --- 🔐 AUTH & STAFF REGISTRATION ---
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });
        res.status(200).json({ success: true, userId: user._id, name: user.name, role: user.role, specialization: user.specialization || "General Practice" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role, specialization } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "Email already registered" });
        const newUser = new User({ name, email, password, role: role || 'doctor', specialization: specialization || 'General Practice' });
        await newUser.save();
        res.status(201).json({ success: true, message: "Staff registered successfully" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/patient-login', async (req, res) => {
    try {
        const { phone } = req.body;
        const patient = await Patient.findOne({ phone: phone.trim() });
        if (!patient) return res.status(404).json({ success: false, message: "Phone number not registered." });
        res.status(200).json({ success: true, userId: patient._id, name: patient.name, role: 'patient' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- 📅 PATIENT & QUEUE MANAGEMENT ---

app.get('/api/patients', async (req, res) => {
    try {
        const patients = await Patient.find().sort({ queuePosition: 1, createdAt: -1 }).lean();
        const sorted = patients.sort((a, b) => {
            if (a.queuePosition === 0 && b.queuePosition === 0) return 0;
            if (a.queuePosition === 0) return 1;
            if (b.queuePosition === 0) return -1;
            return a.queuePosition - b.queuePosition;
        });
        res.json(sorted);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/patients/:id', async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        res.json(patient);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/patients/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const oldPatient = await Patient.findById(req.params.id);
        if (!oldPatient) return res.status(404).json({ message: "Patient not found" });

        const updateFields = { status };

        if (status === 'Waiting' && oldPatient.status !== 'Waiting') {
            const count = await Patient.countDocuments({ 
                assignedDoctor: oldPatient.assignedDoctor, 
                status: 'Waiting' 
            });
            updateFields.queuePosition = count + 1;
            updateFields.bookingStatus = 'Accepted';
        }

        if (status === 'Discharged') {
            updateFields.queuePosition = 0;
            updateFields.bookingStatus = 'Discharged';
        }

        const updatedPatient = await Patient.findByIdAndUpdate(req.params.id, { $set: updateFields }, { new: true });

        if (status === 'Discharged' || status === 'In-Consultation') {
            await Patient.updateMany(
                { 
                    assignedDoctor: updatedPatient.assignedDoctor, 
                    queuePosition: { $gt: oldPatient.queuePosition },
                    status: "Waiting" 
                },
                { $inc: { queuePosition: -1 } }
            );
        }

        io.emit('queue_updated', { doctor: updatedPatient.assignedDoctor });
        res.json({ success: true, patient: updatedPatient });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/patients/:id', async (req, res) => {
    try {
        const updateData = { ...req.body };
        const oldPatient = await Patient.findById(req.params.id);
        
        if (updateData.status === 'Waiting' && oldPatient.status !== 'Waiting') {
            const count = await Patient.countDocuments({ 
                assignedDoctor: updateData.assignedDoctor || oldPatient.assignedDoctor, 
                status: 'Waiting' 
            });
            updateData.queuePosition = count + 1;
            updateData.bookingStatus = 'Accepted';
        }

        if (updateData.status === 'Discharged') {
            updateData.queuePosition = 0;
            updateData.bookingStatus = 'Discharged';
        }

        const updatedPatient = await Patient.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });

        if (updateData.status === 'Discharged' || updateData.status === 'In-Consultation') {
            await Patient.updateMany(
                { 
                    assignedDoctor: updatedPatient.assignedDoctor, 
                    queuePosition: { $gt: oldPatient.queuePosition },
                    status: "Waiting" 
                },
                { $inc: { queuePosition: -1 } }
            );
        }

        io.emit('queue_updated', { doctor: updatedPatient.assignedDoctor });
        res.json(updatedPatient);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/patients/:id/respond-appointment', async (req, res) => {
    try {
        const { decision, adminNotes, queuePosition, roomNumber, appointmentTime } = req.body;
        const current = await Patient.findById(req.params.id);
        
        let queuePos = 0;
        if (decision === 'Accepted') {
            const count = await Patient.countDocuments({ assignedDoctor: current.assignedDoctor, status: 'Waiting' });
            queuePos = count + 1;
        }

        const updated = await Patient.findByIdAndUpdate(req.params.id, { 
            $set: { 
                bookingStatus: decision, 
                adminNotes: adminNotes || "", 
                queuePosition: queuePos,
                roomNumber: roomNumber || current.roomNumber,
                appointmentTime: appointmentTime || current.appointmentTime,
                status: decision === 'Accepted' ? 'Waiting' : 'Discharged'
            } 
        }, { new: true });

        io.emit('queue_updated', { doctor: updated.assignedDoctor });
        res.json({ success: true, patient: updated });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/patients', async (req, res) => {
    try {
        const count = await Patient.countDocuments({ assignedDoctor: req.body.assignedDoctor, status: 'Waiting' });
        const newPatient = new Patient({
            ...req.body,
            queuePosition: req.body.status === 'Waiting' ? count + 1 : 0,
            bookingStatus: req.body.bookingStatus || 'Accepted'
        });
        const saved = await newPatient.save();
        io.emit('queue_updated', { doctor: saved.assignedDoctor });
        res.status(201).json(saved);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

app.delete('/api/patients/:id', async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (patient && patient.queuePosition > 0) {
            await Patient.updateMany(
                { assignedDoctor: patient.assignedDoctor, queuePosition: { $gt: patient.queuePosition }, status: "Waiting" },
                { $inc: { queuePosition: -1 } }
            );
        }
        await Patient.findByIdAndDelete(req.params.id);
        io.emit('queue_updated');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await User.find({ role: 'doctor' });
        res.json(doctors);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- 💳 BILLING & INVOICE ROUTES ---

app.get('/api/invoices', async (req, res) => {
    try {
        const invoices = await Invoice.find().sort({ createdAt: -1 });
        res.json(invoices);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/invoices', async (req, res) => {
    try {
        const invoiceData = { ...req.body };
        if (!invoiceData.subtotal && invoiceData.items) {
            invoiceData.subtotal = invoiceData.items.reduce((sum, item) => sum + (item.total || 0), 0);
        }

        const newInvoice = new Invoice(invoiceData);
        const saved = await newInvoice.save();
        res.status(201).json(saved);
    } catch (err) { 
        console.error("Save Error:", err.message);
        res.status(400).json({ message: err.message }); 
    }
});

app.put('/api/invoices/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const updatedInvoice = await Invoice.findByIdAndUpdate(
            req.params.id, 
            { $set: { status: status } }, 
            { new: true }
        );
        if (!updatedInvoice) return res.status(404).json({ message: "Invoice not found" });
        res.json(updatedInvoice);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- 🛠️ MASTER SERVICE ROUTES (SETTINGS) ---

app.get('/api/services', async (req, res) => {
    try {
        const services = await Service.find().sort({ name: 1 });
        res.json(services);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/services', async (req, res) => {
    try {
        const newService = new Service(req.body);
        const saved = await newService.save();
        res.status(201).json(saved);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

app.delete('/api/services/:id', async (req, res) => {
    try {
        await Service.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Service deleted successfully" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- 🏥 CLINIC SETTINGS ROUTES ---

app.get('/api/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            // Default settings if none exist
            settings = await Settings.create({
                clinicName: "Healthcare Clinic",
                address: "Address Address",
                contact: "95383638933",
                adminName: "Mehak Zabeen",
                email: "mehak@gmail.com"
            });
        }
        res.json(settings);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/settings', async (req, res) => {
    try {
        const updatedSettings = await Settings.findOneAndUpdate({}, req.body, { new: true, upsert: true });
        res.json(updatedSettings);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));