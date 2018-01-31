// it is recommended that all imports be installed using https://www.npmjs.com/package/npm-install-all

// Imports
var express 		= require('express');
var path 			= require('path');
var favicon 		= require('serve-favicon');
var morgan 			= require('morgan');
var cookieParser 	= require('cookie-parser');
var cookie 			= require('cookie');
var bodyParser 		= require('body-parser');
var mysql 			= require('mysql');
var validator 		= require('validator');
var passport 		= require('passport');
var session 		= require('express-session');
var LocalStrategy 	= require('passport-local').Strategy;
var ExpressBrute 	= require('express-brute');
var RedisStore 		= require('express-brute-redis');
var app 			= require("express")();
var http			= require('http');
var https 			= require('https');
var clear 			= require('clear');	
var MySQLStore 		= require('express-mysql-session')(session);
var moment 			= require('moment');
var iptables 		= require('iptables');
var WebSocket 		= require('ws');
var fs 				= require('fs');
var httpApp 		= express();
var forceSsl 		= require('express-force-ssl');
var rfs    			= require('rotating-file-stream');
var redis 			= require("redis");

// GLOBAL ENTITIES
var stream,
	pool,
	sessionStore,
	sess,
	store,
	fslogger,
	logger;

// STATIC GLOBAL ENTITIES
var DRIPLIMIT = 500,
	USERMARKERLIMIT = 50,
	NOTESIZELIMIT = 400,
	TITLESIZELIMIT = 64,
	USERNAMESIZELIMIT = 64,
	PASSWORDSIZELIMIT = 64,
	MAXLATLNG = 40000,
	MAXTYPE = 42,
	HTTPSMODE = false,
	DRAININTERVAL = 10000,	
	HTTPPORT = 80,
	HTTPSPORT = 443,
	MAXNOTESIZE = 500,
	MAXTITLESIZE = 64,
	MAXUSERNAMESIZE = 64,
	MAXPASSWORDSIZE = 64,
	MAXFAILEDLOGINATTEMPTS = 30,
	MAPBOUNDS = 40000;

var key, cert, ca, ssloptions, httpsServer, httpServer, wss;
	
// mysql credentials
var mysqlu = "someusername";
var mysqlp = "somepassword";
var dbname = 'somedatabase';
var secretphrase = 'somephrase';

// ssl file paths
var certfp = "encryption/somechain.pem";
var keyfp = "encryption/somekey.pem";

// controls how close markers can be placed on the map
var bufferdistance = 1;

// mysql options used when adding markers
var options = {
	host: 'localhost',
	port: 3306,
	user: mysqlu,
	password: mysqlp,
	database: dbname,
	// How frequently expired sessions will be cleared; milliseconds:
	checkExpirationInterval: 60000,
	// The maximum age of a valid session; milliseconds:
	expiration: 86400000,
	// Whether or not to create the sessions database table, if one does not already exist:
	createDatabaseTable: true,
	// Whether or not to end the database connection when the store is closed:
	endConnectionOnClose: true,
	schema: {
		tableName: 'sessions',
		columnNames: {
			session_id: 'session_id',
			expires: 'expires',
			data: 'data'
		}
	}
};

var mysqlconfig = {
    host: 'localhost',
    user: mysqlu,
    password: mysqlp,
    database: dbname
};

var fsoptions ={
	size: '100M',
	maxFiles: 1,
    path: "logs"
	//compress: 'gzip' // compress rotated files
}

class filesystemlogger {
    constructor(stream) {
        this.stream = stream;
    }
   log(message){
		this.stream.write((new Date) + " : " + message + "\n");
   }

}
stream = rfs('access.log', fsoptions);

fslogger = new filesystemlogger(stream);


// FUNCTIONS

// formats a passed date, probably going to remove
function formatDate(date) {
  return moment(date).format('HH:mm:ss - MM/DD/YY');
}

// handles sql queries and connection errors that can occur
function queryWrapper(strquery, data, callback){		
	pool.getConnection(function(err, connection) {				
		if (!err){
			// Use the connection
			connection.query(strquery, data, function (error, results, fields) {				
				// handle any issue executing the query
				if(!error){																																
					// release connection regardless of results
					connection.release();
					// Handle error after the release.
					if (error) throw error;

					// Don't use the connection here, it has been returned to the pool.
					
					// check if query contains any results that have a matching username				
					return callback(error, results, fields, data);									
				}else{
					// ERROR
					console.log("error executing query: " + strquery);
					// release connection
					connection.release();
					if (error) throw error;			
					return callback(null);
				}
			});
		}else{			
			// ERROR
			console.log("error getting connection from pool");
			
			// release connection
			connection.release();
			// Handle error after the release.
			if (error) throw error;			
			return callback(null);
		}
	});
}

