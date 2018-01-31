var express = require('express');
var router 	= express.Router();

var isAuthenticated = function (req, res, next) {
	//console.log("auth check main route");
	if (req.isAuthenticated())
		return next();
	res.redirect('/login');
}

module.exports = function(passport){
	/* GET Home Page */
	router.get('/', isAuthenticated, function(req, res){
		//console.log("rendering main");
		res.render('main');
		
	});
	
	
	
	// router.get('/', function(req, res){
		// console.log("rendering main");
		// res.render('main');
		
	// });
	
	
  return router;
}
