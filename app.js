const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const exphbs = require('express-handlebars');
const session = require('express-session');
const flash = require('connect-flash');
const cookieSession = require('cookie-session');
const mongoose = require('mongoose');
const cors = require('cors');

const config = require('./config');
const { passportInit, checkAuth } = require('./helpers/auth');
const hbsHelpers = require('./helpers/handlebars');

// Ensure directories
for (const dir of ['logs', 'files']) {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// Connect to MongoDB
mongoose.set('strictQuery', true);
mongoose
  .connect(config.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

require('./models');

const app = express();

// CORS Configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://orzon.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Sessions
app.use(cookieSession({ secret: 'session', key: 'productInventoryKey' }));
app.use(
  session({
    secret: 'productInventorySecret',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);
app.use(flash());
app.use(cookieParser());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Static
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(logger('dev'));

// View engine
const hbs = exphbs.create(hbsHelpers);
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Passport
passportInit(app);

// Expose flash to views
app.use((req, res, next) => {
  res.locals.flash = req.flash();
  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/api', require('./routes/api'));
app.use('/warranty', require('./routes/warranty')); // Public warranty routes with rate limiting
app.use(checkAuth);
app.use('/products', require('./routes/products'));
app.use('/queries', require('./routes/queries'));
app.use('/stats', require('./routes/stats'));

// 404
app.use((req, res) => {
  res.status(404).render('auth/404', { layout: 'auth', title: 'Not Found' });
});

// Error
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('auth/500', { layout: 'auth', title: 'Error' });
});

module.exports = app;
