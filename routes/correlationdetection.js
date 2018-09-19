var express = require('express');
var router = express.Router();

let CorrelationDetectionService = require('../service/CorrelationDetectionService');
let correlationDetectionService = new CorrelationDetectionService();

router.get('/',(req,res,next) => {
    let participantId = req.user.participant_id;
    correlationDetectionService.getCorrelations(participantId, correlations => {
        res.send(correlations);
    });
});

module.exports = router;