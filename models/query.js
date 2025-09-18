const mongoose = require('mongoose');

const QuerySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true }, // Contact email
    subject: { type: String, required: true }, // Query subject/category
    description: { type: String, required: true }, // Message/description
    productSerialNumber: { type: String, default: null }, // Optional product serial
    queryType: { 
      type: String, 
      enum: ['technical-support', 'warranty-claim', 'bulk-order', 'general-inquiry', 'partnership'],
      default: 'general-inquiry'
    },
    source: { type: String, default: 'contact-form' }, // Track source of query
    isResolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolvedBy: { type: String }, // Admin who resolved the query
    adminNotes: { type: String }, // Internal notes for admins
  },
  { timestamps: true }
);

module.exports = mongoose.model('Query', QuerySchema);
