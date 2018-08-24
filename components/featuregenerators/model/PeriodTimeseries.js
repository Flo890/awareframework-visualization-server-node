var TimestampLogTimeseries = require('./TimestampLogTimeseries');

/**
 * represents a timeseries of periods, e.g. the list screen-on periods
 */
class PeriodTimeseries {

    /**
     *
     * @param eventPeriods [ {startTimestamp: 1234, endTimestamp: 1236, event: 'screen_on'} ... ]
     */
    constructor(eventPeriods){
        this.eventPeriod = eventPeriods;
    }

    /**
     *
     * @param granulartiyMins interval between the bins / timestamps
     * @param periodLengthLimitThresholdMillis if a period is longer than this, the period will be cut down to periodLengthLimit seconds
     * @param periodLengthLimitMillis
     * @return something like [{timestamp: 1230, value: 23}, {timestamp: 1235, value: 3}, ... ]
     *
     */
    toBins(granulartiyMins, periodLengthLimitThresholdMillis, periodLengthLimitMillis){
        if(this.eventPeriod.length == 0){
            return [];
        }

        let firstBinnedTimestamp = TimestampLogTimeseries.getBinnedTimestampForGranularity(this.eventPeriod[0].startTimestamp, granulartiyMins);
        let lastPeriodEnd = this.eventPeriod[this.eventPeriod.length-1].endTimestamp;

        // 1. create empty bins
        let binsKeyed = {};
        let currentBinnedTimestamp = firstBinnedTimestamp;
        while (currentBinnedTimestamp < lastPeriodEnd) {
            let endOfCurrentBin = currentBinnedTimestamp + (granulartiyMins*60*1000);
            // create bin if not exists
            if (!binsKeyed[currentBinnedTimestamp]){
                binsKeyed[currentBinnedTimestamp] = {timestamp: currentBinnedTimestamp, value: 0};
            }

            // go to next bin
            currentBinnedTimestamp = endOfCurrentBin;
        }

        // 2. split periods over bins
        for (let i = 0; i<this.eventPeriod.length; i++) {
            let currentPeriod = this.eventPeriod[i];
            let binnedTimestampOfPeriod =  TimestampLogTimeseries.getBinnedTimestampForGranularity(currentPeriod.startTimestamp, granulartiyMins);

            let millisToAdd = currentPeriod.endTimestamp - currentPeriod.startTimestamp;
            if (millisToAdd > periodLengthLimitThresholdMillis) {
                millisToAdd = periodLengthLimitMillis;
            }

            let fitsInOneBin = currentPeriod.endTimestamp <= binnedTimestampOfPeriod+(granulartiyMins*60*1000);
            if (fitsInOneBin) {
                binsKeyed[binnedTimestampOfPeriod].value += (millisToAdd)/1000;

            } else {
                let endOfCurrentBin = (binnedTimestampOfPeriod + (granulartiyMins*60*1000));
                let millisInThisBin = (endOfCurrentBin - currentPeriod.startTimestamp);
                binsKeyed[binnedTimestampOfPeriod].value += (millisInThisBin/1000);
                let restMillis = millisToAdd - millisInThisBin;

                let currentBin = binnedTimestampOfPeriod;
                while(restMillis > 0) {
                    // get next bin
                    currentBin += (granulartiyMins*60*1000);

                    let millisToAdd = (Math.min((granulartiyMins*60*1000), restMillis));
                    binsKeyed[currentBin].value += millisToAdd/1000;

                    restMillis -= millisToAdd;
                }
            }
        }

        // 3. return array without keys
        return Object.values(binsKeyed);
    }

}
module.exports = PeriodTimeseries;