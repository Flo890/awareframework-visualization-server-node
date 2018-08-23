var AbstractFeatureGenerator = require('./AbstractFeatureGenerator');

class LinearAccelerometerFeatureGenerator extends AbstractFeatureGenerator {

    getData(featureName, deviceId, from, to, granularityMins, callback) {
        // TODO table name must be 'linear_accelerometer' !!
        this.dbService.queryForAccumulatedDataAsObject('accelerometer', 'double_values_0+double_values_1+double_values_2', deviceId, from, to, granularityMins, timestampLogTimeseries => {

        });

        // $date_format_parseable = $this->getParseableDateFormatForGranularity($granularity);
        // $current_bin_datetime = new DateTime(date($date_format_parseable,intval(round($data[0]['timestamp']/1000))));
        // $current_bin_timestamp = $current_bin_datetime->getTimestamp()*1000;
        //
        // // build a list of all accelerometer measures for each bin
        // $all_accelero_bins = array();
        // $a_accelero_bin = array();
        // for($i = 0; $current_bin_timestamp <= $data[sizeof($data)-1]['timestamp'] && isset($data[$i]); $i++){
        //     if (!isset($data[$i]) || $data[$i]['timestamp'] >= $current_bin_timestamp + $this->getMillisOfGranularity($granularity)) {
        //         // next bin
        //         $all_accelero_bins[date($date_format,intval(round($current_bin_timestamp/1000)))] = $a_accelero_bin;
        //         $current_bin_timestamp += $this->getMillisOfGranularity($granularity);
        //         if (isset($data[$i])) $a_accelero_bin = array();
        //     }
        //     if (isset($data[$i])) array_push($a_accelero_bin, $data[$i]['axis_sum']);
        // }
        //
        // // reduce with descriptive statistics
        // $reduced_bins = array();
        // foreach($all_accelero_bins as $time_key => $a_bin){
        //     $mean_abs = array_sum(array_map(function($val){return abs($val);}, $a_bin))/sizeof($a_bin);
        //     $variance = array_sum(array_map(function($value) use (&$mean_abs) {
        //         return pow((abs($value) - $mean_abs),2);
        //     },$a_bin))/sizeof($a_bin);
        //     $reduced_bins[$time_key] = array(
        //         'max_abs' => max(array_map(function($val){return abs($val);},$a_bin)),
        //         'min_abs' => min(array_map(function($val){return abs($val);},$a_bin)),
        //         'mean_abs' => $mean_abs,
        //         'variance' => $variance
        // );
        // }
        //
        // return $reduced_bins;
    }

}
module.exports = LinearAccelerometerFeatureGenerator;