var bcrypt = require('bcrypt-nodejs');

console.log(bcrypt.hashSync('password', null, null));