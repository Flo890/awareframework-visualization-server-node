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
                let className = this.datamappings.mappings[featureName].feature_generator;
                let DynamicFeatureGeneratorClass = require(`../components/featuregenerators/${className}`);
                let featureGenerator = new DynamicFeatureGeneratorClass(this.dbService);
                featureGenerator.getData(featureName, deviceId, from, to, granularityMins, dataCb);
            }

        });
    }

    getUsualFeature(featureName, deviceId, from, to, granularityMins, dataCb){
        let sources = this.datamappings.mappings[featureName].sources;
        // TODO helpful message if no matching mapping is set

        let promises = [];
            for(let i = 0; i<sources.length; i++) {
                promises.push(new Promise((resolve,reject) => {
                    this.dbService.queryForAccumulatedData(sources[i], deviceId, from, to, granularityMins, data => {
                        if (data.length > 0) {
                            resolve(data);
                        }
                    });
                }));
            }
            promises.push(new Promise(resolve => {setTimeout(()=>{
                resolve([]);
                console.warn('getUsualFeature promise timeout');
            },1000)})); // timeout promise
            Promise.race(promises).then(result => {dataCb(result)}).catch(error => {console.log(error)});
    }

}
module.exports = FeatureFetcher;