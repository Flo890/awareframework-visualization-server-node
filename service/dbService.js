let TimestampLogTimeseries = require('../components/featuregenerators/model/TimestampLogTimeseries');

class DbService {

    constructor(){
        var mysql = require('mysql');

        this.aware_data_connection = mysql.createConnection({
            host: "localhost",
            user: "root",
            password: "",
            database: "Bemmann_1"
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

    queryForAccumulatedData(sourceConfig, deviceId, from, to, granularityMins, dataCb){
        let granularityMillis = granularityMins * 60 * 1000;

        let selector = '"selector choice failed"';
        if (sourceConfig.sql_selector){
            selector = sourceConfig.sql_selector;
        }
        else if (sourceConfig.source_column && sourceConfig.reduce_method){
            selector = `${sourceConfig.reduce_method}(${sourceConfig.source_column})`;

        } else if (sourceConfig.source_column) {
            selector = `AVG(${sourceConfig.source_column})`;
        }

        let additionalWhereClause = '';
        if (sourceConfig.where_clause){
            additionalWhereClause = ` AND ${sourceConfig.where_clause}`;
        }

        this.aware_data_connection.query(
            `SELECT timestamp, ${selector} as value FROM ${sourceConfig.source_table} WHERE device_id=? AND timestamp>=? AND timestamp <=? ${additionalWhereClause} GROUP BY timestamp DIV ${granularityMillis} ORDER BY timestamp ASC;`
            , [deviceId, from, to]
            , (error,rows) => {
                if (error) console.error(error);
                dataCb(rows);
            }
        )
    }

    queryForAccumulatedDataAsObject(sourceConfig, deviceId, from, to, granularityMins, dataObjCb) {
        this.queryForAccumulatedData(sourceConfig, deviceId, from, to, granularityMins, data => {
            let timeseries = TimestampLogTimeseries.fromDataArray(data);
            dataObjCb(timeseries);
        });
    }
}
module.exports = DbService;