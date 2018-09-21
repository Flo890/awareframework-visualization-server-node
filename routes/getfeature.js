var FeatureFetcher = require('../service/FeatureFetcher');

var express = require('express');
var router = express.Router();

let featureFetcherInstance = new FeatureFetcher();
let DbService = require('../service/dbService');
let dbService = DbService.getInstance();

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
    let participantId = req.user.participant_id; // get participant_id from the user object the client is authenticated with

    let mappingConfig = require('../config/datamappings.json').mappings;

    dbService.getUserByParticipantId(participantId, (error,user) => {
        dbService.getOsType(user.device_id, os => {
            var features = Object.keys(mappingConfig).filter(featureKey => {

                if (mappingConfig[featureKey].only_for_os && mappingConfig[featureKey].only_for_os != os) {
                    // if a os is set, and it is not the one of this request's device, filter this feature out
                    console.log(`filtered out ${featureKey}`);
                    return false;
                }
                if (mappingConfig[featureKey].sources) {
                    // if this is a feature with source specification, and there is not exclusion-free source, and each only_for_os label does match this request's os, filter this feature out
                    for (let i = 0; i<mappingConfig[featureKey].sources.length; i++){
                        if (!mappingConfig[featureKey].sources[i].only_for_os) {
                            // there is exclusion-free source
                            return true;
                        }
                    }
                    for (let i = 0; i<mappingConfig[featureKey].sources.length; i++){
                        if(mappingConfig[featureKey].sources[i].only_for_os == os){
                            // there is a source for this request's os
                            return true;
                        }
                    }
                    console.log(`filtered out ${featureKey}`);
                    return false;
                }
                return true;
            }).map(featureKey => {
                return {
                    key: featureKey,
                    display_name: mappingConfig[featureKey].display_name,
                    display_unit: mappingConfig[featureKey].display_unit
                };
            });

            res.send(features);
        });
    });
});

router.options('/getallavailables', (req,res,next) => {res.status(200).send()});

module.exports = router;
