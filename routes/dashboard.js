const express = require('express');
const Product = require('../models/product');
const Return = require('../models/return');
const Query = require('../models/query');
const { TYPE_CAPACITIES, SUPPORTED_PLATFORMS } = require('../config');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    // Get filter parameters
    const {
      dateRange = 'all', // all, week, month, quarter, year
      platform,
      capacity,
      source,
      warrantyStatus
    } = req.query;
    
    // Date filtering
    const now = new Date();
    let dateFilter = {};
    
    switch (dateRange) {
      case 'week':
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        dateFilter = { createdAt: { $gte: oneWeekAgo } };
        break;
      case 'month':
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        dateFilter = { createdAt: { $gte: oneMonthAgo } };
        break;
      case 'quarter':
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        dateFilter = { createdAt: { $gte: threeMonthsAgo } };
        break;
      case 'year':
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        dateFilter = { createdAt: { $gte: oneYearAgo } };
        break;
    }
    
    // Build product filter
    const productFilter = { ...dateFilter };
    if (platform) productFilter.platform = platform;
    if (capacity) productFilter.typeCapacity = capacity;
    if (source) productFilter.source = source;
    if (warrantyStatus) {
      if (warrantyStatus === 'registered') {
        productFilter.warrantyRegistered = true;
      } else if (warrantyStatus === 'not_registered') {
        productFilter.warrantyRegistered = false;
      } else {
        productFilter.warrantyRegistered = true;
        productFilter['warranty.status'] = warrantyStatus;
      }
    }
    
    // Get filtered data with limits for performance
    const filteredProducts = await Product.find(productFilter).lean();
    
    // Limit data retrieval for better performance
    const allReturns = await Return.find().limit(1000).lean();
    const allQueries = await Query.find().limit(1000).lean();
    
    // Only get basic stats from all products, not full data
    const totalProductsCount = await Product.countDocuments();
    const soldProductsCount = await Product.countDocuments({ soldDate: { $ne: null } });
    
    // Get distinct sources for filter dropdown
    const distinctSources = await Product.distinct('source', { source: { $ne: null, $ne: '' } });
    
    // Basic Statistics
    const stats = {
      totalProducts: filteredProducts.length,
      totalSold: 0,
      totalUnsold: 0,
      totalReturns: allReturns.length,
      warranty: {
        totalRegistered: 0,
        totalActive: 0,
        totalExpired: 0,
        totalPending: 0,
        totalVoid: 0
      },
      queries: {
        total: allQueries.length,
        thisMonth: 0,
        thisWeek: 0
      },
      revenue: {
        estimated: 0, // Based on sold products
        avgPerProduct: 0
      }
    };
    
    // Platform Analytics
    const platformStats = {};
    SUPPORTED_PLATFORMS.forEach(platform => {
      platformStats[platform] = {
        total: 0,
        sold: 0,
        warranty: 0,
        returns: 0,
        percentage: 0
      };
    });
    
    // Capacity Analytics
    const capacityStats = {};
    TYPE_CAPACITIES.forEach(capacity => {
      capacityStats[capacity] = {
        total: 0,
        sold: 0,
        warranty: 0,
        returns: 0,
        percentage: 0
      };
    });
    
    // Source Analytics (Dynamic based on actual data)
    const sourceStats = {};
    
    // Date ranges for trending
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Process Filtered Products
    filteredProducts.forEach(product => {
      // Basic counts
      if (product.soldDate) {
        stats.totalSold++;
      } else {
        stats.totalUnsold++;
      }
      
      // Platform stats
      if (product.platform && platformStats[product.platform]) {
        platformStats[product.platform].total++;
        if (product.soldDate) {
          platformStats[product.platform].sold++;
        }
        if (product.warrantyRegistered) {
          platformStats[product.platform].warranty++;
        }
      }
      
      // Capacity stats
      if (product.typeCapacity && capacityStats[product.typeCapacity]) {
        capacityStats[product.typeCapacity].total++;
        if (product.soldDate) {
          capacityStats[product.typeCapacity].sold++;
        }
        if (product.warrantyRegistered) {
          capacityStats[product.typeCapacity].warranty++;
        }
      }
      
      // Source stats
      if (product.source) {
        if (!sourceStats[product.source]) {
          sourceStats[product.source] = {
            total: 0,
            sold: 0,
            warranty: 0,
            returns: 0,
            percentage: 0
          };
        }
        sourceStats[product.source].total++;
        if (product.soldDate) {
          sourceStats[product.source].sold++;
        }
        if (product.warrantyRegistered) {
          sourceStats[product.source].warranty++;
        }
      }
      
      // Warranty statistics
      if (product.warrantyRegistered && product.warranty) {
        stats.warranty.totalRegistered++;
        
        if (product.warranty.status === 'pending') {
          stats.warranty.totalPending++;
        } else if (product.warranty.status === 'active') {
          // Check if expired
          const expiryDate = new Date(product.warranty.expiryDate);
          if (expiryDate < now) {
            stats.warranty.totalExpired++;
          } else {
            stats.warranty.totalActive++;
          }
        } else if (product.warranty.status === 'expired') {
          stats.warranty.totalExpired++;
        } else if (product.warranty.status === 'void') {
          stats.warranty.totalVoid++;
        }
      }
    });
    
    // Calculate percentages
    Object.keys(platformStats).forEach(platform => {
      platformStats[platform].percentage = stats.totalProducts > 0 
        ? Math.round((platformStats[platform].total / stats.totalProducts) * 100) 
        : 0;
    });
    
    Object.keys(capacityStats).forEach(capacity => {
      capacityStats[capacity].percentage = stats.totalProducts > 0 
        ? Math.round((capacityStats[capacity].total / stats.totalProducts) * 100) 
        : 0;
    });
    
    Object.keys(sourceStats).forEach(source => {
      sourceStats[source].percentage = stats.totalProducts > 0 
        ? Math.round((sourceStats[source].total / stats.totalProducts) * 100) 
        : 0;
    });
    
    // Process Returns for statistics
    allReturns.forEach(returnItem => {
      if (returnItem.product) {
        if (returnItem.product.platform && platformStats[returnItem.product.platform]) {
          platformStats[returnItem.product.platform].returns++;
        }
        
        if (returnItem.product.typeCapacity && capacityStats[returnItem.product.typeCapacity]) {
          capacityStats[returnItem.product.typeCapacity].returns++;
        }
        
        if (returnItem.product.source && sourceStats[returnItem.product.source]) {
          sourceStats[returnItem.product.source].returns++;
        }
      }
    });
    
    // Process Queries for statistics
    allQueries.forEach(query => {
      const queryDate = new Date(query.createdAt);
      if (queryDate >= oneMonthAgo) {
        stats.queries.thisMonth++;
      }
      if (queryDate >= oneWeekAgo) {
        stats.queries.thisWeek++;
      }
    });
    
    // Recent Activity
    const recentProducts = filteredProducts
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);
    
    const recentReturns = allReturns
      .sort((a, b) => new Date(b.returnDate) - new Date(a.returnDate))
      .slice(0, 5);
    
    // Get recent warranties with a simple query
    const recentWarranties = await Product.find({ 
      warrantyRegistered: true, 
      'warranty.registrationDate': { $ne: null } 
    })
    .sort({ 'warranty.registrationDate': -1 })
    .limit(10)
    .lean();
    
    // Sales trends (monthly data for last 6 months) - use aggregation for better performance
    const salesTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      // Use count queries instead of loading all data
      const monthSales = await Product.countDocuments({
        soldDate: { $gte: monthStart, $lte: monthEnd }
      });
      
      const monthReturns = allReturns.filter(returnItem => {
        const returnDate = new Date(returnItem.returnDate);
        return returnDate >= monthStart && returnDate <= monthEnd;
      }).length;
      
      const monthWarranties = await Product.countDocuments({
        warrantyRegistered: true,
        'warranty.registrationDate': { $gte: monthStart, $lte: monthEnd }
      });
      
      salesTrends.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        sales: monthSales,
        returns: monthReturns,
        warranties: monthWarranties
      });
    }
    
    // Top performing metrics
    const topPlatforms = Object.entries(platformStats)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
    
    const topCapacities = Object.entries(capacityStats)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
    
    const topSources = Object.entries(sourceStats)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);
    
    res.render('dashboard/index', {
      layout: 'main',
      title: 'Dashboard - Analytics & Overview',
      stats,
      platformStats,
      capacityStats,
      sourceStats,
      recentProducts,
      recentReturns,
      recentWarranties,
      salesTrends,
      topPlatforms,
      topCapacities,
      topSources,
      capacities: TYPE_CAPACITIES,
      platforms: SUPPORTED_PLATFORMS,
      sources: distinctSources.sort(),
      filters: {
        dateRange,
        platform,
        capacity,
        source,
        warrantyStatus
      }
    });
    
  } catch (err) {
    console.error('Dashboard error:', err);
    
    // Fallback for dashboard errors - provide minimal data
    try {
      const basicStats = {
        totalProducts: await Product.countDocuments(),
        totalSold: await Product.countDocuments({ soldDate: { $ne: null } }),
        totalReturns: await Return.countDocuments(),
        totalQueries: await Query.countDocuments()
      };
      
      res.render('dashboard/index', {
        layout: 'main',
        title: 'Dashboard - Analytics & Overview',
        stats: basicStats,
        error: 'Some dashboard features may be temporarily unavailable',
        platformStats: {},
        capacityStats: {},
        sourceStats: {},
        recentProducts: [],
        recentReturns: [],
        recentWarranties: [],
        salesTrends: [],
        topPlatforms: [],
        topCapacities: [],
        topSources: [],
        capacities: TYPE_CAPACITIES,
        platforms: SUPPORTED_PLATFORMS,
        sources: [],
        filters: req.query
      });
    } catch (fallbackErr) {
      console.error('Dashboard fallback error:', fallbackErr);
      next(err);
    }
  }
});

module.exports = router;