var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt-nodejs');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

let DbService = require('../service/dbService');
let dbService = DbService.getInstance();


passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    dbService.getUserById(id, done);
});


passport.use('dashboard-register', new LocalStrategy({
    usernameField: 'participant_id',
    passwordField: 'password',
    passReqToCallback: true
}, function(req, participant_id, password, done) {
    var newUser;
    if (participant_id && password) {
        newUser = {
            participant_id: participant_id,
            password: bcrypt.hashSync(password, null, null),
            device_id: req.body.device_id,
            rescuetime_api_key: req.body.rescuetime_api_key
        };

        dbService.addUser(newUser.participant_id, newUser.password, newUser.device_id, newUser.rescuetime_api_key, (err,id) => {
            if (!err) {
                newUser.id = id;
                done(null, newUser);
            } else {
                done(err);
            }
        });

    } else {
        done(new Error('parameters missing'));
    }
}));


passport.use('dashboard-login', new LocalStrategy({
        usernameField: 'participant_id',
        passwordField: 'password'
    },
    function(participant_id, password, done) {
        if (participant_id && password) {
            dbService.getUserByParticipantId(participant_id, (err,user) => {
                if (err) {
                    return done(err);
                }
                if (!user || !bcrypt.compareSync(password, user.password)) {
                    done(new Error('wrong credentials'));
                }
                // all is well, call back with user object.
                done(null, user);
            });
        } else {
            done(new Error('parameters missing'));
        }
    }));


router.post('/register', passport.authenticate('dashboard-register', {
    successRedirect: '/webapp',
    failureRedirect: '/register.html'
}));

router.post('/login', passport.authenticate('dashboard-login', {
    successRedirect: '/webapp',
    failureRedirect: '/login.html'
}));

router.use('/logout', function(req,res) {
    req.logout();
    res.redirect('/login.html');
});

/**
 * middleware to make sure the user is authenticated. If so, the user is authorized to go to next().
 *
 * @param req Request (Express)
 * @param res Response
 * @param next function in middle ware chain
 */
router.ensureAuthenticated = function(req, res, next) {
    //if (true){
    if (req.isAuthenticated()) {
        //req.user = {participant_id:3} //3: iPhone, 4: Huawei
        next();
    } else {
        res.status(401).send();
    }
};


module.exports = router;

