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

const ProductSchema = new mongoose.Schema(
  {
    serialNumber: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    productType: { type: String, default: 'Disk', index: true },
    typeCapacity: { type: String, required: true },
    platform: { 
      type: String, 
      required: false, // Optional - filled during warranty registration
      enum: ['amazon', 'flipkart', 'myntra', 'snapdeal', 'paytm', 'offline', 'other'],
      index: true,
      lowercase: true
    },
    source: { 
      type: String, 
      required: false, // Optional - tracks where products were bought from (supplier)
      index: true,
      trim: true
    },
    description: { type: String },
    addDate: { type: Date, default: Date.now },
    buyer: { type: BuyerSchema, default: {} },
    soldDate: { type: Date },
    warranty: { type: WarrantySchema, default: null },
    warrantyRegistered: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

ProductSchema.index({ serialNumber: 'text', name: 'text', description: 'text', 'buyer.name': 'text', 'buyer.email': 'text' });
ProductSchema.index({ serialNumber: 1, platform: 1 }); // Compound index for platform-specific queries

module.exports = mongoose.model('Product', ProductSchema);
