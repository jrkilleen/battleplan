var express 		= require('express');
var router			= express.Router();
var validator 		= require('validator');
var bodyParser 		= require('body-parser')
var iptables 		= require('iptables');
var validator 		= require('validator');
var express 		= require('express');
var ExpressBrute	= require('express-brute');
var RedisStore 		= require('express-brute-redis');


module.exports = function(passport, fslogger){

    var store = new RedisStore({
        host: '127.0.0.1',
        port: 6379
    });

    var failCallback = function (req, res, next, nextValidRequestDate) {

        var address = req.connection.remoteAddress;
        address = address.substring(7, address.length);
        console.log("possible BFA detected by " + address);
        fslogger.log("possible BFA by " + address);
        fslogger.log("blocking " + address);
        iptables.drop({
            protocol : 'tcp',
            dport: 80,
            src: address,
            sudo : true
        });
        iptables.drop({
            protocol : 'tcp',
            dport: 443,
            src: address,
            sudo : true
        });

    }

    var loginbruteforce = new ExpressBrute(store, {
        freeRetries: 10,
        attachResetToRequest: false,
        refreshTimeoutOnRequest: false,
        minWait: 25*60*60*1000, // 1 day 1 hour (should never reach this wait time)
        maxWait: 25*60*60*1000, // 1 day 1 hour (should never reach this wait time)
        lifetime: 24*60*60, // 1 day (seconds not milliseconds)
        failCallback: failCallback,
        // handleStoreError: handleStoreError
    });

    var isAuthenticated = function (req, res, next) {
        if (req.isAuthenticated())
            return next();
        res.render('login', { title: 'Login' });
    }





	router.get('/', isAuthenticated, function(req, res){
		res.redirect('/main');
	});

	router.post('/',loginbruteforce.prevent, function(req, res, next) {

		//router.post('/', function(req, res, next) {
		console.log('login post received');
		passport.authenticate('login', function(err, user, username) {
			console.log('passport authentication function');
			if (err) { 
			console.log("error1");
			return next(err); }
			if  (!user){
				
				return res.send("Error: Invalid");
				
				//return res.redirect('/');
			}else{
				console.log("user: " + username + " has connected and authenticated");
				//req.session.username = "pingas";
				req.login({user, username}, function(err) {
					//if (err) { return next(err); }
					console.log('login successful');
					//res.send("Valid");
					return res.send("login successful");
					//return res.redirect('/main');
				});
			}

		})(req, res, next);
	});
  return router;
}



 	