// decrements a users drip
function drainsession(username){
	var drainquery = "UPDATE `users`  SET drip = drip + 1 WHERE username = " + pool.escape(username) + " AND drip < 100";
	
	queryWrapper(drainquery, "data", function(error, results, fields, data){	
		if(!error){
			console.log('draining: ' + username);
		}						
	});	
	
}

// decrements all user drips, periodically called
function drainAll() {
    var drainquery = "UPDATE `users`  SET drip = drip - 1 WHERE drip > 0";
    queryWrapper(drainquery, 'data', function(error, results, fields, data){
        if(!error){
            //console.log('draining all buckets');
        }
    });
}

// increments a users drip, called anytime a user interacts with the server
function fillsession(username){
	var fillquery = "UPDATE `users`  SET drip = drip + 1 WHERE username = " + pool.escape(username) + " AND drip < 100";
	console.log(fillquery);
	queryWrapper(fillquery, "data", function(error, results, fields, data){	
		if(!error){
			console.log('filling: '+ username);
		}						
	});	
	
}

// increments the user drip corresponding to the connected socket and checks to see if it overflows
// if the users drip overflows, the user is disconnected and blocked from interacting with the server
function checkbucket(data){
	//var username = JSON.stringify(socket.request.user.username);
	//username = username.substring(1, username.length - 1);
	var username = data.req.session.passport.user.username;
	var checkbucketquery = "SELECT * FROM users WHERE username = " + pool.escape(username) + ";";
	console.log(checkbucketquery);
	queryWrapper(checkbucketquery, data, function(error, results, fields, data){	
		if(!error){
			if(results){
				if (results.length > 0) {
					if (results){
						if (results[0].drip < DRIPLIMIT) {
							// correct password 
							console.log("success");
							//return done(null, true, username);
							fillsession(username);
							
						} else {
							// incorrect password
							console.log("fail");
														
							// var address = socket.request.connection.remoteAddress;
							var address = data.ws._socket.remoteAddress;
							address = address.substring(7, address.length);

							console.log(address);

                            fslogger.log("unauthorized socket transfer attempt by " + address);
                            fslogger.log("blocking " + address);

							if(HTTPSMODE){
								iptables.drop({
									protocol : 'tcp',
									dport: HTTPSPORT,
									src: address,
									sudo : true
								});
							}
							
							iptables.drop({
								protocol : 'tcp',
								dport: HTTPPORT,
								src: address,
								sudo : true
							});
							data.ws.terminate();
							
							//return done(null, false);
						}
					}
				}else{
					console.log("no users found with username: " + username);
					//return done(null, false);
				}	
			}else{
				//return callback(null);
			}					
		}						
	});			
}	

function incuserfailedlogin(username, cb){
	var incfliQuery = "UPDATE users SET failedloginattempts = failedloginattempts + 1 WHERE username = " + pool.escape(username) + " and failedloginattempts < " + MAXFAILEDLOGINATTEMPTS + ";";
	queryWrapper(incfliQuery, null, function(error, results, fields, data){	
		if(!error){
			console.log("INC failedlogin: " + username);
			cb(null, true);						
		}else{
			cb(error);
		}				
	});	
}

function incusermarkercount(username, cb){
	var incumcQuery = "UPDATE users SET markercount = markercount + 1 WHERE username = " + pool.escape(username) + " and markercount < " + USERMARKERLIMIT + ";";
	queryWrapper(incumcQuery, null, function(error, results, fields, data){	
		if(!error){
			console.log("INC markercount: " + username);
			cb(null, true);						
		}else{
			cb(error);
		}				
	});	
}

function deccusermarkercount(username, cb){
	var decumcQuery = "UPDATE users SET markercount = markercount - 1 WHERE username = " + pool.escape(username) + " and markercount > 0;";

	queryWrapper(decumcQuery, null, function(error, results, fields, data){	
		if(!error){
			console.log("DEC markercount: " + username);
			cb(null, true);						
		}else{
			cb(error);
		}				
	});	
}

