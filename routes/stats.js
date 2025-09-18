const express = require('express');
const Product = require('../models/product');
const router = express.Router();

// Get product and warranty statistics
router.get('/dashboard', async (req, res, next) => {
  try {
    // Get all products for statistics
    const products = await Product.find().lean();
    
    const now = new Date();
    
    // Calculate statistics
    const stats = {
      totalProducts: products.length,
      totalSold: 0,
      totalUnsold: 0,
      warranty: {
        totalRegistered: 0,
        totalActive: 0,
        totalExpired: 0,
        totalPending: 0,
        totalVoid: 0
      }
    };
    
    products.forEach(product => {
      // Count sold/unsold
      if (product.soldDate) {
        stats.totalSold++;
      } else {
        stats.totalUnsold++;
      }
      
      // Count warranty statistics
      if (product.warrantyRegistered && product.warranty) {
        stats.warranty.totalRegistered++;
        
        // Check warranty status
        if (product.warranty.status === 'pending') {
          stats.warranty.totalPending++;
        } else if (product.warranty.status === 'void') {
          stats.warranty.totalVoid++;
        } else {
          // Check if expired for active warranties
          const expiryDate = new Date(product.warranty.expiryDate);
          if (expiryDate < now) {
            stats.warranty.totalExpired++;
          } else {
            stats.warranty.totalActive++;
          }
        }
      }
    });
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics'
    });
  }
});

module.exports = router;
