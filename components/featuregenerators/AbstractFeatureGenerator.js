class AbstractFeatureGenerator {

    constructor(dbService) {
        this.dbService = dbService;
    }

    /**
     *
     * @param featureName
     * @param deviceId
     * @param from
     * @param to
     * @param granularityMins
     * @param callback
     * @param subfeature (optional)
     */
    getData(featureName, deviceId, from, to, granularityMins, callback, subfeature){
        // overwrite this!
    }

    static getBinnedTimestampForGranularity(timestamp, granularityMins){
        var moment = require('moment');

        let dateformat = 'D_M_YYYY-H_m';
        if (granularityMins >= 60*24 && granularityMins % 60*24 == 0) {
            // one or more full days (no halve days like 32 hours etc.)
            dateformat = 'D_M_YYYY';

        } else if (granularityMins >= 60 && granularityMins % 60 == 0) {
            // if granularity is a full hour (1 hour, 3 hours, ...). halve-hours like 1,5 hours are not supported above 60 minutes, just below.
            let granularityHours = granularityMins/60;
            let dayTimestampFloored = this.getBinnedTimestampForGranularity(timestamp, 60*24);
            let timestampMillisInDay = timestamp - dayTimestampFloored;
            let binInDay = Math.floor(timestampMillisInDay/(granularityHours*60*60*1000));
            let timestampBinned = dayTimestampFloored + (binInDay*granularityHours*60*60*1000);
            return timestampBinned;

        } else if (granularityMins < 60) {
            let hourTimestampFloored = this.getBinnedTimestampForGranularity(timestamp, 60);
            let timestampMillisInHour = timestamp - hourTimestampFloored;
            let binInHour = Math.floor(timestampMillisInHour/(granularityMins*60*1000));
            let timestampBinned = hourTimestampFloored + (binInHour * granularityMins * 60 *1000);
            return timestampBinned;//dateformat = 'D_M_YYYY-H_m';
        }
        let timezoneOffset = 0;//7200;
        return (moment(moment.unix((timestamp/1000)).format(dateformat),dateformat).local().unix()+timezoneOffset)*1000;
    }



}
module.exports = AbstractFeatureGenerator;