function hasproperties(propertieslist, data){
	for (var i = 0, len = propertieslist.length; i < len; i++) {
		if(data.hasOwnProperty(propertieslist[i]) == false) {
			console.log("property not found: " + propertieslist[i]);
			return false;
		}
	}
	return true;
}

function isString(list){	
	for (var i = 0, len = list.length; i < len; i++) {
		if(typeof(list[i]) != 'string') {
			console.log("item in list is not a string: " + list[i]);
			return false;
		}
	}
	return true;
}

function isInt(list){
	for (var i = 0, len = list.length; i < len; i++) {
		if(validator.isInt(list[i]) == false) {
			console.log("item in list is not numeric: " + list[i]);
			return false;
		}
	}
	return true;
}

function inMapBounds(coordinate, bounds){
	if(coordinate.lng < MAXLATLNG &&
	coordinate.lat < MAXLATLNG &&
	coordinate.lng > -MAXLATLNG &&
	coordinate.lat > -MAXLATLNG){
			return true;
	}else{
		return false;
	}
}

// checks whether a request is made by an authenticated user
var isAuthenticated = function (req, res, next) {
	if (req.isAuthenticated())
		return next();
	fslogger.log("unauthorized file access attempt from " + req.connection.remoteAddress);
}

function isvalidmarker(data){
	return (
		data != 'undefined' &&
		hasproperties(['lat','lng','title','notes','type','id'],data) &&
		isString([data.lat,data.lng,data.id,data.type,data.title,data.notes]) &&	
		isInt([data.lat,data.lng,data.id,data.type]) &&            
		inMapBounds({lat: data.lat, lng: data.lng}, MAPBOUNDS)&&
		data.title.length < TITLESIZELIMIT &&
		data.notes.length < NOTESIZELIMIT &&
		data.type < MAXTYPE
	);
}

// Initialize server
// clear(); // clears terminal



fslogger.log("Server starting up");

logger = morgan('common', {stream: stream});

sessionStore = new MySQLStore(options);

sess = session({
	key: 'express.sid',
	store: sessionStore,
	secret: secretphrase,
	saveUninitialized: false,
	resave: false
});

// MYSQL pool used by for connected client requests
pool = mysql.createPool({
	connectionLimit	: 	5,
	host			: 	'localhost',
	user			: 	mysqlu,
	password		: 	mysqlp,
	database		: 	dbname,
	table			: 	'markers',
	debug			:	false
});

pool.on('acquire', function (connection) {
	//console.log('Connection %d acquired', connection.threadId);
    //fslogger.log("Connection " + connection.threadId + " acquired");
});

pool.on('enqueue', function () {
	//console.log('Waiting for available connection slot');
	fslogger.log('Waiting for available connection slot');
});

pool.on('release', function (connection) {
	// fslogger.log("Connection " + connection.threadId + " released");
	//console.log('Connection %d released', connection.threadId);
});

// clear mysql session stores
var connection = mysql.createConnection(mysqlconfig);
connection.query("use " + dbname);
var strQuery = "DELETE FROM sessions;";
connection.query(strQuery, function (err, rows) {});

// Redis store
store = new RedisStore({
	host: '127.0.0.1',
	port: 6379
});

// flushes all current redis entries
var client = redis.createClient();
client.flushall(function (err, succeeded) {
	//console.log(succeeded); // will be true if successfull
});


