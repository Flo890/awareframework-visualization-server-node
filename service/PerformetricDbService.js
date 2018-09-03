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

    insertPerformetricData(performetricObj, from, to){
        const dateFormat = 'YYYY-MM-DD HH:mm';
        console.log(performetricObj);
        if (performetricObj && performetricObj[0] && performetricObj[0][0] && performetricObj[0][0].users) {
            performetricObj[0][0].users.forEach(performetricUserObj => {
                this.aware_data_connection.query(
                    'insert into performetric_fatigue_report (`user`,device_id,fatigue_avg,minutes_no_fatigue,minutes_moderate_fatigue,minutes_extreme_fatigue,rest_breaks,fatigue_messages,`from`,`timestamp`,`to`) values("omitted",?,?,?,?,?,?,?,?,?,?);',
                    [
                        performetricUserObj.user,
                        performetricUserObj.metrics.fatigueAvg,
                        performetricUserObj.metrics.minutesNoFatigue,
                        performetricUserObj.metrics.minutesModerateFatigue,
                        performetricUserObj.metrics.minutesExtremeFatigue,
                        performetricUserObj.metrics.restBreaks,
                        performetricUserObj.metrics.fatigueMessages,
                        moment.unix(from / 1000).format(dateFormat),
                        from,
                        moment.unix(to / 1000).format(dateFormat)
                    ],
                    function (err, rows) {
                        if (err) {
                            console.error(err);
                        } else if (rows.affectedRows != 1) {
                            console.error(`insert performetric data: affected rows was ${rows.affectedRows}!`);
                        } else {
                            console.log('inserted performetric data');
                        }
                    });
            });
        }

    }

}
module.exports = PerformetricDbService;