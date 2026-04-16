const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
    // Links to your Patient model
    patientId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Patient', 
        required: true 
    },
    patientName: { 
        type: String, 
        required: true 
    },
    // Aligned with frontend: changed 'invoiceNumber' to 'invoiceId'
    invoiceId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    items: [{
        service: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, default: 1 },
        total: { type: Number, required: true }
    }],
    // Added subtotal to match your calculations
    subtotal: { 
        type: Number, 
        required: true 
    },
    discount: { 
        type: Number, 
        default: 0 
    },
    totalAmount: { 
        type: Number, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['Paid', 'Unpaid'], 
        default: 'Unpaid' 
    },
    date: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);