var express = require('express');
var router = express.Router();

let DescrStatService = require('../service/DescrStateService');
let descrStatService = new DescrStatService();

/**
 * post data has to contain array "configs" containing objects like this:
 * {configs: [{
				featureName: 'fatigue_level',
				from: 1535174664000,
				to: 1535216964000,
				accumulator: 'max'
			},
			...
			]}
   and url parameter participant_id is required
 */
router.post('/',(req,res,next) => {
    const tileConfigs = req.body.configs;
    let participantId = req.query.participant_id;

    let promises = tileConfigs.map(aTileConfig => {
        return new Promise((resolve,reject) => {
            descrStatService.getTileDataForConfig(aTileConfig, participantId, tileData => {
                resolve({
                    config: aTileConfig,
                    values:tileData,
                    featureDisplayName: require('../config/datamappings.json').mappings[aTileConfig.featureName].display_name
                });
            });
        });
    });

    Promise.all(promises)
        .then(result => {res.send(result)})
        .catch(error => {
            console.error(error);
            res.status(500).send(error)
        })
});

module.exports = router;