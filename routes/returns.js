const express = require('express');
const Return = require('../models/return');
const { TYPE_CAPACITIES, SUPPORTED_PLATFORMS } = require('../config');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const q = (req.query.q || '').trim();
    const typeCapacity = (req.query.type || '').trim();
    const platform = (req.query.platform || '').trim();
    const source = (req.query.source || '').trim();
    const returnReason = (req.query.reason || '').trim();
    const dateRange = (req.query.dateRange || '').trim();

    const filter = {};
    
    // Text search
    if (q) {
      filter.$text = { $search: q };
    }
    
    // Filters
    if (typeCapacity) {
      filter.typeCapacity = typeCapacity;
    }
    if (platform) {
      filter.platform = platform;
    }
    if (source) {
      filter.source = source;
    }
    if (returnReason) {
      filter.returnReason = { $regex: returnReason, $options: 'i' };
    }
    
    // Date range filter
    if (dateRange) {
      const now = new Date();
      let dateFilter = {};
      
      switch (dateRange) {
        case 'today':
          const startOfDay = new Date(now);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(now);
          endOfDay.setHours(23, 59, 59, 999);
          dateFilter = { returnDate: { $gte: startOfDay, $lte: endOfDay } };
          break;
        case 'week':
          const oneWeekAgo = new Date(now);
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          dateFilter = { returnDate: { $gte: oneWeekAgo } };
          break;
        case 'month':
          const oneMonthAgo = new Date(now);
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          dateFilter = { returnDate: { $gte: oneMonthAgo } };
          break;
        case 'quarter':
          const threeMonthsAgo = new Date(now);
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          dateFilter = { returnDate: { $gte: threeMonthsAgo } };
          break;
      }
      
      Object.assign(filter, dateFilter);
    }

    const total = await Return.countDocuments(filter);
    const items = await Return.find(filter)
      .sort({ returnDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalPages = Math.max(1, Math.ceil(total / limit));
    
    // Get distinct values for filters
    const distinctSources = await Return.distinct('source', { source: { $ne: null, $ne: '' } });
    const distinctReasons = await Return.distinct('returnReason');
    
    // Calculate some basic stats
    const stats = {
      total,
      thisMonth: 0,
      totalValue: 0 // Could be calculated based on product values
    };
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    stats.thisMonth = await Return.countDocuments({
      returnDate: { $gte: oneMonthAgo }
    });

    res.render('returns/list', {
      layout: 'main',
      title: 'Returns Management',
      items,
      stats,
      filters: { q, type: typeCapacity, platform, source, reason: returnReason, dateRange },
      capacities: TYPE_CAPACITIES,
      platforms: SUPPORTED_PLATFORMS,
      sources: distinctSources.sort(),
      reasons: distinctReasons.sort(),
      pagination: { 
        page, 
        totalPages, 
        baseUrl: '/returns?limit=' + limit 
          + (q ? '&q=' + encodeURIComponent(q) : '') 
          + (typeCapacity ? '&type=' + encodeURIComponent(typeCapacity) : '')
          + (platform ? '&platform=' + encodeURIComponent(platform) : '') 
          + (source ? '&source=' + encodeURIComponent(source) : '')
          + (returnReason ? '&reason=' + encodeURIComponent(returnReason) : '')
          + (dateRange ? '&dateRange=' + encodeURIComponent(dateRange) : '')
      },
    });

  } catch (err) {
    next(err);
  }
});

// Return detail page
router.get('/:id', async (req, res, next) => {
  try {
    const returnItem = await Return.findById(req.params.id).lean();
    
    if (!returnItem) {
      req.flash('error', { message: 'Return record not found' });
      return res.redirect('/returns');
    }
    
    // Get the associated product details if serialNumber exists
    let product = null;
    if (returnItem.serialNumber) {
      const Product = require('../models/product');
      product = await Product.findOne({ serialNumber: returnItem.serialNumber }).lean();
    }
    
    // If we found a product, attach it to the return item
    if (product) {
      returnItem.product = product;
    } else {
      // Create a basic product object from return data if no product found
      returnItem.product = {
        name: returnItem.productName || 'Unknown Product',
        serialNumber: returnItem.serialNumber,
        productType: 'Storage Device', // Default
        typeCapacity: returnItem.typeCapacity || 'Unknown',
        platform: returnItem.platform || 'Unknown',
        source: returnItem.source || 'Unknown'
      };
    }
    
    res.render('returns/detail', {
      layout: 'main',
      title: `Return Details - ${returnItem.serialNumber || returnItem._id}`,
      returnItem,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;