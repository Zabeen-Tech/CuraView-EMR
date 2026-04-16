const express = require('express');
const router = express.Router();
const Service = require('../models/settings'); // Path to your schema file

// 1. GET: Fetch all services (to show in the list on page load)
router.get('/', async (req, res) => {
    try {
        const services = await Service.find();
        res.status(200).json(services);
    } catch (err) {
        res.status(500).json({ message: "Error fetching services", error: err.message });
    }
});

// 2. POST: Add a new service
router.post('/', async (req, res) => {
    const { name, price } = req.body;
    const newService = new Service({ name, price });

    try {
        const savedService = await newService.save();
        res.status(201).json(savedService);
    } catch (err) {
        res.status(400).json({ message: "Error saving service", error: err.message });
    }
});

// 3. DELETE: Remove a service by ID
router.delete('/:id', async (req, res) => {
    try {
        await Service.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Service deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting service", error: err.message });
    }
});

module.exports = router;