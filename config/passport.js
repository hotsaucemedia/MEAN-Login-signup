var bCrypt = require('bcrypt');
var validator 	= require('validator');

const LocalStrategy = require('passport-local').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;

// webtoken based authentication:
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwtSecret = require('./jwtSecret');

const configAuth = require('./auth');

module.exports = function(passport, user, auth_user){

	var User = user;
	var Auth_user = auth_user; 

	passport.serializeUser(function(user, done) {
    console.log("@@@@@@@@@@@ serializing...");
	  done(null, user.id);
	});

	passport.deserializeUser(function(id, done) {
	  User.findById(id).then(function(user) {
   	  console.log("@@@@@@@@@@@ de-serializing...");
	   	if(user){
	   		done(null, user.get());
	   	}else{
	   		done(user.errors,null);
	   	}
	  });
	});


	let opts = {};
	opts.jwtFromRequest = ExtractJwt.fromAuthHeader();
	opts.secretOrKey = jwtSecret.secret;

  // JwtStrategy for local-login!
  passport.use(new JwtStrategy(opts, function(jwt_payload, done) {
		// console.log("JWT_PAYLOAD: ", jwt_payload);
    
    User.findOne({ where : { email: jwt_payload.email}}).then(function (err, user) {
      if (err) {
        return done(err, false);
      }
      if (user){
        var userinfo = user.get();
        return done(null,userinfo);
      }else{ 
        return done(null, false);
      }
    });
	}));


	
	

	// // local login passport
	// passport.use('local-login', new LocalStrategy({
	// 	usernameField : 'email',
	// 	passwordField : 'password',
	// 	passReqToCallback : true
	// },
	// 	function(req, email, password, done) {
	// 		var User = user;
	// 		// isValidPassword function compares the password entered with the bCrypt comparison method
	// 		// since we stored our password with bcrypt
	// 		var isValidPassword = function(userpass,password){
	// 		  	return bCrypt.compareSync(password, userpass);
	// 		}

	// 		User.findOne({ where : { email: email}}).then(function (user) {

	// 		  	if (!user) {
	// 					req.msg = "No such a user!";
	// 		    	return done(null, false);
	// 		  	} else if (!user.password){
	// 					req.msg = "You registered only via social networks! Signup locally!";
	// 		  		return done(null, false);
	// 		  	}else if (!isValidPassword(user.password,password)) {
	// 					req.msg = "Incorrect password!";
	// 		    	return done(null, false);
	// 		  	}else{
	// 				req.msg = "You are successfully logged in.";
	// 		  	var userinfo = user.get();
	// 				return done(null,userinfo);
	// 				}
	// 		});
	// 	}
	// ));


	// facebook signup passport
	passport.use(new FacebookStrategy({
	    clientID 			: configAuth.facebookAuth.clientID,
	    clientSecret 		: configAuth.facebookAuth.clientSecret,
	    callbackURL 		: configAuth.facebookAuth.callbackURL,
	    profileFields 		: ['id', 'emails', 'name', 'displayName', 'photos'],
	   	passReqToCallback 	: true 
	},
		function(req, accessToken, refreshToken, profile, done) {
	    	process.nextTick(function(){
				console.log("@@@@@@@@@@@ searching for f_id in user");
				User.findOne({ where : { f_id: profile.id }}).then(function (user) {
	    			if(user){
	    				console.log("@@@@@@@@@@@ executing user.get");	    				
	    				var userinfo = user.get();
				  		return done(null,userinfo);
	    			}else{
	    				var emailArray = profile.emails.map(function(item) {return item.value;});
	    				console.log("array of emails: " , emailArray);
	    				console.log("@@@@@@@@@@@ searching for facebook emails in user table");
				    	return User.findOne({ where : { email : {$in : emailArray } } }).then(function(user){
				    		if(user){
				    			var dataForAuth_user =
					    		{ 
					    			auth_id 	: profile.id,
					    			token 		: accessToken,
					    			firstname 	: profile.name.givenName,
					    			lastname 	: profile.name.familyName,
					    			user_id  	: user.id,
					    			imageURL 	: profile.photos[0].value,
					    			displayName : profile.displayName,
					    			provider_id : 1
							    };
							    dataForAuth_user["email"] = emailArray.toString();
						    	var data = {
								    f_id 	: profile.id,
								    f_token : accessToken,
								    f_name 	: profile.displayName
							    };
							    console.log("@@@@@@@@@@@ searching for f_id in auth_user table");
				    			return Auth_user.findOne({ where : { auth_id : profile.id }}).then(function(auth_user){
				    				if(auth_user){
				    					console.log("@@@@@@@@@@@ Updating Auth_table with new data from facebook");
				    					return Auth_user.update(dataForAuth_user, { where: { auth_id : profile.id } }).then(function(){
				    						console.log("@@@@@@@@@@@ updating user table by inserting f_id and f_token");
										    return User.update(data, { where: { email : profile.emails[0].value } }).then(function(){
										    	console.log("@@@@@@@@@@@ executing user.get");
										    	var userinfo = user.get();
										    	return done(null, userinfo);
									    	}).catch(function(err){
						  						console.log("###### Error : ",err);
						  						return done(null, false, req.flash('loginMessage', 'Something went wrong while updating your profile based on Facebook data!' ));
											});
								    	}).catch(function(err){
					  						console.log("###### Error : ",err);
					  						return done(null, false, req.flash('loginMessage', 'Something went wrong while updating your profile based on Facebook data!' ));
										});
				    				}else{
				    					console.log("@@@@@@@@@@@ No f_id and creating new facebook user in auth-user table");
								    	return Auth_user.create(dataForAuth_user).then(function(newAuthUser,created){
									     	if(!newAuthUser){
					  							return done(null, false, req.flash('loginMessage', 'Problem in registering your Facebook profile!' ));
									      	}else{
									        	console.log("A new facebook user is created!");
									        	console.log("@@@@@@@@@@@ updating user table by inserting f_id and f_token");
											    return User.update(data, { where: { email : profile.emails[0].value } }).then(function(){
											    	console.log("@@@@@@@@@@@ executing user.get");
											    	var userinfo = user.get();
											    	return done(null, userinfo);
										    	}).catch(function(err){
							  						console.log("###### Error : ",err);
							  						return done(null, false, req.flash('loginMessage', 'Something went wrong while updating your profile based on Facebook data!' ));
												});
									      	}
								    	}).catch(function(err){
					  						console.log("###### Error : ",err);
					  						return done(null, false, req.flash('loginMessage', 'Something went wrong while registering your Facebook profile in our database!' ));
										});
					    			}
				    			}).catch(function(err){
			  						console.log("###### Error : ",err);
			  						return done(null, false, req.flash('loginMessage', 'Something went wrong while searching facebook id in auth_user table!' ));
								});
				    		}else{
				    			var dataForUser =
					    		{ 
					    			firstname 	: profile.name.givenName,
					    			lastname 	: profile.name.familyName,
					    			f_id 		: profile.id,
					    			f_token 	: accessToken,
								    f_name 		: profile.displayName,
					    			email 		: profile.emails[0].value
							    };
							    console.log("@@@@@@@@@@@ creating a new user based on facebook profile");
				    			return User.create(dataForUser).then(function(newUser,created){
				    				if(!newUser){
			  							return done(null, false, req.flash('loginMessage', 'Problem in creating your local profile based on facebook data!' ));
							      	}else{
										var dataForAuth_user =
							    		{
							    			auth_id 	: profile.id,
							    			token 		: accessToken,
							    			firstname 	: profile.name.givenName,
							    			lastname 	: profile.name.familyName,
							    			user_id  	: newUser.id,
							    			imageURL 	: profile.photos[0].value,
							    			displayName : profile.displayName,
							    			provider_id : 1
									    };
									    dataForAuth_user["email"] = emailArray.toString(); 
									    console.log("@@@@@@@@@@@ creating a facebook profile");
								    	return Auth_user.create(dataForAuth_user).then(function(newAuthUser,created){
									     	if(!newAuthUser){
			  									return done(null, false, req.flash('loginMessage', 'Problem in registering your Facebook profile!' ));
									      	}else{
									      		return done(null, newUser);
									      	}
								    	}).catch(function(err){
				  							console.log("###### Error : ",err);
				  							return done(null, false, req.flash('loginMessage', 'Problem in registering your Facebook profile!' ));
										});
							      	}
				    			}).catch(function(err){
								  	console.log("###### Error : ",err);
								  	return done(null, false, req.flash('loginMessage', 'Problem in registering your local user profile!' ));
								});
				    		}
				    	}).catch(function(err){
				  			console.log("###### Error : ",err);
				  			return done(null, false, req.flash('loginMessage', 'Problem in searching the local user table for Facebook email!' ));
						});	
	    			}
	    		}).catch(function(err){
				  	console.log("###### Error : ",err);
				  	return done(null, false, req.flash('loginMessage', 'Problem in searching for facebook id in the local user table!' ));
				});
			});
		}
	));




	passport.use(new GoogleStrategy({
	    clientID: configAuth.googleAuth.clientID,
	    clientSecret: configAuth.googleAuth.clientSecret,
	    callbackURL: configAuth.googleAuth.callbackURL,
   	   	passReqToCallback : true 
	},
		function(req, accessToken, refreshToken, profile, done) {
	    	process.nextTick(function(){
 				console.log("@@@@@@@@@@@ searching for g_id in user");
	    		// console.log(profile.emails);
	    		//profile.emails = [{ value: 'neghabi.mr@gmail.com', type: 'account' }, { value: 'rezaneghabi@gmail.com', type: 'account' }];
				User.findOne({ where : { g_id: profile.id }}).then(function (user) {
	    			if(user){
	    			   	console.log("@@@@@@@@@@@ executing user.get");		
						var userinfo = user.get();
				  		return done(null,userinfo);
	    			}else {
	    				var emailArray = profile.emails.map(function(item) {return item.value;});
	    				console.log("array of emails: " , emailArray);
	    				console.log("@@@@@@@@@@@ searching for google emails in user table");
				    	return User.findOne({ where : { email : {$in : emailArray } } }).then(function(user){
				    		if(user){
								var dataForAuth_user =
					    		{ 
					    			auth_id 	: profile.id,
					    			token 		: accessToken,
					    			firstname 	: profile.name.givenName,
					    			lastname 	: profile.name.familyName,
					    			user_id  	: user.id,
					    			imageURL 	: profile.photos[0].value,
					    			displayName : profile.displayName,
					    			provider_id : 2
							    };
							    dataForAuth_user["email"] = emailArray.toString();
							    var data = { 
								    g_id 	: profile.id,
								    g_token : accessToken,
								    g_name 	: profile.displayName
							    };
							    console.log("@@@@@@@@@@@ searching for g_id in auth_user table");
							    return Auth_user.findOne({ where : { auth_id : profile.id }}).then(function(auth_user){
				    				if(auth_user){
				    					console.log("@@@@@@@@@@@ Updating Auth_table with new data from google");
				    					return Auth_user.update(dataForAuth_user, { where: { auth_id : profile.id } }).then(function(){
				    						console.log("@@@@@@@@@@@ updating user table by inserting g_id and g_token");
										    return User.update(data, { where: { email : profile.emails[0].value } }).then(function(){
										    	console.log("@@@@@@@@@@@ executing user.get");
										    	var userinfo = user.get();
										    	return done(null, userinfo);
									    	}).catch(function(err){
						  						console.log("###### Error : ",err);
						  						return done(null, false, req.flash('loginMessage', 'Something went wrong while updating user table based on Google data!' ));
											});
								    	}).catch(function(err){
					  						console.log("###### Error : ",err);
					  						return done(null, false, req.flash('loginMessage', 'Something went wrong while updating auth-user table based on Google data!' ));
										});
									}else{
				    					console.log("@@@@@@@@@@@ No g_id and creating new google user in auth-user table");
								    	return Auth_user.create(dataForAuth_user).then(function(newAuthUser,created){
									     	if(!newAuthUser){
					  							return done(null, false, req.flash('loginMessage', 'Problem in registering your Google profile in auth_table!' ));
									      	}else{
									        	console.log("A new Google user is created!");
									        	console.log("@@@@@@@@@@@ updating user table by inserting g_id and g_token");
											    return User.update(data, { where: { email : profile.emails[0].value } }).then(function(){
											    	console.log("@@@@@@@@@@@ executing user.get");
											    	var userinfo = user.get();
											    	return done(null, userinfo);
										    	}).catch(function(err){
							  						console.log("###### Error : ",err);
							  						return done(null, false, req.flash('loginMessage', 'Something went wrong while updating your profile based on Google data!' ));
												});
									      	}
								    	}).catch(function(err){
					  						console.log("###### Error : ",err);
					  						return done(null, false, req.flash('loginMessage', 'Something went wrong while registering your Google profile in our database!' ));
										}); 
					    			}
				    			}).catch(function(err){
			  						console.log("###### Error : ",err);
			  						return done(null, false, req.flash('loginMessage', 'Something went wrong while searching google id in auth_user table!' ));
								});			
				    		}else{
				    			var dataForUser =
					    		{ 
					    			firstname 	: profile.name.givenName,
					    			lastname 	: profile.name.familyName,
					    			g_id 		: profile.id,
					    			g_token 	: accessToken,
								    g_name 		: profile.displayName,
					    			email 		: profile.emails[0].value
							    };
							   	console.log("@@@@@@@@@@@ creating a new user based on google profile");
				    			return User.create(dataForUser).then(function(newUser,created){
				    				if(!newUser){
			  							return done(null, false, req.flash('loginMessage', 'Problem in creating your local profile based on Google data!' ));
							      	}else{
										var dataForAuth_user =
							    		{
							    			auth_id 	: profile.id,
							    			token 		: accessToken,
							    			firstname 	: profile.name.givenName,
							    			lastname 	: profile.name.familyName,
							    			user_id  	: newUser.id,
							    			imageURL 	: profile.photos[0].value,
							    			displayName : profile.displayName,
							    			provider_id : 2
									    };
									    dataForAuth_user["email"] = emailArray.toString();
										console.log("@@@@@@@@@@@ creating a google profile");
								    	return Auth_user.create(dataForAuth_user).then(function(newAuthUser,created){
									     	if(!newAuthUser){
			  									return done(null, false, req.flash('loginMessage', 'Problem in registering your Google profile!' ));
									      	}else{
							        			return done(null, newUser);
									      	}
								    	}).catch(function(err){
				  							console.log("###### Error : ",err);
				  							return done(null, false, req.flash('loginMessage', 'Problem in registering your Google profile!' ));
										});
							      	}
				    			}).catch(function(err){
								  	console.log("###### Error : ",err);
								  	return done(null, false, req.flash('loginMessage', 'Problem in registering your local user profile!' ));
								});
				    		}
				    	}).catch(function(err){
				  			console.log("###### Error : ",err);
				  			return done(null, false, req.flash('loginMessage', 'Problem in searching the local user table for Google email!' ));
						});	
				    	// return null;
	    			}
	    		}).catch(function(err){
				  	console.log("###### Error : ",err);
				  	return done(null, false, req.flash('loginMessage', 'Problem in searching for Google id in the local user table!' ));
				});
			});
		}
	));


passport.use(new TwitterStrategy({
	    consumerKey: configAuth.twitterAuth.consumerKey,
	    consumerSecret: configAuth.twitterAuth.consumerSecret,
	    callbackURL: configAuth.twitterAuth.callbackURL,
	    userProfileURL: "https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true",
	    includeEmail: true,
   	   	passReqToCallback : true 
	},
		function(req, accessToken, refreshToken, profile, done) {
	    	process.nextTick(function(){	
				console.log("@@@@@@@@@@@ searching for t_id in user");   				
				User.findOne({ where : { t_id: profile.id }}).then(function (user) {
	    			if(user){
	    				console.log("@@@@@@@@@@@ executing user.get");	    				
						var userinfo = user.get();
				  		return done(null,userinfo);
	    			}else {
	    				var emailArray = profile.emails.map(function(item) {return item.value;});
	    				console.log("array of emails: " , emailArray);
				    	console.log("@@@@@@@@@@@ searching for twitter emails in user table");
				    	return User.findOne({ where : { email : {$in : emailArray } } }).then(function(user){
				    		if(user){
				    			var name = profile.displayName.split(" ");
								var dataForAuth_user =
					    		{ 
					    			auth_id 	: profile.id,
					    			token 		: accessToken,
					    			firstname 	: name[0],
					    			lastname 	: name[1],
					    			user_id  	: user.id,
					    			imageURL 	: profile.photos[0].value,
					    			displayName : profile.displayName,
					    			provider_id : 3
							    };
							    dataForAuth_user["email"] = emailArray.toString();
							    var data = {
								    t_id 	: profile.id,
								    t_token : accessToken,
								    t_name 	: profile.displayName
							    };
							    console.log("@@@@@@@@@@@ searching for t_id in auth_user table");
							    return Auth_user.findOne({ where : { auth_id : profile.id }}).then(function(auth_user){
				    				if(auth_user){
				    					console.log("@@@@@@@@@@@ Updating Auth_table with new data from twitter");
				    					return Auth_user.update(dataForAuth_user, { where: { auth_id : profile.id } }).then(function(){
				    						console.log("@@@@@@@@@@@ updating user table by inserting t_id and t_token");
										    return User.update(data, { where: { email : profile.emails[0].value } }).then(function(){
										    	console.log("@@@@@@@@@@@ executing user.get");
										    	var userinfo = user.get();
										    	return done(null, userinfo);
									    	}).catch(function(err){
						  						console.log("###### Error : ",err);
						  						return done(null, false, req.flash('loginMessage', 'Something went wrong while updating user table based on Twitter data!' ));
											});
								    	}).catch(function(err){
					  						console.log("###### Error : ",err);
					  						return done(null, false, req.flash('loginMessage', 'Something went wrong while updating  auth_yser table based on Twitter data!' ));
										});
				    				}else{
				    					console.log("@@@@@@@@@@@ No t_id and creating new twitter user in auth-user table");
								    	return Auth_user.create(dataForAuth_user).then(function(newAuthUser,created){
									     	if(!newAuthUser){
					  							return done(null, false, req.flash('loginMessage', 'Problem in registering your Twitter profile!' ));
									      	}else{
									        	console.log("A new twitter user is created!");
									        	console.log("@@@@@@@@@@@ updating user table by inserting t_id and t_token");
											    return User.update(data, { where: { email : profile.emails[0].value } }).then(function(){
											    	console.log("@@@@@@@@@@@ executing user.get");
											    	var userinfo = user.get();
											    	return done(null, userinfo);
										    	}).catch(function(err){
							  						console.log("###### Error : ",err);
							  						return done(null, false, req.flash('loginMessage', 'Something went wrong while updating user table based on Twitter data!' ));
												});
									      	}
								    	}).catch(function(err){
					  						console.log("###### Error : ",err);
					  						return done(null, false, req.flash('loginMessage', 'Something went wrong while registering auth_user table!' ));
										});
					    			}
				    			}).catch(function(err){
			  						console.log("###### Error : ",err);
			  						return done(null, false, req.flash('loginMessage', 'Something went wrong while searching t_id in auth_user table!' ));
								});
				    		}else{
				    			var name = profile.displayName.split(" ");
				    			var dataForUser =
					    		{ 
					    			firstname 	: name[0],
					    			lastname 	: name[1],
					    			t_id 		: profile.id,
					    			t_token 	: accessToken,
								    t_name 		: profile.displayName,
					    			email 		: profile.emails[0].value
							    };
							    console.log("@@@@@@@@@@@ creating a new user based on twitter profile");
				    			return User.create(dataForUser).then(function(newUser,created){
				    				if(!newUser){
			  							return done(null, false, req.flash('loginMessage', 'Problem in creating your local profile based on twitter data!' ));
							      	}else{
						    			var name = profile.displayName.split(" ");
										var dataForAuth_user =
							    		{ 
							    			auth_id 	: profile.id,
							    			token 		: accessToken,
							    			firstname 	: name[0],
							    			lastname 	: name[1],
							    			user_id  	: newUser.id,
							    			imageURL 	: profile.photos[0].value,
							    			displayName : profile.displayName,
							    			provider_id : 3
									    };
									    dataForAuth_user["email"] = emailArray.toString();
									    console.log("@@@@@@@@@@@ creating a twitter profile");
								    	return Auth_user.create(dataForAuth_user).then(function(newAuthUser,created){
									     	if(!newAuthUser){
			  									return done(null, false, req.flash('loginMessage', 'Problem in registering your twitter profile!' ));
									      	}else{
									       		return done(null, newUser);
									      	}
								    	}).catch(function(err){
				  							console.log("###### Error : ",err);
				  							return done(null, false, req.flash('loginMessage', 'Problem in registering your twitter profile!' ));
										});
							      	}
				    			}).catch(function(err){
								  	console.log("###### Error : ",err);
								  	return done(null, false, req.flash('loginMessage', 'Problem in registering your local user profile!' ));
								});
				    		}
				    	}).catch(function(err){
				  			console.log("###### Error : ",err);
				  			return done(null, false, req.flash('loginMessage', 'Problem in searching the local user table for twitter email!' ));
						});	
	    			}
	    		}).catch(function(err){
				  	console.log("###### Error : ",err);
				  	return done(null, false, req.flash('loginMessage', 'Problem in searching for twitter id in the local user table!' ));
				});
			});
		}
	));
}