const AbstractFeatureGenerator = require('./AbstractFeatureGenerator');

// if there is no off/locked event following after ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS seconds, the period will be cut after ACTIVE_PERIOD_LIMIT_SECS
const ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS = 24*60*60; // 24h
const ACTIVE_PERIOD_LIMIT_SECS = 60*60;

class HomeWorkTimeFeatureGenerator extends AbstractFeatureGenerator {

    /**
     *
     * @param featureName
     * @param deviceId
     * @param from
     * @param to
     * @param granularityMins
     * @param callback
     * @param subfeature one of home or work
     */
    getData(featureName, deviceId, from, to, granularityMins, callback, subfeature){
        this.dbService.queryForAccumulatedDataAsObject({sql_selector: 'ssid', source_table: 'wifi'}, deviceId, from, to, 0, timeseriesObj => {

            this.dbService.getWifiLocationMappings(deviceId, wifiLocationMapping => {

                // transform ot better indexable object
                let locationForWifi = {};
                for(let i=0; i<wifiLocationMapping.length; i++){
                    locationForWifi[wifiLocationMapping[i].wifi_ssid] = wifiLocationMapping[i].location;
                }

                // 1. create list of active-periods
                let eventPeriods = timeseriesObj.toEventPeriodTimeseries(
                    dataPoint => {return locationForWifi[dataPoint.ssid] == subfeature;},
                    dataPoint => {return locationForWifi[dataPoint.ssid] != subfeature;},
                    `LOCATION_${subfeature.toUpperCase()}`
                );
                // 2. convert to second amounts and accumulate to granularity
                let bins = eventPeriods.toBins(granularityMins, ACTIVE_PERIOD_LIMIT_THRESHOLD_SECS*1000, ACTIVE_PERIOD_LIMIT_SECS*1000);
                callback(bins);
            });


        });
    }

}
module.exports = HomeWorkTimeFeatureGenerator;