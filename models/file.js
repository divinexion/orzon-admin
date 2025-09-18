const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  mimetype: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  path: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    enum: ['warranty_bill', 'other'],
    default: 'warranty_bill',
  },
  uploadedBy: {
    type: String, // Can be 'admin' or customer email/phone
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    index: true,
  },
  metadata: {
    ip: String,
    userAgent: String,
    source: {
      type: String,
      enum: ['api', 'admin'],
      default: 'api',
    },
  },
}, {
  timestamps: true,
});

// Index for faster queries
fileSchema.index({ productId: 1, fileType: 1 });
fileSchema.index({ uploadedAt: -1 });

const File = mongoose.model('File', fileSchema);

module.exports = File;
