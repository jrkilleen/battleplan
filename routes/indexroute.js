var express = require('express');
var router = express.Router();

module.exports = function(passport, mlogger){
 
	// /* GET login page. */
	// router.get('/', function(req, res) {
	// 	// Display the Login page with any flash message, if any
	// 	res.render('login', { message: req.flash('message') });
	// });

	/* Handle Login POST */
	router.get('/', 	

		passport.authenticate('login', {
		successRedirect: '/main',
		failureRedirect: '/login',
		// failureFlash : true 
	}));

  return router;
}