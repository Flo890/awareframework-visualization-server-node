var DbService = require("./dbService");

class FeatureFetcher {

    constructor(){
        this.dbService = new DbService();
        this.datamappings = require('../config/datamappings.json');
    }

    getFeature(participantId, email, featureName, from, to, granularityMins, dataCb){
        this.dbService.getDeviceIdForParticipantId(participantId, deviceId => {

            if(this.datamappings.mappings[featureName].sources) {
                // is a usual feature
                this.getUsualFeature(featureName, deviceId, email, from, to, granularityMins, dataCb)
            }

            else if(this.datamappings.mappings[featureName].feature_generator){
                // is special feature with generator class
                this.getGeneratedFeature(featureName, deviceId, from, to, granularityMins, dataCb);
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
                                this.upsampleData(data,granularityMins);
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
        featureGenerator.getData(featureName, deviceId, from, to, granularityMins, dataCb, this.datamappings.mappings[featureName].subfeature);
    }

    upsampleData(data, targetGranularityMins){
        for(let i = 0; i<data.length-1; i++) {
            let timediffToNext = data[i+1].timestamp - data[i].timestamp;
            if (timediffToNext == 60*60*1000) {
                // if data granularity is hourly (for RescueTime the maximum) upsample this gap to target granularity
                let prevRealTimestamp = data[i].timestamp;
                for(let j = 0; j<timediffToNext/(targetGranularityMins*60*1000); j++) {
                    let newObject = {
                        timestamp: prevRealTimestamp + (targetGranularityMins*60*1000*(j+1)),
                        value: (data[i + 1].value + data[i].value) / 2
                    }
                    data.splice(i+1, 0, newObject);
                    i++;
                }
            }
        }
    }

}
module.exports = FeatureFetcher;