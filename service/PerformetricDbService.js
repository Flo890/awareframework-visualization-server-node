const DbService = require('./dbService');
const moment = require('moment');

class PerformetricDbService extends DbService {

    getLatestPerformetricSyncDate(callback){
        this.aware_data_connection.query('select max(`to`) as latest_to from performetric_fatigue_report;', [], function(err, rows) {
            if (err) console.error(err);
            if (rows.length < 1 || !rows[0].latest_to) {
                callback(undefined);
            } else {
                callback(rows[0].latest_to.getTime());
            }
        });
    }

    getPerformetricUserMapping(callback) {
        this.meta_connection.query("select user_mapping_study2performetric.participant_id, user_email, device_id from user_mapping_study2performetric join study_participants;",[], (error,rows)=>{
            if (error) console.error(error);
            callback(rows);
        });
    }

    insertPerformetricData(performetricObj, performetricUserMapping, from, to){
        if (performetricObj && performetricObj[0] && performetricObj[0][0] && performetricObj[0][0].users) {
            performetricObj[0][0].users.forEach(performetricUserObj => {
                this.aware_data_connection.query(
                    'insert into performetric_fatigue_report (`user`,device_id,fatigue_avg,minutes_no_fatigue,minutes_moderate_fatigue,minutes_extreme_fatigue,rest_breaks,fatigue_messages,`from`,`timestamp`,`to`) values(?,?,?,?,?,?,?,?,?,?,?);',
                    [
                        performetricUserObj.user,
                        performetricUserMapping.filter(aMapping => {
                            return aMapping.user_email == performetricUserObj.user;
                        })[0].device_id,
                        performetricUserObj.metrics.fatigueAvg,
                        performetricUserObj.metrics.minutesNoFatigue,
                        performetricUserObj.metrics.minutesModerateFatigue,
                        performetricUserObj.metrics.minutesExtremeFatigue,
                        performetricUserObj.metrics.restBreaks,
                        performetricUserObj.metrics.fatigueMessages,
                        moment.unix(from / 1000).format(),
                        from,
                        moment.unix(to / 1000).format()
                    ],
                    function (err, rows) {
                        if (err) {
                            console.error(err);
                        } else {
                            console.log('inserted performetric data');
                        }
                    });
            });
        }

    }

}
module.exports = PerformetricDbService;