if(HTTPSMODE){
    key = fs.readFileSync(keyfp);
    cert = fs.readFileSync(certfp);
	
    ssloptions = {
        key: key,
        cert: cert
    };
    httpsServer = https.createServer(ssloptions, app);
    httpsServer.listen(HTTPSPORT);

    // redirect http request to https
    httpApp.set('port', process.env.PORT || HTTPPORT);
    httpApp.get("*", function (req, res, next) {
        res.redirect("https://" + req.headers.host + "/");
    });
	
    httpServer = http.Server(httpApp);

    // Initialize ws server
    wss = new WebSocket.Server({
        maxPayload: 1024,
        server: httpsServer,
        autoAcceptConnections: false,
        verifyClient: function(info, done){
            console.log("someone is attempting to connect");
			
            var sid = cookieParser.signedCookie(cookie.parse(info.req.headers.cookie)['express.sid'], secretphrase);
            var userQuery = "SELECT * FROM sessions WHERE session_id LIKE " + pool.escape(sid) + ";";
            console.log(userQuery);
            var data = {sid:sid, info:info};
            queryWrapper(userQuery, data, function(error, results, fields, data){
                if(!error){
                    if(results){
                        if (results.length > 0) {
                            console.log("web socket established: " + data.sid);
                            sess(info.req, {}, function(){
                                done(data.info.req.session)
                            });
                        }else{
                            console.log("attempted unauthed WS");
                            done(false, 401, 'Unauthorized');
                        }
                    }else{
                        console.log("attempted unauthed WS");
                        done(false, 401, 'Unauthorized');
                    }
                }
            });
        }
    });



}else{

    httpServer = http.Server(app);
	
    httpServer.listen(HTTPPORT, function () {
        console.log("Listening on "+HTTPPORT);

    });

    // Initialize ws server
    wss = new WebSocket.Server({
        maxPayload: 1024,
        server: httpServer,
        autoAcceptConnections: false,
        verifyClient: function(info, done){
            console.log("websocket connection initiated");
            fslogger.log("ws connection attempt from " + info.req.connection.remoteAddress);
            var sid = cookieParser.signedCookie(cookie.parse(info.req.headers.cookie)['express.sid'], secretphrase);
            var userQuery = "SELECT * FROM sessions WHERE session_id = " + pool.escape(sid) + ";";
            console.log(userQuery);
            var data = {sid:sid, info:info};
            queryWrapper(userQuery, data, function(error, results, fields, data){
                if(!error){
                    if(results){
                        if (results.length > 0) {
                            console.log("web socket established: " + data.sid);
                            sess(info.req, {}, function(){
                                done(data.info.req.session)
                            });
                        }else{
                            console.log("attempted unauthed WS");
                            fslogger.log("attempted unauthed WS" + data.info.req.connection.remoteAddress);
                            done(false, 401, 'Unauthorized');
                        }
                    }else{
                        console.log("attempted unauthed WS");
                        fslogger.log("attempted unauthed WS" + data.info.req.connection.remoteAddress);
                        done(false, 401, 'Unauthorized');
                    }
                }
            });
        }
    });
}

wss.broadcast = function broadcast(data) {
	wss.clients.forEach(function each(client) {
		if (client.readyState === WebSocket.OPEN) {
			client.send(data);
		}
	});
};

