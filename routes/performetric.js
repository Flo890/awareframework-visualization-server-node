var express = require('express');
var router = express.Router();
var PerformetricService = require('../service/PerformetricService');

/**
 * example call:
 * http://localhost:3333/performetric/sync
 */
router.get('/sync', function(req, res, next) {
    new PerformetricService().sync(result => {
        res.send(result);
    });
});

module.exports = router;
