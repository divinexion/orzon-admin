const express = require('express');
const Query = require('../models/query');

const router = express.Router();

// Add CORS headers for API routes
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

const rateLimit = require('express-rate-limit');
const MongoStore = require('rate-limit-mongo');

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


// Public endpoint for contact form and general queries
router.post('/queries', warrantyLimiter, async (req, res, next) => {
  try {
    const { name, email, subject, description, productSerialNumber } = req.body;
    
    // Validate required fields
    if (!name || !email || !subject || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, subject, and description are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    // Create query with all fields
    const queryData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      description: description.trim(),
      queryType: subject, // Map subject to queryType
      source: 'contact-form'
    };
    
    // Add product serial number if provided
    if (productSerialNumber && productSerialNumber.trim()) {
      queryData.productSerialNumber = productSerialNumber.trim();
    }
    
    const doc = await Query.create(queryData);
    
    res.json({
      success: true,
      message: 'Your message has been sent successfully! We will get back to you within 24 hours.',
      queryId: doc._id
    });
    
  } catch (err) {
    console.error('Query creation error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.'
    });
  }
});


module.exports = router;
