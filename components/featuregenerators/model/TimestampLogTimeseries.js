let TimestampLogDataPoint = require('./TimestampLogDataPoint');
let PeriodTimeseries = require('./PeriodTimeseries');

class TimestampLogTimeseries {

    constructor(timestampLogDataPoints, binGranularityMins){
        this.timestampLogDataPoints = timestampLogDataPoints;
        this.timestampLogDataPoints.sort((datapoint1,datapoint2) => {return datapoint1.timestamp-datapoint2.timestamp});
        this.binGranularityMins = binGranularityMins;
    }

    static fromDataArray(data){
        let timestampLogDataPoints = data.map(aDataItem => {
            return new TimestampLogDataPoint(
                aDataItem.timestamp,
                Object.keys(aDataItem).filter(aKey => {return aKey != 'timestamp';}).map(aKey => {
                    return {
                        key: aKey,
                        value: aDataItem[aKey]
                    };
                }));
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
            if(!binnedLists[AbstractFeatureGenerator.getBinnedTimestampForGranularity(datapoint.timestamp)]){
                binnedLists[AbstractFeatureGenerator.getBinnedTimestampForGranularity(datapoint.timestamp)] = [];
            }
            binnedLists[AbstractFeatureGenerator.getBinnedTimestampForGranularity(datapoint.timestamp)].push(datapoint.value);
        }

        let accumulatedBins = [];
        Object.keys(binnedLists).forEach(aBinTimestamp => {
            accumulatedBins.push({timestamp: aBinTimestamp, value: binnedLists[aBinTimestamp].reduce(reduceFunction)});
        });

        accumulatedBins.sort((bin1,bin2) => {return bin1.timestamp-bin2.timestamp});

        return new TimestampLogTimeseries(accumulatedBins, granularityMins);
    }



    /**
     *
     * @param timestampSearchAfter in millis
     * @param matchesCriteria a function of types  TimestampLogDataPoint -> boolean   , returning true if this datapoint should be returned
     * @return the next TimestampLogDataPoint which is later than timestampSearchAfter, and matches the defined criteria
     */
    getNextDatapoint(timestampSearchAfter, matchesCriteria){
        for (let i = 0; i<this.timestampLogDataPoints.length; i++) {
            let currentDataPoint = this.timestampLogDataPoints[i];

            if (currentDataPoint.timestamp <= timestampSearchAfter) continue;
            if (!matchesCriteria(currentDataPoint)) continue;
            return currentDataPoint;
        }
    }

    /**
     * to create a list of periods. a period is a timespan between a starting event and an ending event
     * @param isStartingEvent function returning true, if a given datapoint is the startevent of a period
     * @param isEndingEvent function returning true, if a given datapoint is the endevent of a period
     * @param eventName to be set in the period object
     * @return a PeriodTimeseries object
     */
    toEventPeriodTimeseries(isStartingEvent, isEndingEvent, eventName) {
        let screenOnOrUnlockedTimes = []; // -> [{timestampOn:1234, timestampOff: 1236}, ... ]
        let lastOffTimestamp = 0;
        for(let i = 0; i<this.timestampLogDataPoints.length; i++){
            let dataPoint = this.timestampLogDataPoints[i];
            // if this data point has screen state on or unlocked
            if (
                isStartingEvent(dataPoint) // 1. this is a screen on/unlocked event
                && dataPoint.timestamp > lastOffTimestamp // 2. this timestamp is later than the end of the last active period
            ) {
                // get next datapoint after the current one, who's state is screen off or locked
                let nextOffDatapoint = this.getNextDatapoint(dataPoint.timestamp, isEndingEvent);

                if (nextOffDatapoint) {
                    screenOnOrUnlockedTimes.push({
                        startTimestamp: dataPoint.timestamp,
                        endTimestamp: nextOffDatapoint.timestamp,
                        event: eventName
                    });
                    lastOffTimestamp = nextOffDatapoint.timestamp;
                }
            }
        }

        return new PeriodTimeseries(screenOnOrUnlockedTimes);
    }

}
module.exports = TimestampLogTimeseries;