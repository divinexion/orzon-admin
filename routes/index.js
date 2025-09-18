const express = require('express');
const passport = require('passport');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/products');
  res.render('auth/login', { layout: 'auth', title: 'Login' });
});

router.post('/', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash('error', info?.message || 'Login failed');
      return res.redirect('/');
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
      return res.redirect('/products');
    });
  })(req, res, next);
});

router.get('/logout', function (req, res, next) {
  req.logout(); //passport logout method
  res.redirect('/');
});

router.get('/404', (req, res) => res.render('auth/404', { layout: 'auth', title: 'Not Found' }));
router.get('/500', (req, res) => res.render('auth/500', { layout: 'auth', title: 'Error' }));

module.exports = router;
