//required libraries
var express = require('express');
var morgan = require('morgan');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var ejs = require('ejs');
var engine = require('ejs-mate');
//store data into temporary memory storage
var session = require('express-session');
//take session data, encrypt it, pass it to browser
var cookieParser = require('cookie-parser');
var flash = require('express-flash');
//mongostore library depending on express-session
//mongostore is used to save session on server side
var MongoStore = require('connect-mongo/es5')(session);
//middleware authentication library
var passport = require('passport');

var secret = require('./config/secret');
var User = require('./models/user');
var Category = require('./models/category');

var cartLength = require('./middlewares/middlewares');
var app = express();

mongoose.connect(secret.database, function(err){
	mongoose.Promise = global.Promise;
	if (err){
		console.log(err);
	} else {
		console.log("Connection established to", secret.database);
	}

})

//Middleware
app.use(express.static(__dirname + '/public')); //public folder (css) is for static files
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
	//forces session to be saved to session storage
	resave: true,
	//forces session that was uninitialized to be saved to the memory storage. Session is unintialized when new but not initialized
	saveUninitialized: true,
	secret: secret.secretKey,
	store: new MongoStore({url: secret.database, autoReconnect: true})
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

//every route will have user object 
app.use(function(req, res, next) {
	res.locals.user = req.user;
	next();
});


app.use(cartLength)

app.use(function(req, res, next) {
	//find all categories
	Category.find({}, function(err, categories) {
		//if error return callback with error
		if(err) return next(err);
		//store list of categories in local variable called 'categories'
		res.locals.categories = categories;
		next();
	});
});

app.engine('ejs', engine);
app.set('view engine', 'ejs');


var mainRoutes = require('./routes/main');
var userRoutes = require('./routes/user');
var adminRoutes = require('./routes/admin');
var apiRoutes = require('./api/api');


app.use(mainRoutes);
app.use(userRoutes);
app.use(adminRoutes);
app.use('/api',apiRoutes);

app.listen(secret.port, function(err) {
	if (err) throw err;
	console.log("Server is Running on port " + secret.port);
});