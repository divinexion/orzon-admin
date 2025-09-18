const express = require('express');
const Product = require('../models/product');
const Return = require('../models/return');
const Query = require('../models/query');
const File = require('../models/file');
const upload = require('../middleware/upload');
const { TYPE_CAPACITIES, PRODUCT_TYPE, SUPPORTED_PLATFORMS } = require('../config');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const q = (req.query.q || '').trim();
    const typeCapacity = (req.query.type || '').trim();
    const platform = (req.query.platform || '').trim();
    const buyer = (req.query.buyer || '').trim();

    const filter = {};
    if (q) {
      filter.$text = { $search: q };
    }
    if (typeCapacity) {
      filter.typeCapacity = typeCapacity;
    }
    if (platform) {
      filter.platform = platform;
    }
    if (buyer) {
      filter.$or = [
        { 'buyer.name': { $regex: buyer, $options: 'i' } },
        { 'buyer.email': { $regex: buyer, $options: 'i' } },
        { 'buyer.phone': { $regex: buyer, $options: 'i' } },
      ];
    }

    const total = await Product.countDocuments(filter);
    const items = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Calculate statistics
    const allProducts = await Product.find().lean();
    const allReturns = await Return.find().lean();
    const now = new Date();
    
    const stats = {
      totalProducts: allProducts.length,
      totalSold: 0,
      totalUnsold: 0,
      totalReturns: allReturns.length,
      warranty: {
        totalRegistered: 0,
        totalActive: 0,
        totalExpired: 0,
        totalPending: 0
      }
    };
    
    allProducts.forEach(product => {
      // Count sold/unsold
      if (product.soldDate) {
        stats.totalSold++;
      } else {
        stats.totalUnsold++;
      }
      
      // Count warranty statistics
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
        }
      }
    });

    res.render('products/list', {
      layout: 'main',
      title: 'Products',
      items,
      stats,
      filters: { q, buyer, type: typeCapacity, platform },
      capacities: TYPE_CAPACITIES,
      platforms: SUPPORTED_PLATFORMS,
      pagination: { page, totalPages, baseUrl: '/products?limit=' + limit + (q ? '&q=' + encodeURIComponent(q) : '') + (buyer ? '&buyer=' + encodeURIComponent(buyer) : '') + (typeCapacity ? '&type=' + encodeURIComponent(typeCapacity) : '') + (platform ? '&platform=' + encodeURIComponent(platform) : '') },
    });

  } catch (err) {
    next(err);
  }
});

router.get('/new', (req, res) => {
  res.render('products/form', {
    layout: 'main',
    title: 'Add Product',
    product: { productType: PRODUCT_TYPE },
    capacities: TYPE_CAPACITIES,
    platforms: SUPPORTED_PLATFORMS,
    isEdit: false,
  });
});

// View warranty requests page
router.get('/warranty-requests', async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { warrantyRegistered: true };
    
    if (status) {
      filter['warranty.status'] = status;
    }
    
    const requests = await Product.find(filter)
      .populate('warranty.billFile')
      .sort({ 'warranty.registrationDate': -1 })
      .lean();
    
    // Count pending requests
    const pendingCount = await Product.countDocuments({
      warrantyRegistered: true,
      'warranty.status': 'pending'
    });
    
    res.render('warranty/requests', {
      layout: 'main',
      title: 'Warranty Requests',
      requests,
      pendingCount,
      status
    });
  } catch (err) {
    next(err);
  }
});


// Product detail page
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('warranty.billFile')
      .lean();
    
    if (!product) {
      return res.redirect('/products');
    }
    
    // Fetch related queries for this product
    const relatedQueries = await Query.find({
      productSerialNumber: product.serialNumber
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
    
    res.render('products/detail', {
      layout: 'main',
      title: `${product.name} - Details`,
      product,
      relatedQueries,
    });
  } catch (err) {
    next(err);
  }
});


// Download warranty bill file
router.get('/:id/warranty/bill', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('warranty.billFile')
      .lean();
    
    if (!product || !product.warranty || !product.warranty.billFile) {
      return res.status(404).send('Bill file not found');
    }
    
    const file = product.warranty.billFile;
    const filePath = file.path;
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found on server');
    }
    
    // Send the file
    res.download(filePath, file.originalName);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const product = await Product.create({
      serialNumber: b.serialNumber,
      name: b.name,
      productType: b.productType || PRODUCT_TYPE,
      typeCapacity: b.typeCapacity,
      platform: b.platform || 'other',
      description: b.description,
      addDate: b.addDate || new Date(),
      buyer: {
        name: b.buyerName,
        phone: b.buyerPhone,
        email: b.buyerEmail,
        address: b.buyerAddress,
        paymentMethod: b.buyerPaymentMethod,
      },
      soldDate: b.soldDate || undefined,
    });


    req.flash('success', { message: 'Product created' });
    res.redirect('/products');
  } catch (err) {
    if (err.code === 11000) {
      req.flash('error', { message: 'Serial number already exists' });
      return res.redirect('back');
    }
    next(err);
  }
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.redirect('/products');
    res.render('products/form', {
      layout: 'main',
      title: 'Edit Product',
      product,
      capacities: TYPE_CAPACITIES,
      platforms: SUPPORTED_PLATFORMS,
      isEdit: true,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const b = req.body || {};
    const update = {
      serialNumber: b.serialNumber,
      name: b.name,
      productType: b.productType || PRODUCT_TYPE,
      typeCapacity: b.typeCapacity,
      platform: b.platform || 'other',
      description: b.description,
      addDate: b.addDate || undefined,
      buyer: {
        name: b.buyerName,
        phone: b.buyerPhone,
        email: b.buyerEmail,
        address: b.buyerAddress,
        paymentMethod: b.buyerPaymentMethod,
      },
      soldDate: b.soldDate || undefined,
    };
    const product = await Product.findByIdAndUpdate(id, update, { new: true });
    if (!product) {
      req.flash('error', { message: 'Product not found' });
      return res.redirect('/products');
    }

    req.flash('success', { message: 'Product updated' });
    res.redirect('/products');
  } catch (err) {
    next(err);
  }
});