wss.on('connection', function(ws, req) {
	
    var sid = cookieParser.signedCookie(cookie.parse(req.headers.cookie)['express.sid'], secretphrase);
    console.log("SID: " + sid);	
	console.log("IP: " + ws._socket.remoteAddress);
	console.log(req.session.passport.user.username);
	
	var connectionreq = ws._socket.remoteAddress + " - " + req.session.passport.user + " - " + sid + '\n';
	fslogger.log(connectionreq);
		
	ws.on('error', function error(err){
		console.log(err);		
	});
	
    ws.on('message', function incoming(message) {

    	if(typeof(message) != 'undefined'&& message.length > 0){
            fslogger.log("ws message received from user "+req.session.passport.user.username+ " at ip " +ws._socket.remoteAddress+" : " + message );
    		// get the sid from the request
    		var sid;
    		try{
                sid = cookieParser.signedCookie(cookie.parse(req.headers.cookie)['express.sid'], secretphrase);
                console.log("MESSAGE: " + message);
                console.log("SIZE: " + message.length);
                console.log("SID: " + sid);
				
				var messreq = ws._socket.remoteAddress + " - " + req.session.passport.user.username + " - " + sid + '\n';
				fslogger.log(messreq);
			}catch(e){
    			console.log(e);
			}

			// parse the message into a json object
            var msg;
            try {
                msg = JSON.parse(message);
            } catch (err) {
                console.log(err);
                ws.send("failed to processes message");
            }

            if(typeof(sid) != 'undefined' &&
                typeof(msg) != 'undefined' &&
                (msg.hasOwnProperty('cmd'))
            ) {
                var data = {
                    ws: ws,
                    msg: msg,
                    req: req
                }

                var userQuery = "SELECT * FROM sessions WHERE session_id = " + pool.escape(sid) + ";";
                console.log(userQuery);
                queryWrapper(userQuery, data, function (error, results, fields, data) {
                    if (!error) {
                        if (results) {
                            if (results.length > 0) {
                                console.log("message manually validated");
                                console.log("RESULTS: " + JSON.stringify(results[0]));
                                checkbucket(data);
                                data.msg.user = data.req.session.passport.user.username;

                                switch (data.msg.cmd) {
                                    case 'addmarker': {
                                        wsaddmarker(data.msg, function (error, marker) {
							
                                            if (error){
                                                console.log(error);
                                                ws.send("failed to add marker");
                                            } else {
                                                //console.log(marker);
											
                                                var sdata = {
                                                    cmd: 'addmarker',
                                                    marker: marker
                                                }
                                                wss.broadcast(JSON.stringify(sdata));
                                            }
                                        });
                                        break;
                                    }

                                    case 'editmarker': {
                                        wseditmarker(data.msg, function (error, marker) {
                                            if (error) {
                                                console.log(error);
                                                ws.send("failed to edit marker");
                                            } else {
                                                console.log("editing marker");
                                                var sdata = {
                                                    cmd: 'editmarker',
                                                    marker: marker
                                                }
                                                wss.broadcast(JSON.stringify(sdata));
                                            }
                                        });
                                        break;
                                    }

                                    case 'removemarker': {
                                        wsremovemarker(data.msg, function (error, id) {
                                            if (error) {
                                                console.log(error);
                                                ws.send("failed to remove marker");
                                            } else {
                                                console.log("marker removed: " + id);
                                                var sdata = {
                                                    cmd: 'removemarker',
                                                    id: id
                                                }
                                                wss.broadcast(JSON.stringify(sdata));
                                            }
                                        });
                                        break;
                                    }

                                    case 'mapupdate': {
                                        wsmapupdate(data.ws, function (error, id) {
                                            if (error) {
                                                console.log(error);
                                                data.ws.send("failed to initiate map upate");
                                            } else {
                                                console.log("finished map update");

                                            }
                                        });
                                        break;
                                    }

                                    case 'userupdate': {

                                        break;
                                    }

                                    default: {
                                        // invalid command
                                        console.log("invalid command");
                                    }

                                }
                            } else {
                                console.log("attempted unauthed WS");
                                ws.terminate();
                            }
                        } else {
                            console.log("attempted unauthed WS");
                            ws.terminate();
                        }
                    }
                });

            } else {
                console.log("initial validation failed");
            }
        }
	});
});


function wseditmarker(idata, cb){
    var data = idata.marker;
	data.user = idata.user;	
	if(isvalidmarker(data)){	
		var editmarkerQuery = "UPDATE `markers` SET `type` = '" + data.type + "', `x` = '" + data.lng + "', `y` = '" + data.lat + "', `notes` = " + pool.escape(data.notes) + ", `title` = " + pool.escape(data.title) + " WHERE `markers`.`id` ='" + data.id + "';";
		console.log(editmarkerQuery);
		queryWrapper(editmarkerQuery, data, function(error, results, fields, data){
			var getmarkerQuery = "SELECT * FROM `markers` WHERE id = '" + data.id + "';";
			console.log(getmarkerQuery);
			if(!error){
				queryWrapper(getmarkerQuery, data, function(error, results, fields, data){
					console.log(results);
					if(!error && results.length > 0){
						data.datelastupdated = formatDate(results[0].datelastedited);
						data._userlastedited = data.user;
						cb(null, data);
					}else{
						//fail
						cb(error);
					}	
				});	
			}else{
				//fail
				cb(error);
			}
		});
	}else{          
		cb("data validation failure");
	}

}

function wsremovemarker(data, cb){

    if(typeof data != 'undefined' && (data.hasOwnProperty('id')) && (typeof(data.id) == 'string') && validator.isInt(data.id)){      
		var getmarkeridQuery = "SELECT * FROM `markers` WHERE `id` = '" + data.id + "';";
        console.log(getmarkeridQuery);
		queryWrapper(getmarkeridQuery, data, function(error, results, fields, data){
            if(!error){
                if(results && results.length > 0){
                   var deletemarkerQuery = "DELETE FROM `markers` WHERE `id` = " + data.id + ";";
                    var data = results[0];
					console.log(deletemarkerQuery);
                    queryWrapper(deletemarkerQuery, data, function(error, results, fields, data){
						deccusermarkercount(data.submittinguser, function(){
							if(!error){
								console.log('sending removemarker request');
								cb(null, data.id);
							}else{
								//fail
								cb(error);
							}
						});
                        
                    });
                }
            }else{
                //fail
				cb(error);
            }
        });
    }else{
    	cb("data validation failure");
        //console.log('failed to send removemarker request');
    }
}

