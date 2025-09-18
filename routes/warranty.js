const express = require('express');
const rateLimit = require('express-rate-limit');
const MongoStore = require('rate-limit-mongo');
const Product = require('../models/product');
const File = require('../models/file');
const upload = require('../middleware/upload');
const config = require('../config');
const path = require('path');

const router = express.Router();

// Additional CORS headers for warranty API endpoints
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Rate limiter configuration using MongoDB
const createRateLimiter = () => {
  const mongoUri = process.env.MONGODB_URI;
  
  return rateLimit({
    store: new MongoStore({
      uri: mongoUri,
      collectionName: 'rate_limits',
      expireTimeMs: 15 * 60 * 1000, // 15 minutes
      errorHandler: console.error.bind(null, 'rate-limit-mongo')
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: 'Too many warranty registration attempts from this IP, please try again after 15 minutes',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => req.user !== undefined, // Skip rate limiting for authenticated admin users
  });
};

// Apply rate limiting to warranty routes
const warrantyLimiter = createRateLimiter();

// Handle preflight requests for warranty endpoints
router.options('/check/:serialNumber', (req, res) => {
  res.sendStatus(200);
});

router.options('/register', (req, res) => {
  res.sendStatus(200);
});

// Public API: Check warranty status by serial number
router.get('/check/:serialNumber', warrantyLimiter, async (req, res) => {
  try {
    const { serialNumber } = req.params;
    
    const product = await Product.findOne({ serialNumber })
      .populate('warranty.billFile')
      .lean();
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found with this serial number'
      });
    }
    
    if (!product.warrantyRegistered || !product.warranty) {
      return res.json({
        success: true,
        warrantyRegistered: false,
        message: 'Warranty not registered for this product'
      });
    }
    
    // Check if warranty is expired
    const now = new Date();
    const expiryDate = new Date(product.warranty.expiryDate);
    const isExpired = now > expiryDate;
    
    // Update status if expired
    if (isExpired && product.warranty.status === 'active') {
      await Product.updateOne(
        { serialNumber },
        { 'warranty.status': 'expired' }
      );
      product.warranty.status = 'expired';
    }
    
    return res.json({
      success: true,
      warrantyRegistered: true,
      warranty: {
        status: product.warranty.status,
        registrationDate: product.warranty.registrationDate,
        expiryDate: product.warranty.expiryDate,
        durationMonths: product.warranty.durationMonths,
        isExpired,
        daysRemaining: isExpired ? 0 : Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
      },
      product: {
        name: product.name,
        productType: product.productType,
        typeCapacity: product.typeCapacity,
        serialNumber: product.serialNumber,
        platform: product.platform
      },
      buyer: product.buyer
    });
  } catch (error) {
    console.error('Warranty check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Public API: Register warranty
router.post('/register', warrantyLimiter, upload.single('billFile'), async (req, res) => {
  try {
    const { 
      serialNumber, 
      platform,
      durationMonths = 12,
      // Buyer details
      buyerName,
      buyerPhone,
      buyerEmail,
      buyerAddress,
      buyerPaymentMethod
    } = req.body;
    
    // Validate required fields
    if (!serialNumber) {
      return res.status(400).json({
        success: false,
        message: 'Serial number is required'
      });
    }
    
    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'Platform is required'
      });
    }
    
    // Validate platform
    if (!config.SUPPORTED_PLATFORMS.includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid platform. Supported platforms: ${config.SUPPORTED_PLATFORMS.join(', ')}`
      });
    }
    
    // Validate buyer details
    if (!buyerName || !buyerEmail || !buyerPhone) {
      return res.status(400).json({
        success: false,
        message: 'Buyer name, email, and phone are required'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Bill file is required'
      });
    }
    
    // Find or create product
    let product = await Product.findOne({ serialNumber });
    
    if (product) {
      // Check if warranty already registered
      if (product.warrantyRegistered) {
        return res.status(400).json({
          success: false,
          message: 'Warranty already registered for this product'
        });
      }
      
      // Update existing product with buyer details and platform
      product.buyer = {
        name: buyerName,
        phone: buyerPhone,
        email: buyerEmail,
        address: buyerAddress || '',
        paymentMethod: buyerPaymentMethod || ''
      };
      product.platform = platform.toLowerCase();
      product.soldDate = new Date(); // Set sold date when warranty is registered
    } else {
      // Create new product with basic details
      product = new Product({
        serialNumber,
        name: `Product ${serialNumber}`, // Default name, can be updated by admin later
        platform: platform.toLowerCase(),
        typeCapacity: '512', // Default capacity, can be updated by admin later
        buyer: {
          name: buyerName,
          phone: buyerPhone,
          email: buyerEmail,
          address: buyerAddress || '',
          paymentMethod: buyerPaymentMethod || ''
        },
        soldDate: new Date()
      });
    }
    
    // Save the product first to get the ID
    await product.save();
    
    // Save file information to database
    const fileDoc = await File.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      fileType: 'warranty_bill',
      uploadedBy: buyerEmail,
      productId: product._id,
      metadata: {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        source: 'api'
      }
    });
    
    // Calculate warranty dates
    const registrationDate = new Date();
    const expiryDate = new Date(registrationDate);
    expiryDate.setMonth(expiryDate.getMonth() + parseInt(durationMonths));
    
    // Update product with warranty information (pending approval)
    product.warranty = {
      registrationDate,
      expiryDate,
      durationMonths: parseInt(durationMonths),
      status: 'pending', // Set as pending for admin approval
      billFile: fileDoc._id,
      registeredBy: buyerEmail,
      registrationSource: 'api',
      notes: `Warranty request submitted via public API on ${registrationDate.toISOString()} for platform: ${platform}`
    };
    product.warrantyRegistered = true;
    
    await product.save();
    
    res.json({
      success: true,
      message: 'Warranty registration request submitted successfully. Pending admin approval.',
      warranty: {
        registrationDate,
        expiryDate,
        durationMonths: parseInt(durationMonths),
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Warranty registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});



module.exports = router;
