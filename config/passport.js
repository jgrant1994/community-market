var passport = require('passport');
//local login library
var LocalStrategy = require('passport-local').Strategy;
var User = require('../models/user');


//serialize and deserialize

//translate data into a format that can be stored in mongodb
passport.serializeUser(function(user,done) {
    done(null, user._id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err,user);
    });
});

//middleware
passport.use('local-login', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
}, function(req, email, password, done) { //validate username and password
    User.findOne({email: email}, function(err, user) {
        if(err) return done(err);

        //if user does not exist in db then alert
        if(!user) {
            return done(null, false, req.flash('loginMessage', 'No user has been found'));
        }
        //if password is wrong compared to saved password alert
        if(!user.comparePassword(password)) {
            return done(null, false, req.flash('loginMessage', 'Wrong Password'));
        }
        return done(null, user);
    });
}));


//custom function to validate
exports.isAuthenticated = function(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}