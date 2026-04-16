const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, default: 'General' }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);