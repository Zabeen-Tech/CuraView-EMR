require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// --- MODELS ---
const User = require('./models/user');
const Patient = require('./models/patient');
const Invoice = require('./models/invoice'); 
const Service = require('./models/service'); 
const Settings = require('./models/settings');
const Shift = require('./models/shift');

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

app.set('io', io);

io.on('connection', (socket) => {
    console.log(`📡 Client Connected: ${socket.id}`);
    
    socket.on('join-room', (role) => {
        if (role === 'admin') socket.join('admins');
        if (role === 'doctor') socket.join('doctors');
        if (role === 'patient') socket.join('patients');
    });
    
    socket.on('disconnect', () => console.log('🛑 Client Disconnected'));
});

// --- MIDDLEWARE ---
app.use(cors({
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());

// --- HELPER FUNCTION: Convert time to sortable format ---
const convertToSortableTime = (timeStr) => {
    if (!timeStr || timeStr === 'Not Scheduled' || timeStr === '') return '99:99';
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
        let hour = parseInt(match[1]);
        const minute = match[2];
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hour !== 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:${minute}`;
    }
    return '99:99';
};

// ========== Recalculate ALL queue positions by appointment time (GLOBAL) ==========
async function recalculateGlobalQueueByTime() {
    const activePatients = await Patient.find({ 
        status: 'Waiting',
        bookingStatus: 'Accepted',
        appointmentTime: { $nin: ['Not Scheduled', '', null] }
    });
    
    const sortedByTime = activePatients.sort((a, b) => {
        const timeA = convertToSortableTime(a.appointmentTime);
        const timeB = convertToSortableTime(b.appointmentTime);
        return timeA.localeCompare(timeB);
    });
    
    for (let i = 0; i < sortedByTime.length; i++) {
        const newPosition = i + 1;
        if (sortedByTime[i].queuePosition !== newPosition) {
            sortedByTime[i].queuePosition = newPosition;
            await sortedByTime[i].save();
        }
    }
    
    console.log(`🌍 Global queue recalculated: ${sortedByTime.length} active patients by time`);
    return sortedByTime.length;
}

// --- HELPER FUNCTION: Recalculate positions for WAITING patients only ---
async function recalculateWaitingQueuePositions() {
    const waitingPatients = await Patient.find({ 
        status: 'Waiting',
        bookingStatus: 'Accepted'
    }).sort({ createdAt: 1, queuePosition: 1 });
    
    for (let i = 0; i < waitingPatients.length; i++) {
        const newPosition = i + 1;
        if (waitingPatients[i].queuePosition !== newPosition) {
            waitingPatients[i].queuePosition = newPosition;
            await waitingPatients[i].save();
        }
    }
    
    console.log(`Queue recalculated: ${waitingPatients.length} waiting patients`);
    return waitingPatients.length;
}

// --- HELPER FUNCTION: Get next queue position (END of queue) ---
async function getNextQueuePosition() {
    const highestPosition = await Patient.findOne({ 
        status: 'Waiting',
        bookingStatus: 'Accepted'
    }).sort({ queuePosition: -1 });
    
    return highestPosition ? highestPosition.queuePosition + 1 : 1;
}

// --- DATABASE CONNECTION ---
const localURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/CuraView";
mongoose.connect(localURI)
    .then(async () => {
        console.log("🌿 CURAVIEW DATABASE: ONLINE");
        await recalculateGlobalQueueByTime();
    })
    .catch((err) => console.error("❌ DATABASE OFFLINE!", err.message));

// --- 🔐 AUTH & STAFF REGISTRATION ---

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        
        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'curaview-secret-key',
            { expiresIn: '7d' }
        );
        
        res.status(200).json({ 
            success: true, 
            userId: user._id, 
            name: user.name, 
            role: user.role, 
            specialization: user.specialization || "General Practice",
            token: token 
        });
    } catch (err) { 
        console.error("Login error:", err);
        res.status(500).json({ message: err.message }); 
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role, specialization } = req.body;
        
        console.log("📝 Register request received:", { name, email, role });
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Email already registered" });
        }
        
        const newUser = new User({ 
            name, 
            email, 
            password, 
            role: role || 'doctor', 
            specialization: specialization || 'General Practice' 
        });
        
        await newUser.save();
        console.log("✅ User saved successfully:", newUser._id);
        
        res.status(201).json({ 
            success: true, 
            message: "Staff registered successfully",
            user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role }
        });
    } catch (err) { 
        console.error("❌ Registration error:", err);
        res.status(500).json({ success: false, message: err.message }); 
    }
});

app.post('/api/patient-login', async (req, res) => {
    try {
        const { phone } = req.body;
        const patient = await Patient.findOne({ phone: phone.trim() });
        if (!patient) return res.status(404).json({ success: false, message: "Phone number not registered." });
        
        const token = jwt.sign(
            { userId: patient._id, phone: patient.phone, role: 'patient' },
            process.env.JWT_SECRET || 'curaview-secret-key',
            { expiresIn: '7d' }
        );
        
        res.status(200).json({ 
            success: true, 
            userId: patient._id, 
            name: patient.name, 
            role: 'patient',
            token: token 
        });
    } catch (err) { 
        console.error("Patient login error:", err);
        res.status(500).json({ message: err.message }); 
    }
});

// --- 📅 PATIENT & QUEUE MANAGEMENT ---

// ✅ FIXED: GET patients - NOW includes discharged patients for Master Index
app.get('/api/patients', async (req, res) => {
    try {
        const patients = await Patient.find().lean();
        // Sort: active patients first (with queue position), discharged at the bottom
        const sorted = patients.sort((a, b) => {
            // Both discharged - sort by most recent first
            if (a.status === 'Discharged' && b.status === 'Discharged') {
                return new Date(b.updatedAt) - new Date(a.updatedAt);
            }
            // Discharged patients go to the bottom
            if (a.status === 'Discharged') return 1;
            if (b.status === 'Discharged') return -1;
            // Active patients with queue position first
            if (a.queuePosition === 0 && b.queuePosition === 0) {
                const timeA = convertToSortableTime(a.appointmentTime);
                const timeB = convertToSortableTime(b.appointmentTime);
                return timeA.localeCompare(timeB);
            }
            if (a.queuePosition === 0) return 1;
            if (b.queuePosition === 0) return -1;
            return a.queuePosition - b.queuePosition;
        });
        res.json(sorted);
    } catch (err) { 
        res.status(500).json({ message: err.message }); 
    }
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
            updateFields.bookingStatus = 'Accepted';
            updateFields.queuePosition = await getNextQueuePosition();
        }

        if (status === 'Discharged') {
            updateFields.queuePosition = 0;
            updateFields.bookingStatus = 'Discharged';
        }

        const updatedPatient = await Patient.findByIdAndUpdate(req.params.id, { $set: updateFields }, { new: true });

        await recalculateGlobalQueueByTime();

        io.emit('queue_updated', { doctor: updatedPatient.assignedDoctor });
        
        res.json({ success: true, patient: updatedPatient });
    } catch (err) { 
        console.error("Status update error:", err);
        res.status(500).json({ message: err.message }); 
    }
});

app.put('/api/patients/:id', async (req, res) => {
    try {
        const updateData = { ...req.body };
        const oldPatient = await Patient.findById(req.params.id);
        
        if (!oldPatient) return res.status(404).json({ message: "Patient not found" });
        
        if (updateData.status === 'Discharged') {
            updateData.queuePosition = 0;
            updateData.bookingStatus = 'Discharged';
        }
        
        const updatedPatient = await Patient.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });

        if (updateData.status === 'Discharged' || updateData.appointmentTime !== undefined) {
            await recalculateGlobalQueueByTime();
        }

        io.emit('queue_updated', { doctor: updatedPatient.assignedDoctor });
        
        res.json(updatedPatient);
    } catch (err) { 
        console.error("Update error:", err);
        res.status(500).json({ message: err.message }); 
    }
});

app.put('/api/patients/:id/respond-appointment', async (req, res) => {
    try {
        const { decision, adminNotes, roomNumber, appointmentTime } = req.body;
        const current = await Patient.findById(req.params.id);
        
        if (!current) return res.status(404).json({ message: "Patient not found" });

        if (decision === 'Accepted') {
            const newPosition = await getNextQueuePosition();
            const finalAppointmentTime = appointmentTime || '';
            
            const updated = await Patient.findByIdAndUpdate(req.params.id, { 
                $set: { 
                    bookingStatus: decision, 
                    adminNotes: adminNotes || "", 
                    roomNumber: roomNumber || current.roomNumber,
                    appointmentTime: finalAppointmentTime,
                    status: 'Waiting',
                    queuePosition: newPosition
                } 
            }, { new: true });
            
            await recalculateGlobalQueueByTime();
            io.emit('queue_updated', { doctor: updated.assignedDoctor });
            res.json({ success: true, patient: updated });
        } else {
            const updated = await Patient.findByIdAndUpdate(req.params.id, { 
                $set: { 
                    bookingStatus: decision, 
                    adminNotes: adminNotes || "", 
                    status: 'Discharged',
                    queuePosition: 0
                } 
            }, { new: true });
            
            await recalculateGlobalQueueByTime();
            io.emit('queue_updated', { doctor: updated.assignedDoctor });
            res.json({ success: true, patient: updated });
        }
    } catch (err) { 
        console.error("Appointment response error:", err);
        res.status(500).json({ message: err.message }); 
    }
});

app.post('/api/patients', async (req, res) => {
    try {
        const newPosition = await getNextQueuePosition();
        
        const patientData = {
            ...req.body,
            appointmentTime: '',
            queuePosition: req.body.status === 'Waiting' ? newPosition : 0,
            bookingStatus: req.body.bookingStatus || 'Accepted'
        };
        
        const newPatient = new Patient(patientData);
        const saved = await newPatient.save();
        
        await recalculateGlobalQueueByTime();
        io.emit('queue_updated', { doctor: saved.assignedDoctor });
        
        res.status(201).json(saved);
    } catch (err) { 
        console.error("Create patient error:", err);
        res.status(400).json({ message: err.message }); 
    }
});

// ========== DISCHARGE PATIENT WITH VISIT HISTORY ==========
app.put('/api/patients/:id/discharge', async (req, res) => {
    try {
        const { id } = req.params;
        const { notes, medications, doctorName } = req.body;
        
        const patient = await Patient.findById(id);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }
        
        const newVisit = {
            date: new Date().toLocaleDateString(),
            notes: notes || "",
            medications: medications || "",
            doctor: doctorName || patient.assignedDoctor,
            doctorName: doctorName || patient.assignedDoctor,
            diagnosis: notes || "",
            treatment: medications || ""
        };
        
        patient.visitHistory.push(newVisit);
        patient.status = 'Discharged';
        patient.bookingStatus = 'Discharged';
        patient.queuePosition = 0;
        
        await patient.save();
        await recalculateGlobalQueueByTime();
        
        const io = req.app.get('io');
        if (io) {
            io.emit('queue_updated', { doctor: patient.assignedDoctor });
        }
        
        res.json({ 
            success: true, 
            message: "Patient discharged successfully",
            patient: patient 
        });
    } catch (err) {
        console.error("Discharge error:", err);
        res.status(500).json({ message: err.message });
    }
});

app.delete('/api/patients/:id', async (req, res) => {
    try {
        await Patient.findByIdAndDelete(req.params.id);
        await recalculateGlobalQueueByTime();
        io.emit('queue_updated');
        res.json({ success: true });
    } catch (err) { 
        console.error("Delete error:", err);
        res.status(500).json({ message: err.message }); 
    }
});

app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await User.find({ role: 'doctor' });
        res.json(doctors);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/doctors/:id', async (req, res) => {
    try {
        const { name, email, specialization } = req.body;
        
        const existingDoctor = await User.findOne({ email, _id: { $ne: req.params.id } });
        if (existingDoctor) {
            return res.status(400).json({ message: "Email already in use by another doctor" });
        }
        
        const updatedDoctor = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, specialization },
            { new: true, runValidators: true }
        );
        
        if (!updatedDoctor) {
            return res.status(404).json({ message: "Doctor not found" });
        }
        
        res.json(updatedDoctor);
    } catch (err) {
        console.error("Edit doctor error:", err);
        res.status(500).json({ message: err.message });
    }
});

app.delete('/api/doctors/:id', async (req, res) => {
    try {
        const doctor = await User.findById(req.params.id);
        
        if (!doctor) {
            return res.status(404).json({ message: "Doctor not found" });
        }
        
        const hasPatients = await Patient.findOne({ assignedDoctor: doctor.name });
        if (hasPatients) {
            return res.status(400).json({ 
                message: `Cannot delete Dr. ${doctor.name} because they have assigned patients. Please reassign or discharge those patients first.` 
            });
        }
        
        await User.findByIdAndDelete(req.params.id);
        io.emit('doctors_updated');
        res.json({ success: true, message: `Dr. ${doctor.name} deleted successfully` });
    } catch (err) {
        console.error("Delete doctor error:", err);
        res.status(500).json({ message: err.message });
    }
});

app.put('/api/patients/:id/cancel-appointment', async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        
        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }
        
        if (patient.status === 'Discharged') {
            return res.status(400).json({ message: "Appointment already completed" });
        }
        
        if (patient.status === 'In-Consultation') {
            return res.status(400).json({ message: "Cannot cancel while in consultation. Please speak to the doctor." });
        }
        
        const oldPosition = patient.queuePosition;
        const doctorName = patient.assignedDoctor;
        
        patient.status = 'Discharged';
        patient.bookingStatus = 'Cancelled';
        patient.queuePosition = 0;
        patient.appointmentTime = '';
        patient.roomNumber = 'Not Assigned';
        await patient.save();
        
        if (oldPosition > 0) {
            await Patient.updateMany(
                { 
                    assignedDoctor: doctorName,
                    status: 'Waiting',
                    bookingStatus: 'Accepted',
                    queuePosition: { $gt: oldPosition }
                },
                { $inc: { queuePosition: -1 } }
            );
        }
        
        await recalculateGlobalQueueByTime();
        io.emit('queue_updated');
        res.json({ success: true, message: "Appointment cancelled successfully" });
    } catch (err) {
        console.error("Cancel appointment error:", err);
        res.status(500).json({ message: err.message });
    }
});

// ========== SHIFT MANAGEMENT ROUTES ==========

app.get('/api/shifts', async (req, res) => {
    try {
        const { doctorId, date } = req.query;
        let query = {};
        if (doctorId) query.doctorId = doctorId;
        if (date) query.date = date;
        const shifts = await Shift.find(query);
        res.json(shifts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/shifts/date/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const shifts = await Shift.find({ date });
        res.json(shifts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/shifts', async (req, res) => {
    try {
        const { doctorId, doctorName, date, time, status } = req.body;
        const shift = await Shift.findOneAndUpdate(
            { doctorId, date, time },
            { doctorId, doctorName, date, time, status, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.json({ success: true, shift });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/shifts/batch', async (req, res) => {
    try {
        const { shifts } = req.body;
        const operations = shifts.map(shift => ({
            updateOne: {
                filter: { doctorId: shift.doctorId, date: shift.date, time: shift.time },
                update: { ...shift, updatedAt: new Date() },
                upsert: true
            }
        }));
        await Shift.bulkWrite(operations);
        res.json({ success: true, message: `${shifts.length} shifts saved` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/shifts', async (req, res) => {
    try {
        const { doctorId, date, time } = req.body;
        await Shift.deleteOne({ doctorId, date, time });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/shifts/doctor/:doctorId/date/:date', async (req, res) => {
    try {
        const { doctorId, date } = req.params;
        await Shift.deleteMany({ doctorId, date });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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

app.put('/api/services/:id', async (req, res) => {
    try {
        const { name, price, category } = req.body;
        const updatedService = await Service.findByIdAndUpdate(
            req.params.id,
            { name, price, category },
            { new: true, runValidators: true }
        );
        if (!updatedService) {
            return res.status(404).json({ message: "Service not found" });
        }
        res.json(updatedService);
    } catch (err) {
        console.error("Update service error:", err);
        res.status(500).json({ message: err.message });
    }
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