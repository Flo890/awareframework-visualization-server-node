let AbstractFeatureGenerator = require('./AbstractFeatureGenerator');
let PeriodTimeseries = require('./model/PeriodTimeseries');

// if there is no off/locked event following after ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS seconds, the period will be cut after ACTIVE_PERIOD_LIMIT_SECS
const ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS = 3*60*60; // 3h
const ACTIVE_PERIOD_LIMIT_SECS = 10*60;

class PhoneUsageFeatureGenerator extends AbstractFeatureGenerator {

    getData(featureName, deviceId, from, to, granularityMins, callback){

        this.dbService.queryForAccumulatedDataAsObject({sql_selector: 'screen_status', source_table: 'screen'}, deviceId, from, to, 0, timeseriesObj => {
            // 1. create list of active-periods
            let screenOnOrUnlockedTimes = []; // -> [{timestampOn:1234, timestampOff: 1236}, ... ]
            let lastOffTimestamp = 0;
            for(let i = 0; i<timeseriesObj.timestampLogDataPoints.length; i++){
                let dataPoint = timeseriesObj.timestampLogDataPoints[i];
                // if this data point has screen state on or unlocked
                if (
                    (dataPoint.screen_status == 1 || dataPoint.screen_status == 3) // 1. this is a screen on/unlocked event
                    && dataPoint.timestamp > lastOffTimestamp // 2. this timestamp is later than the end of the last active period
                ) {
                    // get next datapoint after the current one, who's state is screen off or locked
                    let nextOffDatapoint = timeseriesObj.getNextDatapoint(dataPoint.timestamp, nextProbDatapoint => {
                        return nextProbDatapoint.screen_status == 0 || nextProbDatapoint.screen_status == 2;
                    });

                    screenOnOrUnlockedTimes.push({
                        startTimestamp: dataPoint.timestamp,
                        endTimestamp: nextOffDatapoint.timestamp,
                        event: 'SCREEN_ON_OR_UNLOCKED'
                    });
                    lastOffTimestamp = nextOffDatapoint.timestamp;
                }
            }

            // 2. convert to second amounts and accumulate to granularity
            let eventPeriods = new PeriodTimeseries(screenOnOrUnlockedTimes);
            let bins = eventPeriods.toBins(granularityMins, ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS*1000, ACTIVE_PERIOD_LIMIT_SECS*1000);
            callback(bins);
        });
    }
}
module.exports = PhoneUsageFeatureGenerator;