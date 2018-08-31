var FeatureFetcher = require('../service/FeatureFetcher');

var express = require('express');
var router = express.Router();

let featureFetcherInstance = new FeatureFetcher();

/**
 * example call:
 * http://localhost:3333/features/getone?feature_name=temperature&granularity_mins=10&from=1534740240000&to=1534959000000
 */
router.get('/getone', function(req, res, next) {
    let featureName = req.query.feature_name;
    let participantId = req.user.participant_id; // get participant_id from the user object the client is authenticated with
    let email = req.query.participant_email;
    let granularityMins = req.query.granularity_mins;

    let from = req.query.from ? req.query.from*1000 : 0;
    let to = req.query.to ? req.query.to*1000 : 9999999999999;

    featureFetcherInstance.getFeature(participantId, email, featureName, from, to, granularityMins, data => {
        res.send(data);
    });
});

router.options('/getone', (req,res,next) => {res.status(200).send()});

/**
 * example call:
 * http://localhost:3333/features/getallavailables
 */
router.get('/getallavailables', function(req,res,next) {
    let participantId = req.user.participant_Id; // get participant_id from the user object the client is authenticated with

    let mappingConfig = require('../config/datamappings.json').mappings;
    var features = Object.keys(mappingConfig).map(featureKey => {
        return {
            key: featureKey,
            display_name: mappingConfig[featureKey].display_name
        };
    });

    res.send(features);
});

router.options('/getallavailables', (req,res,next) => {res.status(200).send()});

module.exports = router;
