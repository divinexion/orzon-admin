const mongoose = require('mongoose');

const BuyerSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    email: String,
    address: String,
    paymentMethod: String,
  },
  { _id: false }
);

const WarrantySchema = new mongoose.Schema(
  {
    registrationDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    durationMonths: { type: Number, default: 12 },
    status: { 
      type: String, 
      enum: ['pending', 'active', 'expired', 'void'], 
      default: 'active' 
    },
    billFile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
    },
    registeredBy: {
      type: String, // 'customer' or admin email
      required: true,
    },
    registrationSource: {
      type: String,
      enum: ['api', 'admin'],
      required: true,
    },
    notes: String,
    lastModifiedBy: String,
    lastModifiedAt: Date,
  },
  { _id: false }
);

const ReturnSchema = new mongoose.Schema(
  {
    // Original product data (same as Product model)
    serialNumber: { type: String, required: true, index: true },
    name: { type: String, required: true },
    productType: { type: String, default: 'Disk', index: true },
    typeCapacity: { type: String, required: true },
    platform: { 
      type: String, 
      required: false,
      enum: ['amazon', 'flipkart', 'myntra', 'snapdeal', 'paytm', 'offline', 'other'],
      index: true,
      lowercase: true
    },
    description: { type: String },
    addDate: { type: Date, default: Date.now },
    buyer: { type: BuyerSchema, default: {} },
    soldDate: { type: Date },
    warranty: { type: WarrantySchema, default: null },
    warrantyRegistered: { type: Boolean, default: false, index: true },
    
    // Return-specific fields
    returnDate: { type: Date, default: Date.now, required: true },
    returnReason: { type: String, required: true },
    returnNotes: { type: String },
    returnedBy: { type: String, required: true }, // Admin who marked it as return
    originalProductId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Reference to original product ID
    
    // Keep original timestamps
    originalCreatedAt: { type: Date },
    originalUpdatedAt: { type: Date },
  },
  { 
    timestamps: true,
    collection: 'returns' // Explicit collection name
  }
);

// Indexes for efficient queries
ReturnSchema.index({ serialNumber: 'text', name: 'text', description: 'text', 'buyer.name': 'text', 'buyer.email': 'text' });
ReturnSchema.index({ returnDate: -1 });
ReturnSchema.index({ returnedBy: 1 });
ReturnSchema.index({ originalProductId: 1 });

module.exports = mongoose.model('Return', ReturnSchema);