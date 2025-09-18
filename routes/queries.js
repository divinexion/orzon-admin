const express = require('express');
const Query = require('../models/query');
const Product = require('../models/product');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const search = (req.query.search || '').trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { productSerialNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Query.countDocuments(filter);
    const queries = await Query.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Fetch related products if serial numbers exist
    const serialNumbers = queries
      .filter(q => q.productSerialNumber)
      .map(q => q.productSerialNumber);
    
    const products = await Product.find({
      serialNumber: { $in: serialNumbers }
    }).lean();
    
    const productMap = {};
    products.forEach(p => {
      productMap[p.serialNumber] = p;
    });

    // Attach product info to queries
    queries.forEach(q => {
      if (q.productSerialNumber && productMap[q.productSerialNumber]) {
        q.product = productMap[q.productSerialNumber];
      }
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.render('queries/list', {
      layout: 'main',
      title: 'Queries',
      queries,
      total,
      search,
      pagination: {
        page,
        totalPages,
        baseUrl: '/queries?limit=' + limit + (search ? '&search=' + encodeURIComponent(search) : '')
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const query = await Query.findById(req.params.id).lean();
    if (!query) {
      req.flash('error', 'Query not found');
      return res.redirect('/queries');
    }

    let product = null;
    if (query.productSerialNumber) {
      product = await Product.findOne({ serialNumber: query.productSerialNumber }).lean();
    }

    res.render('queries/detail', {
      layout: 'main',
      title: 'Query Details',
      query,
      product,
    });
  } catch (err) {
    next(err);
  }
});

// Mark query as resolved/unresolved
router.post('/:id/toggle-status', async (req, res, next) => {
  try {
    const query = await Query.findById(req.params.id);
    if (!query) {
      req.flash('error', 'Query not found');
      return res.redirect('/queries');
    }

    query.isResolved = !query.isResolved;
    query.resolvedAt = query.isResolved ? new Date() : null;
    await query.save();

    req.flash('success', `Query marked as ${query.isResolved ? 'resolved' : 'unresolved'}`);
    res.redirect('back');
  } catch (err) {
    next(err);
  }
});

// Delete query
router.post('/:id/delete', async (req, res, next) => {
  try {
    await Query.findByIdAndDelete(req.params.id);
    req.flash('success', 'Query deleted');
    res.redirect('/queries');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
