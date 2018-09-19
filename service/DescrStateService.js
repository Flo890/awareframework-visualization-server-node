let DbService = require('./dbService');
let FeatureFetcher = require('./FeatureFetcher');

class DescrStateService {

    constructor(){
        this.dbService = new DbService();
        this.featureFetcher = new FeatureFetcher();
        this.accumulatorToFnMapping = { // need this to prevent sql injection
            // a real accumulator is one like avg that computes a new value. Max instead does only select one of the existing values
            max: {fn:'max', isRealAccumulator: false},
            avg: {fn:'avg', isRealAccumulator: true}
        }
    }

    /**
     *
     * @param config e.g.:
     * {
				featureName: 'fatigue_level',
				from: 1535174664000,
				to: 1535216964000,
				accumulator: this.accumulators.MAX
			}
     * @param callback
     */
    getTileDataForConfig(config, participantId, participantEmail, callback){

        let dataMapping = require('../config/datamappings.json').mappings[config.featureName];

        this.dbService.getDeviceIdForParticipantId(participantId, deviceId => {
            if (dataMapping.sources) {
                // is usual feature
                this.dbService.queryForDescriptiveStatistics(dataMapping.sources, this.accumulatorToFnMapping[config.accumulator.function], (config.featureName == 'fatigue_level' ? participantEmail : deviceId), config.from, config.to, data => {
                    data.config = config;
                    callback(data);
                });
            }
            else if (dataMapping.feature_generator) {
                // is special feature
                let granularityMins = 10;
                this.featureFetcher.getGeneratedFeature(config.featureName, deviceId, config.from, config.to, granularityMins, data => {
                    // here the accumulation/selection has to be done manually :(
                    let accumulationMethod = this.accumulatorToFnMapping[config.accumulator.function];
                    let accumulatedDataObj = undefined;
                    if (accumulationMethod.isRealAccumulator) {
                        // calculation, e.g. average
                        switch(accumulationMethod.fn){
                            case 'avg':
                                accumulatedDataObj = {value: data.reduce((accumulator,aData) => accumulator+aData.value, 0)/ data.length};
                                break;
                            default:
                                console.error(`accumulator function ${accumulationMethod.fn} not implemented for generated Feature`);
                        }
                    }
                    else {
                        // selection, e.g. max
                        switch(accumulationMethod.fn){
                            case 'max':
                                accumulatedDataObj = data.reduce((accumulator,aData) => {return accumulator.value > aData.value ? accumulator : aData});
                                break;
                            default:
                                console.error(`accumulator function ${accumulationMethod.fn} not implemented for generated Feature`);
                        }
                    }
                    data.config = config;
                    callback([accumulatedDataObj]);
                });
            }
            else {
                // no mapping or feature generator found
                console.error(`no sources or feature generator found for ${config.featureName}`);
                callback(null);
            }
        });
    }

}
module.exports = DescrStateService;