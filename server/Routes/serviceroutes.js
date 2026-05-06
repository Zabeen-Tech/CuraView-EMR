const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');  // ADD THIS for ObjectId validation
const Service = require('../models/service');

// 1. GET: Fetch all services
router.get('/', async (req, res) => {
    try {
        const services = await Service.find();
        res.status(200).json(services);
    } catch (err) {
        console.error("GET /services error:", err);
        res.status(500).json({ message: "Error fetching services", error: err.message });
    }
});

// 2. POST: Add a new service
router.post('/', async (req, res) => {
    const { name, price, category } = req.body;
    
    // Validate required fields
    if (!name || price === undefined) {
        return res.status(400).json({ message: "Name and price are required" });
    }
    
    const newService = new Service({ 
        name, 
        price: Number(price),  // Ensure price is a number
        category: category || 'General' 
    });

    try {
        const savedService = await newService.save();
        res.status(201).json(savedService);
    } catch (err) {
        console.error("POST /services error:", err);
        res.status(400).json({ message: "Error saving service", error: err.message });
    }
});

// 3. PUT: Update a service by ID (IMPROVED)
router.put('/:id', async (req, res) => {
    const { name, price, category } = req.body;
    const { id } = req.params;
    
    // Validate ObjectId format first
    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.error("Invalid ObjectId:", id);
        return res.status(400).json({ message: "Invalid service ID format" });
    }
    
    // Prepare update data (only include fields that are provided)
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = Number(price);
    if (category !== undefined) updateData.category = category;
    
    // If no fields to update
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
    }
    
    try {
        const updatedService = await Service.findByIdAndUpdate(
            id,
            updateData,
            { 
                new: true,           // Return updated document
                runValidators: true, // Run schema validation
                context: 'query'     // Required for some validators
            }
        );
        
        if (!updatedService) {
            return res.status(404).json({ message: "Service not found" });
        }
        
        console.log(`✅ Service ${id} updated successfully:`, updatedService.name);
        res.status(200).json(updatedService);
        
    } catch (err) {
        console.error("PUT /services/:id error:", err);
        
        // Handle specific Mongoose errors
        if (err.name === 'ValidationError') {
            return res.status(400).json({ 
                message: "Validation failed", 
                error: err.message 
            });
        }
        
        if (err.name === 'CastError') {
            return res.status(400).json({ 
                message: "Invalid ID format", 
                error: err.message 
            });
        }
        
        res.status(500).json({ 
            message: "Error updating service", 
            error: err.message 
        });
    }
});

// 4. DELETE: Remove a service by ID
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid service ID format" });
    }
    
    try {
        const deletedService = await Service.findByIdAndDelete(id);
        
        if (!deletedService) {
            return res.status(404).json({ message: "Service not found" });
        }
        
        console.log(`✅ Service ${id} deleted successfully`);
        res.status(200).json({ message: "Service deleted successfully" });
    } catch (err) {
        console.error("DELETE /services/:id error:", err);
        res.status(500).json({ message: "Error deleting service", error: err.message });
    }
});

module.exports = router;