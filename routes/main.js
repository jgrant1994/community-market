var router = require('express').Router(); //add middleware and http method to express module
var User = require('../models/user');
var Product = require('../models/product');
var Cart = require('../models/cart')

var async = require('async');


var stripe = require('stripe') ('sk_test_enzQBX3nr7h8gvZABdOZ0zrr');

//creating a map between product database and elastic search replica set
Product.createMapping(function(err, mapping) {
	if(err){
		console.log("error creating mapping");
		console.log(err);
	}else{
		console.log("Mapping created");
		console.log(mapping);
	}
});

var stream = Product.synchronize();
var count = 0;

stream.on('data', function() {
	count++;
});

stream.on('close',function(){
	console.log("Indexed " + count + "documents");
});

//show user if there is an error while counting documents
stream.on('error', function(err) {
	console.log(err);
});

router.get('/cart',function(req, res, next) {
	Cart
	// search in cart data whether cart.user.id exists 
		.findOne({owner: req.user._id})
	//populate items image, name, etc.
		.populate('items.item')
	//if cart is found render page with foundCart data
		.exec(function(err, foundCart) {
			if(err) next(err);
			res.render('main/cart', {
				foundCart: foundCart,
				message: req.flash('remove')
			});
		});
});

router.post('/product/:product_id', function(req, res, next) {
	//find owner of cart
	Cart.findOne({ owner: req.user._id }, function(err, cart) {
		//if found push all the items to cart
		cart.items.push({
			item: req.body.product_id,
			price: parseFloat(req.body.priceValue),
			quantity: parseInt(req.body.quantity)
		});
		
		//parse value of req.body to float to save to database without any error
		cart.total = (cart.total + parseFloat(req.body.priceValue)).toFixed(2);

		cart.save(function(err) {
			if(err) return next(err);
			return res.redirect('/cart');
		});
	});
});

router.post('/remove', function(req,res,next) {
	Cart.findOne({owner: req.user._id }, function(err, foundCart) {
		foundCart.items.pull(String(req.body.item));

		//subtract total price of cart and products price
		foundCart.total = (foundCart.total - parseFloat(req.body.price)).toFixed(2);
		foundCart.save(function(err, found) {
			if (err) return next(err);
			req.flash('remove','Successfully removed item');
			res.redirect('/cart');
		});
	});
});

router.post('/search', function(req, res, next) {
	res.redirect('/search?q=' + req.body.q);
});

router.get('/search', function(req, res, next) {
	if (req.query.q) {
		Product.search({
			query_string: { query: req.query.q}
		}, function(err, results) {
			results:
			if(err) return next(err);
			var data = results.hits.hits.map(function(hit) {
				return hit;
			});
			res.render('main/search-result', {
				query: req.query.q,
				data: data
			});
		});
	}
});

router.get('/', function(req, res) {

	if (req.user) {
		var perPage = 9;
		var page = req.params.page;
		
		Product
		
			.find()
			.skip( perPage * page )
			.limit( perPage )
			.populate('category')
			.exec(function(err, products) {
				if(err) return next(err);
				Product.count().exec(function(err, count) {
					res.render('main/product-main', {
						products: products,
						pages: count / perPage
					});
				});
			});
	}else{
		res.render('main/home');	
	}
});

// router.get('/buy-main', function(req, res) {
// 	res.render('market/buy');
// });

router.get('/sell-main', function(req, res) {
	res.render('market/sell');
});

router.get('/products/:id', function(req, res, next){
	Product
		//query products for a product that contain the id
		.find({ category: req.params.id })
		.populate('category')
		.exec(function(err, products) {
			if(err) return next(err);
			res.render('main/category', {
				products: products
			});
		});
});


router.get('/product/:id', function(req, res, next) {
	Product.findById({ _id: req.params.id} ,function(err, product) {
		if(err) return next(err);
		res.render('main/product', {
			product: product
		});
	});
});


router.post('/payment', function(req, res, next) {

  var stripeToken = req.body.stripeToken;
  var currentCharges = Math.round(req.body.stripeMoney * 100);
  stripe.customers.create({
    source: stripeToken,
  }).then(function(customer) {
    return stripe.charges.create({
      amount: currentCharges,
      currency: 'usd',
      customer: customer.id
    });
  }).then(function(charge) {
    async.waterfall([
      function(callback) {
        Cart.findOne({ owner: req.user._id }, function(err, cart) {
          callback(err, cart);
        });
      },
      function(cart, callback) {
        User.findOne({ _id: req.user._id }, function(err, user) {
          if (user) {
            for (var i = 0; i < cart.items.length; i++) {
              user.history.push({
                item: cart.items[i].item,
                paid: cart.items[i].price
              });
            }

            user.save(function(err, user) {
              if (err) return next(err);
              callback(err, user);
            });
          }
        });
      },
      function(user) {
        Cart.update({ owner: user._id }, { $set: { items: [], total: 0 }}, function(err, updated) {
          if (updated) {
            res.redirect('/profile');
          }
        });
      }
    ]);
  });


});
//export home and products route for server.js use
module.exports = router;