const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const saltedSha512 = require('salted-sha512');
const { SALT_KEY } = require('../config');
const User = require('../models/user');

function passportInit(app) {
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password', passReqToCallback: true },
      async function (req, email, password, done) {
        try {
          const user = await User.findOne({
            email: email.toLowerCase(),
            password: saltedSha512(password, SALT_KEY),
            isDeleted: false,
          }).lean();
          if (!user) return done(null, false, { message: 'Invalid email or password' });
          if (user.isActive === false) return done(null, false, { message: 'User disabled' });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user._id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).lean();
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}

function checkAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.flash('error', { message: 'Please login to continue' });
  res.redirect('/');
}

module.exports = { passportInit, checkAuth };
