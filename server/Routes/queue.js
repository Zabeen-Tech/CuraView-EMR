const express = require('express');
const router = express.Router();
const Queue = require('../models/queue'); // ✅ Fixed: changed to lowercase 'queue' (your file name)
const Patient = require('../models/patient'); // Your patient model

// Helper function to renumber ALL global positions (not just by date)
async function renumberGlobalQueue() {
  const remainingQueue = await Queue.find({
    status: { $ne: 'completed' }
  }).sort({ globalPosition: 1 });
  
  for (let i = 0; i < remainingQueue.length; i++) {
    remainingQueue[i].globalPosition = i + 1;
    await remainingQueue[i].save();
  }
}

// Get all queue (for Admin - Global View)
router.get('/', async (req, res) => {
  try {
    const queue = await Queue.find({ status: { $ne: 'completed' } })
      .sort({ globalPosition: 1 });
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get queue for specific doctor (Filtered View)
router.get('/doctor/:doctorId', async (req, res) => {
  try {
    const queue = await Queue.find({ 
      doctorId: req.params.doctorId,
      status: { $ne: 'completed' }
    }).sort({ globalPosition: 1 });
    
    // Return with local position (renumbered for doctor)
    const filteredQueue = queue.map((item, index) => ({
      ...item.toObject(),
      localPosition: index + 1
    }));
    
    res.json(filteredQueue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get patient's position (for Patient Dashboard - Live Pulse)
router.get('/patient/:patientId/position', async (req, res) => {
  try {
    const queueEntry = await Queue.findOne({ 
      patientId: req.params.patientId,
      status: { $ne: 'completed' }
    });
    
    if (!queueEntry) {
      return res.json({ position: null, message: 'No active appointment' });
    }
    
    // Count how many waiting patients are ahead (globally)
    const aheadCount = await Queue.countDocuments({
      status: 'waiting',
      globalPosition: { $lt: queueEntry.globalPosition }
    });
    
    res.json({
      position: aheadCount + 1,
      globalPosition: queueEntry.globalPosition,
      status: queueEntry.status,
      estimatedWaitTime: (aheadCount + 1) * 10 // 10 mins per patient
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add patient to queue
router.post('/', async (req, res) => {
  try {
    const { patientId, patientName, doctorId, doctorName, doctorSpecialization, appointmentDate } = req.body;
    
    // Check if already in queue
    const existing = await Queue.findOne({ 
      patientId, 
      status: { $ne: 'completed' }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Patient already in queue' });
    }
    
    // Don't set globalPosition here - let the pre-save hook handle it
    const queueEntry = new Queue({
      patientId,
      patientName,
      doctorId,
      doctorName,
      doctorSpecialization,
      appointmentDate: new Date(appointmentDate || Date.now()),
      status: 'waiting'
    });
    
    await queueEntry.save();
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      const updatedQueue = await Queue.find({ status: { $ne: 'completed' } }).sort({ globalPosition: 1 });
      io.emit('queueUpdated', updatedQueue);
    }
    
    res.status(201).json(queueEntry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update queue status (when doctor starts/completes consultation)
router.put('/:queueId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const updateData = { status };
    
    if (status === 'in-progress') {
      updateData.startTime = new Date();
    } else if (status === 'completed') {
      updateData.completionTime = new Date();
    }
    
    const queueEntry = await Queue.findByIdAndUpdate(
      req.params.queueId,
      updateData,
      { new: true }
    );
    
    if (!queueEntry) {
      return res.status(404).json({ error: 'Queue entry not found' });
    }
    
    // If completed, renumber all positions
    if (status === 'completed') {
      await renumberGlobalQueue();
    }
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      const updatedQueue = await Queue.find({ status: { $ne: 'completed' } }).sort({ globalPosition: 1 });
      io.emit('queueUpdated', updatedQueue);
      io.emit(`patientStatusChanged:${queueEntry.patientId}`, { status });
    }
    
    res.json(queueEntry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove patient from queue (when discharged)
router.delete('/patient/:patientId', async (req, res) => {
  try {
    const queueEntry = await Queue.findOneAndUpdate(
      { patientId: req.params.patientId, status: { $ne: 'completed' } },
      { status: 'completed', completionTime: new Date() },
      { new: true }
    );
    
    if (queueEntry) {
      await renumberGlobalQueue();
    }
    
    const io = req.app.get('io');
    if (io) {
      const updatedQueue = await Queue.find({ status: { $ne: 'completed' } }).sort({ globalPosition: 1 });
      io.emit('queueUpdated', updatedQueue);
    }
    
    res.json({ message: 'Patient removed from queue' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ ADDED: Get queue count (for dashboard stats)
router.get('/count', async (req, res) => {
  try {
    const waitingCount = await Queue.countDocuments({ status: 'waiting' });
    const inProgressCount = await Queue.countDocuments({ status: 'in-progress' });
    const totalCount = await Queue.countDocuments({ status: { $ne: 'completed' } });
    
    res.json({ waitingCount, inProgressCount, totalCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;