class TimestampLogDataPoint {

    constructor(timestamp, values){
        this.timestamp = timestamp;
        values.forEach(aValue => {
           this[aValue.key] = aValue.value;
        });
    }

}
module.exports = TimestampLogDataPoint;