// Admin API: Register/Update warranty (requires authentication) - Always returns JSON
router.post('/:id/warranty', upload.single('billFile'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { durationMonths = 12, notes, status = 'active' } = req.body;
    
    // Find product
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    let fileDoc = null;
    
    // Handle file upload if provided
    if (req.file) {
      fileDoc = await File.create({
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        fileType: 'warranty_bill',
        uploadedBy: req.user?.email || 'admin',
        productId: product._id,
        metadata: {
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent'),
          source: 'admin'
        }
      });
    }
    
    // Calculate warranty dates
    const registrationDate = new Date();
    const expiryDate = new Date(registrationDate);
    expiryDate.setMonth(expiryDate.getMonth() + parseInt(durationMonths));
    
    const isUpdate = product.warrantyRegistered;
    
    // Update or create warranty
    if (isUpdate) {
      // Preserve existing bill file if no new file uploaded
      if (!fileDoc && product.warranty && product.warranty.billFile) {
        fileDoc = { _id: product.warranty.billFile };
      }
      
      product.warranty = {
        ...product.warranty.toObject ? product.warranty.toObject() : product.warranty,
        registrationDate: product.warranty.registrationDate || registrationDate,
        expiryDate,
        durationMonths: parseInt(durationMonths),
        status,
        billFile: fileDoc ? fileDoc._id : product.warranty.billFile,
        registeredBy: product.warranty.registeredBy || req.user?.email || 'admin',
        registrationSource: product.warranty.registrationSource || 'admin',
        notes: notes || product.warranty.notes,
        lastModifiedBy: req.user?.email || 'admin',
        lastModifiedAt: new Date()
      };
    } else {
      product.warranty = {
        registrationDate,
        expiryDate,
        durationMonths: parseInt(durationMonths),
        status,
        billFile: fileDoc ? fileDoc._id : null,
        registeredBy: req.user?.email || 'admin',
        registrationSource: 'admin',
        notes
      };
      product.warrantyRegistered = true;
    }
    
    await product.save();

    
    // Always return JSON response
    return res.json({
      success: true,
      message: isUpdate ? 'Warranty updated successfully' : 'Warranty registered successfully',
      warranty: product.warranty
    });
  } catch (err) {
    console.error('Warranty registration error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Admin API: Update warranty status (void, expire, activate) - Always returns JSON
router.patch('/:id/warranty/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    if (!status || !['active', 'expired', 'void'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (active, expired, void)'
      });
    }
    
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    if (!product.warrantyRegistered) {
      return res.status(400).json({
        success: false,
        message: 'Warranty not registered for this product'
      });
    }
    
    product.warranty.status = status;
    product.warranty.lastModifiedBy = req.user?.email || 'admin';
    product.warranty.lastModifiedAt = new Date();
    if (notes) {
      product.warranty.notes = (product.warranty.notes || '') + '\n' + notes;
    }
    
    await product.save();
    
    // Always return JSON response
    return res.json({
      success: true,
      message: `Warranty status updated to ${status}`,
      warranty: product.warranty
    });
  } catch (err) {
    console.error('Warranty status update error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Admin API: Mark product as return - Always returns JSON
router.post('/:id/return', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { returnReason, returnNotes } = req.body;
    
    // Validate required fields
    if (!returnReason) {
      return res.status(400).json({
        success: false,
        message: 'Return reason is required'
      });
    }
    
    // Find the product
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Create return record with all product data
    const returnData = {
      // Copy all product fields
      serialNumber: product.serialNumber,
      name: product.name,
      productType: product.productType,
      typeCapacity: product.typeCapacity,
      platform: product.platform,
      description: product.description,
      addDate: product.addDate,
      buyer: product.buyer,
      soldDate: product.soldDate,
      warranty: product.warranty,
      warrantyRegistered: product.warrantyRegistered,
      
      // Return-specific fields
      returnDate: new Date(),
      returnReason,
      returnNotes: returnNotes || '',
      returnedBy: req.user?.email || 'admin',
      originalProductId: product._id,
      
      // Preserve original timestamps
      originalCreatedAt: product.createdAt,
      originalUpdatedAt: product.updatedAt
    };
    
    // Create the return record
    const returnRecord = await Return.create(returnData);
    
    // Delete the product from the products collection
    await Product.findByIdAndDelete(id);
    
    return res.json({
      success: true,
      message: 'Product successfully marked as return and moved to returns collection',
      returnId: returnRecord._id
    });
    
  } catch (err) {
    console.error('Mark return error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