function wsaddmarker(idata, cb){
    //console.log(JSON.stringify(data));
	var data = idata.marker;

	data.user = idata.user;
	data.id = '0';

	if(isvalidmarker(data)){
        //console.log("data received" + data);
        //console.log("attempting to add marker at coordinates " + data.lng + "," + data.lat + " with title " + data.title + 'from: '+  JSON.stringify(socket.request.user));
		var getusermarkercountquery = "SELECT * FROM users WHERE `username` = " + pool.escape(data.user)+" AND `markercount` < 50;";
        console.log(getusermarkercountquery);
		queryWrapper(getusermarkercountquery, data, function(error, results, fields, data){
			console.log(results[0]);
			if(!error && results && results.length > 0 && results[0]){	
				var distanceQuery = "SELECT id, title, SQRT(POWER((markers.x-" + data.lng + "),2)+POWER((markers.y-" + data.lat + "),2)) AS distance FROM markers HAVING distance < " + bufferdistance + " ORDER BY distance LIMIT 10";
				console.log(distanceQuery);
				queryWrapper(distanceQuery, data, function(error, results, fields, data){
					if(!error){
						if(results){
							if(results.length == 0){
								// can add marker there
								var addmarkerQuery = "INSERT INTO `markers` (`submittinguser`, `type`, `x`, `y`, `notes`, `title`) VALUES (" + pool.escape(data.user) + ", '" + data.type + "', '" + data.lng + "', '" + data.lat + "', "+ pool.escape(data.notes) +", " + pool.escape(data.title) + ");";
								console.log(addmarkerQuery);
								queryWrapper(addmarkerQuery, data, function(error, results, fields, data){
									var getmarkeridQuery = "SELECT * FROM `markers` WHERE `title` = " + pool.escape(data.title) + " AND `x` = '" + data.lng + "' AND `y` = '" + data.lat + "';	";
									console.log(getmarkeridQuery);
									queryWrapper(getmarkeridQuery, data, function(error, results, fields, data){
										if(!error){
											
											if(results){
												incusermarkercount(results[0].submittinguser, function(err){
													if(!err){
														//console.log(JSON.stringify(results[0]));
														responsedata = {
															lng: data.lng,
															lat: data.lat,
															title: data.title,
															type: data.type,
															id: results[0].id,
															usersubmittedby:results[0].submittinguser,
															// dateposted:moment(results[0].dateadded, 'MM/DD/YYYY').format(),
															// datelastupdated:moment(results[0].datelastedited, 'MM/DD/YYYY').format()
															dateposted: formatDate(results[0].dateadded),
															datelastupdated: formatDate(results[0].datelastedited),
															notes: results[0].notes
														}
														console.log("ADDING MARKER");
														
														cb(null, responsedata);
													}else{
														cb(err);
													}
												});
											}
										}else{
											console.log(error);
	
											//data.ws.send('failure');
											cb(error);

										}
									});
								});
							}else{
								// cannot add marker there
								console.log("marker at coordinates " + data.lng + "," + data.lat + " with title " + data.title + " is too close to an existing marker");
								console.log(results);
								cb(error);
							}
						}
					}else{
						//console.log('failed to add marker');
						cb(error);
					}
				});	
			}else{
				console.log("USER REACHED MAX MARKER CAP");
				cb("max marker cap reached");
			}
        });
    }else{
        //console.log('failed to add marker');
        cb("data validation error");
    }
};

function wsmapupdate(ws){
	//console.log('received socket io request for a map update: '+ socket.request.user);
	//console.log(socket.request.user.username);
	
	var getallmarkersQuery = "SELECT * FROM markers;";
	console.log(getallmarkersQuery);
	var data = ws;
	queryWrapper(getallmarkersQuery, data, function(error, results, fields, data){	
		if(!error){
			if(results){
				if (results.length > 0) {
					//success
					for (var i = 0, len = results.length; i < len; i++) {
						var marker = {
							lat: results[i].y,
							lng: results[i].x,
							title: results[i].title,
							id: results[i].id,
							type: results[i].type,
							usersubmittedby: results[i].submittinguser,
							// dateposted: moment(results[i].dateadded, 'MM/DD/YYYY').format(),
							// datelastupdated: moment(results[i].datelastedited, 'MM/DD/YYYY').format()
							dateposted: formatDate(results[i].dateadded),
							datelastupdated: formatDate(results[i].datelastedited),
							notes: results[i].notes
						}
						var sdata = {
							cmd: 'addmarker',
							marker:marker
						}
						//console.log("ID" + results[i].id);

						ws.send(JSON.stringify(sdata));
					}
				}else{
					console.log("no markers present");				
				}	
			}else{
				//fail
				console.log("failure");
			}					
		}						
	});	
}
	
