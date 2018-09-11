let AbstractFeatureGenerator = require('./AbstractFeatureGenerator');
let FeatureFetcher = require('../../service/FeatureFetcher');

class SleepFeatureGenerator extends AbstractFeatureGenerator {

    getData(featureName, deviceId, from, to, granularityMins, callback, subfeature){

        if (granularityMins != 60*24) {
            console.warn('a granularity other than one day does not make sense for sleep feature. Reset to one day.');
            granularityMins = 60*24;
        }

        let featureFetcher = new FeatureFetcher();

        featureFetcher.getGeneratedFeature('phone_usage', deviceId, from, to, 10, phoneUsages => {
            featureFetcher.getUsualFeature('linear_accelerometer', deviceId, undefined, from, to, 10, phoneMovement => {
                let movements = phoneMovement.filter(aMovementData => {return aMovementData.value > 0.05});
                let mergedUsageData = [];
                mergedUsageData.push(...phoneUsages);
                mergedUsageData.push(...movements);


                // 0. remove 0-usages, sort the phone usages. order is not guaranteed yet
                mergedUsageData = mergedUsageData.filter(aUsage => {return aUsage.value > 0});
                mergedUsageData.sort((usage1,usage2) => {return usage1.timestamp-usage2.timestamp;});

                // 1. get first and last phone usage of a day
                let currentDayTimestamp = 0;
                let days = {}; // ->  {1234: {firstUsageTimestamp:1235, lastUsageTimestamp: 1240}}, ... }
                for(let i = 0; i<mergedUsageData.length; i++) {
                    let phoneUsagePeriodTimestamp = mergedUsageData[i].timestamp;
                    // shift timestamp by 4 hours, so that going to bed up 3:59 a.m. is still recognized
                    let shiftedTimestamp = phoneUsagePeriodTimestamp - (4*60*60*1000);
                    let phoneUsageDayTimestamp = AbstractFeatureGenerator.getBinnedTimestampForGranularity(shiftedTimestamp, 60*24);
                    if (phoneUsageDayTimestamp > currentDayTimestamp) {
                        // day switch. set the previous phone usage as last of the previous day
                        if (i>=1) {
                            let prevPhoneUsage = mergedUsageData[i - 1];
                            if (!days[currentDayTimestamp]) days[currentDayTimestamp] = {};
                            days[currentDayTimestamp].lastUsageTimestamp = prevPhoneUsage.timestamp + prevPhoneUsage.value * 1000;
                        }

                        currentDayTimestamp = phoneUsageDayTimestamp;

                        // and this phone usage as the first of this day
                        if (!days[currentDayTimestamp]) days[currentDayTimestamp] = {};
                        days[currentDayTimestamp].firstUsageTimestamp = phoneUsagePeriodTimestamp;
                    }
                }

                // 2. calculate sleep time for each day (regarding the night before that day)
                let sleeptimes = [];
                for(let i =0; i<Object.keys(days).length; i++){
                    let dayTimestamp = Object.keys(days)[i];

                    if (!days[dayTimestamp-(24*60*60*1000)]){
                        // previous day has no data
                        continue;
                    }

                    let sleepTimeMillis = days[dayTimestamp].firstUsageTimestamp - days[dayTimestamp-(24*60*60*1000)].lastUsageTimestamp;
                    sleeptimes.push({timestamp: Number(dayTimestamp), value: sleepTimeMillis/(1000*60*60)});
                }
                callback(sleeptimes);
            });
        });
    }

}
module.exports = SleepFeatureGenerator;