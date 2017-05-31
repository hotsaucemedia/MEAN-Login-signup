const bCrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const jwtSecret = require('../config/jwtSecret');



module.exports = function(app, passport, user){
	var User = user;
	
  // // using local-login strategy
	// app.post('/users/login', function(req, res, next) {
	// 	passport.authenticate('local-login', function(err, user) {
	// 		if (err) { return next(err); }
	// 		if (!user) { return res.json({success: false, msg:req.msg}) }
	// 		req.logIn(user, function(err) {
	// 			if (err) { return next(err); }
	// 			console.log("req.session", req.session);
	// 			return res.json({success: true, msg: req.msg, user: req.user});
	// 		});
	// 	})(req, res, next);
	// });
	
  app.post('/users/login', function(req, res, next) {
    const email = req.body.email;
    const password = req.body.password;
    
		User.findOne({ where : { email: email}}).then(function (user) {
      if (!user) {
        req.msg = "No such a user!";
        return res.json({success: false, msg:req.msg});
      } else if (!user.password){
        req.msg = "You registered only via social networks! Signup locally!";
        return res.json({success: false, msg:req.msg});
      }else if (!isValidPassword(password, user.password)) {
        req.msg = "Incorrect password!";
        return res.json({success: false, msg:req.msg});
      }else{

        const userinfo = user.get();
        const token = jwt.sign(userinfo, jwtSecret.secret, {
          expiresIn: 3600
        });
        req.msg = "You are successfully logged in.";
        return res.json({ success: true,
                          msg:req.msg,
                          token: 'JWT '+ token,
                          user:{
                            id: userinfo.id,
                            firstname: userinfo.firstname,
                            lastname: userinfo.lastname,
                            email: userinfo.email
                          }
                        });
      }
    }).catch(function(err){
			  console.log("###### Error : ", err);												
    });
  });

	app.post("/users/signup", function(req, res) {
		// we are adding hashed password generating function inside the callback function
		var generateHash = function(password) {
			password_salt = bCrypt.genSaltSync(9);
			return bCrypt.hashSync(password, password_salt, null);
		}

		User.findOne({where: {email:req.body.email}}).then(function(user) {
			if(user) {
				res.json({success: false, msg:'That email is already taken!'});
			} else { // we must register new user
				if (req.body.password == req.body.password2){
          var userPassword = generateHash(req.body.password);
          // here req.body object contains inputs from signup form. 
          var data =
            { 
              email 		: req.body.email,
              password 	: userPassword,
              password_salt: password_salt,
              firstname 	: req.body.firstname,
              lastname 	: req.body.lastname
            };
          // User.create is a Sequelize method for adding new entries to the database (similar to mongoose!)
          return User.create(data).then(function(newUser,created){
            if(!newUser){
              res.json({success: false, msg:'Failed to register user due to db error!'});
            }
            if(newUser){
              res.json({success: true, msg:'User is registered successfully.'});
            }
          });
        }else{
          res.json({success: false, msg:'Passwords mismatch error!'});
        }
			}
	  });
  });

  // app.get('/users/profile', passport.authenticate('jwt', {session:false}), (req, res) => {
  //   // console.log("test     ", req[0]);
  //   res.json({user: req.user, msg: "You made it to the secure area"});
  // });


	// app.get('/users/profile', function(req, res, next) {
  //   console.log("test1");
	// 	passport.authenticate('jwt', {session:false}, function(req, res) {
  //     console.log(req);
	// 		res.json({user: req.user, msg: "You made it to the secure area"});
	//   });
  // });





	app.get('/users/profile', function(req, res, next) {
    console.log(req.headers.authorization);
    let str = req.headers.authorization;
    jwt.verify(str.substring(4), jwtSecret.secret, function(err, user) {
      if(!err){
        console.log("decoded: ", user) ;
        res.json({user: user, msg: "You made it to the secure area"});
      }else{ res.json({msg: "Your token is expired!"});}
  });
  
});


// 	// route to logout page
// 	app.get('/logout', function(req, res){
// 		// console.log(req.session);
//   		req.session.destroy(function(err) {
//   		// console.log(req.session);
//   			res.redirect('/');
//   		});
// 	});
};

var isValidPassword = function(userpass,password){
  return bCrypt.compareSync(userpass, password);
}

function isLoggedIn(req, res, next) {
	if(req.isAuthenticated()){
		return next();
	} 
	  return null;
}

function validateToken(token){
    jwt.verify(token, jwtSecret.secret, function(err, decoded) {
       if (err) {
        /*
            err = {
            name: 'TokenExpiredError',
            message: 'jwt expired',
            expiredAt: 1408621000
          }
        */
      }
    });
}