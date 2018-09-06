var express = require('express');
var router = express.Router();
var RescueTimeService = require('../service/RescueTimeService');

/**
 * example call:
 * http://localhost:3333/rescuetime/sync
 */
router.get('/sync', function(req, res, next) {
    new RescueTimeService().sync(result => {
        res.send(result);
    });
});

module.exports = router;
