var DbService = require("./dbService");

class FeatureFetcher {

    constructor(){
        this.dbService = new DbService();
        this.datamappings = require('../config/datamappings.json');
    }

    getFeature(participantId, featureName, from, to, granularityMins, dataCb){
        this.dbService.getDeviceIdForParticipantId(participantId, deviceId => {

            if(this.datamappings.mappings[featureName].sources) {
                // is a usual feature
                this.getUsualFeature(featureName, deviceId, from, to, granularityMins, dataCb)
            }

            else if(this.datamappings.mappings[featureName].feature_generator){
                // is special feature with generator class
                this.getGeneratedFeature(featureName, deviceId, from, to, granularityMins, dataCb);
            }

        });
    }

    getUsualFeature(featureName, deviceId, from, to, granularityMins, dataCb){
        let sources = this.datamappings.mappings[featureName].sources;
        // TODO helpful message if no matching mapping is set


        new Promise((resolveDataFound,reject) => {
            let sourcePromises = []; // when all source promises are done, we know that we have the final result. If now there's new data in the outer promise, we can return []
            for(let i = 0; i<sources.length; i++) {
                sourcePromises.push(new Promise((resolveSource, rejectSource) => {
                    this.dbService.queryForAccumulatedData(sources[i], deviceId, from, to, granularityMins, data => {
                        if (data.length > 0) {
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

}
module.exports = FeatureFetcher;