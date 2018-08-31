var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
const bodyParser = require("body-parser");
var session = require('express-session');

var auth = require('./routes/auth');


var app = express();

var passport = require('passport');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret : require('./config/secret.json').session_secret,
    resave: false,
    saveUninitialized: false
}));

app.use(cors());

app.use(passport.initialize());
app.use(passport.session());

app.use('/webapp',[auth.ensureAuthenticated, express.static(path.join(__dirname, 'webapp'))]);
app.use('/auth', auth);
app.use('/features', [auth.ensureAuthenticated, require('./routes/getfeature')]);
app.use('/performetric', [auth.ensureAuthenticated, require('./routes/performetric')]);
app.use('/notes', [auth.ensureAuthenticated, require('./routes/notes')]);
app.use('/descriptivestatistics', [auth.ensureAuthenticated, require('./routes/descriptivestatistics')]);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
