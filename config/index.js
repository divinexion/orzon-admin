const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3100,
  MONGODB_URI: process.env.MONGODB_URI,
  SALT_KEY: process.env.SALT_KEY || 'change-me',

  PRODUCT_TYPE: process.env.PRODUCT_TYPE || 'Disk',
  TYPE_CAPACITIES: (process.env.TYPE_CAPACITIES || '320,512,1024')
    .split(',')
    .map((v) => v.trim()),
  
  SUPPORTED_PLATFORMS: (process.env.SUPPORTED_PLATFORMS || 'amazon,flipkart,myntra,snapdeal,paytm,offline,other')
    .split(',')
    .map((v) => v.trim().toLowerCase()),

  EXCEL_LOG_FILE: path.resolve(process.cwd(), process.env.EXCEL_LOG_FILE || './files/products.xlsx'),
  EXCEL_LOG_SHEET: process.env.EXCEL_LOG_SHEET || 'ProductsLog',

  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
};