// all user drips will be drained at the interval below
setInterval(drainAll, DRAININTERVAL);

// log all requests to access.log
app.use(logger);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));
app.use(sess);	

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
		extended: false
	}));
app.use(cookieParser());

if(HTTPSMODE){
	app.use(forceSsl);
}

// nonauthenticated paths
app.use('/javascripts/login.js', express.static(path.join(__dirname, 'public/javascripts/login.js')));
app.use('/javascripts/jquery.min.js', express.static(path.join(__dirname, 'public/javascripts/jquery.min.js')));
app.use('/javascripts/jquery-3.2.1.min.js', express.static(path.join(__dirname, 'public/javascripts/jquery-3.2.1.min.js')));

//app.use(flash());

// passport setup
app.use(passport.initialize());
app.use(passport.session());
passport.use('login',
	new LocalStrategy({
		passReqToCallback: true,
		usernameField: 'username',
		passwordField: 'password'
	},
	function (err, username, password, done) {

		console.log('received username: ' + username);
		console.log('received password: ' + password);
		//console.log("REQ " + req.connection.remoteAddress);
		// ignore invalid username and passwords
		if(!(validator.isAlphanumeric(username) && validator.isAlphanumeric(password))){
			return done(null, false);
		}
		
		var userQuery = "SELECT * FROM users WHERE username = " + pool.escape(username) + " AND failedloginattempts < "+ MAXFAILEDLOGINATTEMPTS + ";";
		console.log(userQuery);
		var data = {
			username: username,
			password: password
		}

		queryWrapper(userQuery, data, function(error, results, fields, data){	
			if(!error){
				
				if(results){
					
					if (results.length > 0) {						
						
						if (results[0].username == data.username && results[0].password == data.password) {
							// correct password 
							console.log("succesful login query");
							return done(null, true, username);
						} else {
							
							// incorrect password
							console.log("incorrect password");
							incuserfailedlogin(username, function(){
								return done(null, false)
							});
							//fslogger.log("failed login attempt by " + req.connection.remoteAddress + " with username: " + data.username + " and password " + data.password);
							
						}
						
					}else{
						console.log("no users found with username: " + username);
						//fslogger.log("failed login attempt by " + req.connection.remoteAddress + " with username: " + data.username + " and password " + data.password);
						return done(null, false);
					}	
				}else{
					return callback(null, false);
				}					
			}						
		});	
	})
);

passport.serializeUser(function (user, done) {
	//console.log("user serialized");
	done(null, user);
});

passport.deserializeUser(function (user, done) {
	//console.log("user deserialized");	
	done(null, user);
});

// authenticated paths
var privateres = ['map', 'javascripts', 'stylesheets', 'fonts', 'less', 'scss', 'images'];
for (var i = 0, len = privateres.length; i < len; i++) {
	app.use('/' + privateres[i], isAuthenticated);
	app.use('/'+ privateres[i], express.static(path.join(__dirname, 'private/'+ privateres[i])));
}

// routes
app.use('/', require('./routes/indexroute')(passport, fslogger));
app.use('/signout', require('./routes/signoutroute')(passport, fslogger));
app.use('/login', require('./routes/loginroute')(passport, fslogger));
app.use('/main', require('./routes/mainroute')(passport, fslogger));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    
	var err = new Error('Not Found');
	err.status = 404;
	next(err);	
});

// error handler
app.use(function (err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

});

// Exit Handling
process.stdin.resume(); //so the program will not close instantly

function exitHandler(options, err) {
	if (options.cleanup)
		console.log('clean');
		
	if (err)
		console.log(err.stack);
	if (options.exit) {
		//console.log("EXITING");

		process.exit();
	}	
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, {
		
		cleanup: true
	}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {
		exit: true
	}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {
		exit: true
	}));
process.on('SIGUSR2', exitHandler.bind(null, {
		exit: true
	}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {
		exit: true
	}));
