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

example call together with the above post body:
    http://localhost:3333/descriptivestatistics?participant_email=Florian.Bemmann@campus.lmu.de
 */
router.post('/',(req,res,next) => {
    const tileConfigs = req.body.configs;
    let participantId = req.user.participant_id;
    let participantEmail = req.query.participant_email;

    let promises = tileConfigs.map(aTileConfig => {
        return new Promise((resolve,reject) => {
            descrStatService.getTileDataForConfig(aTileConfig, participantId, participantEmail, tileData => {
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