class AbstractFeatureGenerator {

    constructor(dbService) {
        this.dbService = dbService;
    }

    getData(featureName, deviceId, from, to, granularityMins, callback){
        // overwrite this!
    }



}
module.exports = AbstractFeatureGenerator;