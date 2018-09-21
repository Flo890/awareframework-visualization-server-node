var express = require('express');
var router = express.Router();

const DbService = require('../service/dbService');
let dbService = DbService.getInstance();

/**
 * persists the dashboard config for a user
 * Usually it is called for a subset of the config only, e.g. only the timeline
 * So the body usually contains just one of the following objects:
 * {
 *   descrStatConfigs: {
 *     ...
 *   },
 *   timelineConfigs: {
 *     ...
 *   }
 * }
 */
router.post('/',(req,res,next) => {
    let participantId = req.user.participant_id;
    if (req.body.descrStatConfigs) {
        dbService.persistConfig(participantId, 'descrStatConfigs', req.body.descrStatConfigs, () => {});
    }
    if (req.body.timelineConfigs) {
        dbService.persistConfig(participantId, 'timelineConfigs', req.body.timelineConfigs, () => {});
    }
    res.status(200).send();
});

/**
 * returns the persisted dashboard configs of the user. So in contrast the post route, here the response contains all config objects
 */
router.get('/',(req,res,next) => {
    let participantId = req.user.participant_id;
    dbService.getAllDashboardConfigs(participantId, configs => {
        res.send(configs);
    })
});

module.exports = router;