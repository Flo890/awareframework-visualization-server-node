let DbService = require('./dbService');

class DescrStateService {

    constructor(){
        this.dbService = new DbService();
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
    getTileDataForConfig(config, participantId, callback){
        // check for allowed accumulator (sql injection possible here)


        let dataMapping = require('../config/datamappings.json').mappings[config.featureName];

        this.dbService.getDeviceIdForParticipantId(participantId, deviceId => {
            this.dbService.queryForDescriptiveStatistics(dataMapping.sources, this.accumulatorToFnMapping[config.accumulator.function], deviceId, config.from, config.to, data => {
                data.config = config;
                callback(data);
            });
        });
    }

}
module.exports = DescrStateService;