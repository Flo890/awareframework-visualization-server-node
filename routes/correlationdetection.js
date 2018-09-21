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

/**
 * http://localhost:3333/correlations/compute?computeParticipantId=3&computeEmail=Florian.Bemmann@campus.lmu.de
 */
router.get('/compute', (req,res,next) => {
   correlationDetectionService.computeCorrelations(req.query.computeParticipantId, req.query.computeEmail, result => {res.status(200).send(result)});
});

module.exports = router;