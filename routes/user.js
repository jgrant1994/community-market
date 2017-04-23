var router = require('express').Router(); //add middleware and http method to express module
var User = require('../models/user'); //require user.js model containing user schema attributes and functions
var Cart = require('../models/cart');
var async = require('async');
var passport = require('passport'); //require passport authentication middleware for login and signup page
var passportConf = require('../config/passport'); //require passport configuration file that specify authentication strategy and the application middleware


router.get('/login', function(req, res) {
    if(req.user) return res.redirect('/');
    res.render('accounts/login', {message: req.flash('loginMessage')});
});


//authenticate using local-login strategy which uses username( email ) and password
//specify success and failure authentication routes
//flash message if authentication failed
router.post('/login', passport.authenticate('local-login', {
    //if authenticated redirect to home page
    successRedirect: '/profile',
    //if failed authenication redirect back to login page
    failureRedirect: '/login',
    //enable req.flash message in passport.js
    failureFlash: true
}));

//if user is logged in go to profile page, if not logged in then go to login page
router.get('/profile', passportConf.isAuthenticated, function(req, res, next) {
    User
        .findOne({_id: req.user._id})
        .populate('history.item')
        .exec(function(err, foundUser) {
            if(err) return next(err);
            res.render('accounts/profile', { user: foundUser });
        });
});


//http method GET for when a user enter /signup in url
//render the signup page and if error flash
router.get('/signup', function(req, res, next) {
    res.render('accounts/signup', {
        errors: req.flash('errors')
    });
});

//http method POST for when user is pushing data to database
//create new user and get information from html form and save to user schema
router.post('/signup', function(req, res) {
	
    async.waterfall([
        function(callback) {
            var user = new User();

            user.profile.name = req.body.name;
            user.profile.school = req.body.school;
            user.password = req.body.password;
            user.email = req.body.email;
            user.profile.picture = user.gravatar();

        //mongoose method to find one document in user database
            User.findOne({ email: req.body.email }, function(err, existingUser){
                
                if(existingUser) {
                    //if email already exists then redirect to signup page with error object
                    req.flash('errors', 'Account with that email address already exists');
                    return res.redirect('/signup');
                } else {
                    user.save(function(err,user) {
                        if(err) return next(err);
                        callback(null, user);                
                    });
                }
            });
        },

        function(user) {
            var cart = new Cart();
            cart.owner = user._id;
            cart.save(function(err) {
                if(err) return next(err);
                req.logIn(user, function(err) {
                    if(err) return next(err);
                    res.redirect("/profile");
                });
            });
        }
    ]);
});

router.get('/logout', function(req, res, next) {
    req.logout();
    res.redirect('/login');
});


router.get('/edit-profile', function(req, res, next) {
    res.render('accounts/edit-profile',{ message: req.flash('success')});
});

router.post('/edit-profile', function(req, res, next) {
    //find user with id of currently logged in user
    User.findOne({_id: req.user._id}, function(err, user) {

        if(err) return next(err);
        //if you are inputting name or school then update in database
        if(req.body.name) user.profile.name = req.body.name;
        if(req.body.school) user.profile.school = req.body.school;

        user.save(function(err){
            if(err) return next(err);
            req.flash('success','Successfully edited your profile');
            return res.redirect('/edit-profile');
        });
    });
});

//export /signup route and /login for server.js use
module.exports = router;