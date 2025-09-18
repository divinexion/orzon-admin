const mongoose = require('mongoose');
const saltedSha512 = require('salted-sha512');
const User = require('../models/user');
const config = require('../config');


(async () => {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('DB connected');
    if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) {
      console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in env');
      process.exit(1);
    }

    const exists = await User.countDocuments({ email: config.ADMIN_EMAIL });
    if (exists) {
      console.log('Admin user already exists');
      return process.exit(0);
    }
    await User.create({
      email: config.ADMIN_EMAIL.toLowerCase(),
      password: saltedSha512(config.ADMIN_PASSWORD, config.SALT_KEY),
      isActive: true,
      isDeleted: false,
    });
    console.log('Admin user created:', config.ADMIN_EMAIL);
    process.exit(0);
  } catch (err) {
    console.error('Init error:', err);
    process.exit(1);
  }
})();
