let TimestampLogDataPoint = require('./TimestampLogDataPoint');

class TimestampLogTimeseries {

    constructor(timestampLogDataPoints, binGranularityMins){
        this.timestampLogDataPoints = timestampLogDataPoints;
        this.binGranularityMins = binGranularityMins;
    }

    static fromDataArray(data){
        let timestampLogDataPoints = data.map(aDataItem => {
            return new TimestampLogDataPoint(aDataItem.timestamp, aDataItem.value);
        });
        return new TimestampLogTimeseries(timestampLogDataPoints, 0);
    }

    /**
     * creates a new version of this object, with a lower granularity (= a higher granulartiyMins value)
     * @param granularityMins must be a higher value than this.binGranularityMins
     * @param reduceFunction a function used to accumulate the values of the single datapoints belonging to one bin
     */
    createReducedGranularityTimeseries(granularityMins, reduceFunction){
        // the new granularityMins value must be higher, we cannot upsample
        if (granularityMins <= this.binGranularityMins){
            console.error(`createReducedGranularityTimeseries(): cannot convert granularity from ${this.binGranularityMins} to ${granularityMins}`)
        }

        // downsample to new granularity:
        let binnedLists = {}; // => {1234:[234,3,65], 1235:[234,32], ...}
        for(let i = 0; i<this.timestampLogDataPoints; i++){
            datapoint = this.timestampLogDataPoints[i];
            if(!binnedLists[TimestampLogTimeseries.getBinnedTimestampForGranularity(datapoint.timestamp)]){
                binnedLists[TimestampLogTimeseries.getBinnedTimestampForGranularity(datapoint.timestamp)] = [];
            }
            binnedLists[TimestampLogTimeseries.getBinnedTimestampForGranularity(datapoint.timestamp)].push(datapoint.value);
        }

        let accumulatedBins = [];
        Object.keys(binnedLists).forEach(aBinTimestamp => {
            accumulatedBins.push({timestamp: aBinTimestamp, value: binnedLists[aBinTimestamp].reduce(reduceFunction)});
        });

        accumulatedBins.sort((bin1,bin2) => {return bin1.timestamp-bin2.timestamp});

        return new TimestampLogTimeseries(accumulatedBins, granularityMins);
    }

    static getBinnedTimestampForGranularity(timestamp, granularityMins){
        var moment = require('moment');

        if (granularityMins >= 60*24 && granularityMins % 60*24 == 0) {
            // one or more full days (no halve days like 32 hours etc.)
            let dateformat = 'D_M_YYYY';

        } else if (granularityMins >= 60 && granularityMins % 60 == 0) {
            // if granularity is a full hour (1 hour, 3 hours, ...). halve-hours like 1,5 hours are not supported above 60 minutes, just below.
            let granularityHours = granularityMins/60;
            let dayTimestampFloored = this.getBinnedTimestampForGranularity(timestamp, 60*24);
            let timestampMillisInDay = timestamp - dayTimestampFloored;
            let binInDay = timestampMillisInDay/(granularityHours*60*60*1000);
            let timestampBinned = dayTimestampFloored + (binInDay*granularityHours*60*60*1000);
            return timestampBinned;

        } else if (granularityMins < 60) {
            let dateformat = 'D_M_YYYY-H_m';
        }
        return moment.parse(moment(timestamp).format(dateformat),dateformat).unix()*1000;
    }

}
module.exports = TimestampLogTimeseries;