var DbService = require("./dbService");

class FeatureFetcher {

    constructor(){
        this.dbService = DbService.getInstance();
        this.datamappings = require('../config/datamappings.json');
    }

    getFeature(participantId, email, featureName, from, to, granularityMins, dataCb){
        this.dbService.getDeviceIdForParticipantId(participantId, deviceId => {

            let intermediateCb = data => {
                if (this.datamappings.mappings[featureName].divisor) {
                   for(let i=0; i<data.length; i++){
                        data[i].value = data[i].value/this.datamappings.mappings[featureName].divisor;
                   }
                }
                dataCb(data);
            };

            if(this.datamappings.mappings[featureName].sources) {
                // is a usual feature
                this.getUsualFeature(featureName, deviceId, email, from, to, granularityMins, intermediateCb)
            }

            else if(this.datamappings.mappings[featureName].feature_generator){
                // is special feature with generator class
                this.getGeneratedFeature(featureName, deviceId, from, to, granularityMins, intermediateCb);
            }

        });
    }

    getUsualFeature(featureName, deviceId, email, from, to, granularityMins, dataCb){
        let sources = this.datamappings.mappings[featureName].sources;
        // TODO helpful message if no matching mapping is set


        new Promise((resolveDataFound,reject) => {
            let sourcePromises = []; // when all source promises are done, we know that we have the final result. If now there's new data in the outer promise, we can return []
            for(let i = 0; i<sources.length; i++) {
                sourcePromises.push(new Promise((resolveSource, rejectSource) => {
                    let deviceIdOrEmail = sources[i].source_table == 'performetric_fatigue_report' ? email : deviceId;
                    this.dbService.queryForAccumulatedData(sources[i], deviceIdOrEmail, from, to, granularityMins, data => {
                        if (data && data.length > 0) {
                            // TODO another bad architecture thing
                            // RescueTime data is hourly, so we have to upsample it if granularity is higher than 60 minutes
                            if (granularityMins < 60 && sources[i].source_table == 'rescuetime_usage_log') {
                                this.upsampleData(data, 60, granularityMins, (data1,data2) => (data2.value + data1.value) / 2);
                            }
                            // weather: if temperature is in Kelvin, convert it to Celsius
                            if (featureName == 'temperature'){
                                this.ensureCelsius(data);
                            }

                            resolveDataFound(data);
                        }
                        resolveSource();
                    });
                }));
            }
            Promise.all(sourcePromises).then(result => {
                resolveDataFound([]); // when all sources are done, return empty array, for the case that no data was found
            })
        }).then(result => {dataCb(result)}).catch(error => {console.log(error)});
    }


    getGeneratedFeature(featureName, deviceId, from, to, granularityMins, dataCb){
        let className = this.datamappings.mappings[featureName].feature_generator;
        let DynamicFeatureGeneratorClass = require(`../components/featuregenerators/${className}`);
        let featureGenerator = new DynamicFeatureGeneratorClass(this.dbService);
        featureGenerator.getData(featureName, deviceId, from, to, granularityMins, data => {
            if (granularityMins < 60*24 && granularityMins > 0 && featureName == 'sleep') {
                this.upsampleData(data, 60*24, granularityMins, (data1, data2) => data1.value);
            }
            dataCb(data);
        }, this.datamappings.mappings[featureName].subfeature);
    }

    /**
     * increases the granularity of a result dataset by adding points in a regular interval between the existing ones
     * @param data something like [{timestamp: 1234, value: 42}, {...}, ...]
     * @param currentGranularityMins granularity of the dataset given in data property
     * @param targetGranularityMins target granularity, which the object passed in the data property will have after this call
     * @param interpolationFn the interpolation function:  data1, data3 => value2    where, each datax object is a {timestamp:1234, value:42} like object, and value2 is only the value!
     */
    upsampleData(data, currentGranularityMins, targetGranularityMins, interpolationFn){
        for(let i = 0; i<data.length-1; i++) {
            let timediffToNext = data[i+1].timestamp - data[i].timestamp;
            if (timediffToNext == currentGranularityMins*60*1000) {
                // if data granularity is hourly (for RescueTime the maximum) upsample this gap to target granularity
                let prevRealTimestamp = data[i].timestamp;
                for(let j = 0; j<timediffToNext/(targetGranularityMins*60*1000); j++) {
                    let newObject = {
                        timestamp: Number(prevRealTimestamp) + (targetGranularityMins*60*1000*(j+1)),
                        value: interpolationFn(data[i],data[i+1])
                    }
                    data.splice(i+1, 0, newObject);
                    i++;
                }
            }
        }
    }

    ensureCelsius(data){
        for(let i = 0; i<data.length; i++){
            if (data[i].value > 100) {
                data[i].value -= 273.15;
            }
        }
    }

}
module.exports = FeatureFetcher;