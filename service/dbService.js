let TimestampLogTimeseries = require('../components/featuregenerators/model/TimestampLogTimeseries');

class DbService {

    constructor(){
        var mysql = require('mysql');

        this.aware_data_connection = mysql.createConnection({
            host: "localhost",
            user: "root",
            password: "",
            database: "Bemmann_1_23_08_evening"
        });
        this.aware_data_connection.connect(function(err) {
            if (err) throw err;
            console.log("Connected!");
        });

        this.meta_connection = mysql.createConnection({
            host: "localhost",
            user: "root",
            password: "",
            database: "aware_metadb"
        });
        this.meta_connection.connect(function(err) {
            if (err) throw err;
            console.log("Connected!");
        });
    };

    getDeviceIdForParticipantId(participantId, callback) {
        this.meta_connection.query('SELECT device_id FROM study_participants WHERE participant_id=?', [participantId], function(err, rows) {
            if (err) console.error(err);
            callback(rows[0].device_id);
        });
    };

    /**
     *
     * @param sourceConfig object with properties:
     *      - source_table (required)
     *      - one of: sql_selector OR source_column (in case of the latter, also reduce_method can be set)
     * @param deviceId
     * @param from
     * @param to
     * @param granularityMins
     * @param dataCb
     */
    queryForAccumulatedData(sourceConfig, deviceId, from, to, granularityMins, dataCb){

        if (!sourceConfig.source_table) {
            console.error('you must set sourceConfig.source_table!');
        }

        let selector = '"selector choice failed"';
        if (sourceConfig.sql_selector){
            selector = sourceConfig.sql_selector;
        }
        else if (sourceConfig.source_column && sourceConfig.reduce_method){
            selector = `${sourceConfig.reduce_method}(${sourceConfig.source_column}) as value`;

        } else if (sourceConfig.source_column) {
            selector = `AVG(${sourceConfig.source_column}) as value`;
        } else {
            console.warn('in sourceConfig you should set one of sql_selector or source_column');
        }

        let additionalWhereClause = '';
        if (sourceConfig.where_clause){
            additionalWhereClause = ` AND ${sourceConfig.where_clause}`;
        }

        let groupClause = '';
        if (granularityMins > 0){
            let granularityMillis = granularityMins * 60 * 1000;
            groupClause = `GROUP BY timestamp DIV ${granularityMillis}`;
        }

        this.aware_data_connection.query(
            `SELECT timestamp, ${selector} FROM ${sourceConfig.source_table} WHERE device_id=? AND timestamp>=? AND timestamp <=? ${additionalWhereClause} ${groupClause} ORDER BY timestamp ASC;`
            , [deviceId, from, to]
            , (error,rows) => {
                if (error) console.error(error);
                dataCb(rows);
            }
        )
    }

    /**
     *
     * @param sourceConfig
     * @param deviceId
     * @param from
     * @param to
     * @param granularityMins accumulation interval. use 0 to return unaccumulated rows
     * @param dataObjCb
     */
    queryForAccumulatedDataAsObject(sourceConfig, deviceId, from, to, granularityMins, dataObjCb) {
        this.queryForAccumulatedData(sourceConfig, deviceId, from, to, granularityMins, data => {
            let timeseries = TimestampLogTimeseries.fromDataArray(data);
            dataObjCb(timeseries);
        });
    }
}
module.exports = DbService;