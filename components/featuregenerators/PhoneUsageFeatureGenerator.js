let AbstractFeatureGenerator = require('./AbstractFeatureGenerator');

// if there is no off/locked event following after ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS seconds, the period will be cut after ACTIVE_PERIOD_LIMIT_SECS
const ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS = 3*60*60; // 3h
const ACTIVE_PERIOD_LIMIT_SECS = 10*60;

class PhoneUsageFeatureGenerator extends AbstractFeatureGenerator {

    getData(featureName, deviceId, from, to, granularityMins, callback){

        this.dbService.queryForAccumulatedDataAsObject({sql_selector: 'screen_status', source_table: 'screen'}, deviceId, from, to, 0, timeseriesObj => {

            // 1. create list of active-periods
            let eventPeriods = timeseriesObj.toEventPeriodTimeseries(
                dataPoint => {return dataPoint.screen_status == 1 || dataPoint.screen_status == 3;},
                dataPoint => {return dataPoint.screen_status == 0 || dataPoint.screen_status == 2;},
                'SCREEN_ON_OR_UNLOCKED'
            );
            // 2. convert to second amounts and accumulate to granularity
            let bins = eventPeriods.toBins(granularityMins, ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS*1000, ACTIVE_PERIOD_LIMIT_SECS*1000);
            callback(bins);
        });
    }
}
module.exports = PhoneUsageFeatureGenerator;