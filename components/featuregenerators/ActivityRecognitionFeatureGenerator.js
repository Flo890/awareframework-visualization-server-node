const AbstractFeatureGenerator = require('./AbstractFeatureGenerator');

// if there is no off/locked event following after ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS seconds, the period will be cut after ACTIVE_PERIOD_LIMIT_SECS
const ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS = 12*60*60; // 24h
const ACTIVE_PERIOD_LIMIT_SECS = 60*60;

class ActivityRecognitionFeatureGenerator extends AbstractFeatureGenerator {

    getData(featureName, deviceId, from, to, granularityMins, callback, subfeature){
        // first try android table
        this.dbService.queryForAccumulatedDataAsObject({sql_selector: 'activity_name', source_table: 'plugin_google_activity_recognition'}, deviceId, from, to, 0, timeseriesObj => {

            if (timeseriesObj.timestampLogDataPoints.length > 0) {
                // Android data found
                // 1. create list of active-periods
                let eventPeriods = timeseriesObj.toEventPeriodTimeseries(
                    dataPoint => {return dataPoint.activity_name == subfeature;},
                    dataPoint => {return dataPoint.activity_name != subfeature;},
                    `LOCATION_${subfeature.toUpperCase()}`
                );
                // 2. convert to second amounts and accumulate to granularity
                let bins = eventPeriods.toBins(granularityMins, ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS*1000, ACTIVE_PERIOD_LIMIT_SECS*1000);
                callback(bins);

            } else {
                //try ios table TODO ios is untested due to lack of test data
                const iosColumnNames = { // android-name/subfeature -> ios column name
                    still: 'stationary',
                    on_foot: 'walking',
                    walking: 'walking',
                    running: 'running',
                    on_bicycle: 'cycling',
                    in_vehicle: 'automotive',
                    unknown: 'unknown'
                };
                this.dbService.queryForAccumulatedDataAsObject({sql_selector: iosColumnNames[subfeature], source_table: 'plugin_ios_activity_recognition'}, deviceId, from, to, 0, timeseriesObj => {
                    // 1. create list of active-periods
                    let eventPeriods = timeseriesObj.toEventPeriodTimeseries(
                        dataPoint => {return dataPointiosColumnNames[subfeature] == 1;},
                        dataPoint => {return dataPointiosColumnNames[subfeature] != 1;},
                        `LOCATION_${subfeature.toUpperCase()}`
                    );
                    // 2. convert to second amounts and accumulate to granularity
                    let bins = eventPeriods.toBins(granularityMins, ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS*1000, ACTIVE_PERIOD_LIMIT_SECS*1000);
                    callback(bins);
                });
            }


        });
    }

}
module.exports = ActivityRecognitionFeatureGenerator;