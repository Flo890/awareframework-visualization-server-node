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

router.post('/hide',(req,res,next) => {
    // one of both is set:
   let hideId = req.body.correlationId;
   let hideFeature = req.body.feature;

   if (hideId) {
       correlationDetectionService.addHideCorrelationById(hideId, req.user.participant_id, () => {res.status(200).send()});
   }
   else if (hideFeature) {
        correlationDetectionService.addHideCorrelationByFeature(hideFeature, req.user.participant_id, () => {res.status(200).send()});
   }
   else {
       res.status(400).send();
   }
});

module.exports = router;