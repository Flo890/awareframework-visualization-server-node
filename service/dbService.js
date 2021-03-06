let TimestampLogTimeseries = require('../components/featuregenerators/model/TimestampLogTimeseries');
let dbConfigs = require('../config/databases.json');
const md5 = require('md5');


class DbService {

    static getInstance(){
        if (!DbService.instance){
            DbService.instance = new DbService();
        }
        return DbService.instance;
    }

    constructor(callback){
        var mysql = require('mysql');

        let awareDbConnectPromise = new Promise(resolve => {
            this.aware_data_connection = mysql.createConnection({
                host: dbConfigs.aware_study_database.host,
                user: dbConfigs.aware_study_database.username,
                password: dbConfigs.aware_study_database.password,
                database: dbConfigs.aware_study_database.database
            });
            this.aware_data_connection.connect(function (err) {
                if (err) throw err;
                console.log("Connected!");
                resolve();
            });
        });

        let metaDbConnectPromise = new Promise(resolve => {
            this.meta_connection = mysql.createConnection({
                host: dbConfigs.meta_database.host,
                user: dbConfigs.meta_database.username,
                password: dbConfigs.meta_database.password,
                database: dbConfigs.meta_database.database
            });
            this.meta_connection.connect(function (err) {
                if (err) throw err;
                console.log("Connected!");
                resolve();
            });
        });

        Promise.all([awareDbConnectPromise, metaDbConnectPromise]).then(() => {
            if (callback) callback();
        }).catch(error => {
            console.error(`connecting to db failed`, error);
        });
    };

    /**
     * @deprecated use {@see getUserByParticipantId}
     * @param participantId
     * @param callback
     */
    getDeviceIdForParticipantId(participantId, callback) {
        this.meta_connection.query('SELECT device_id FROM study_participants WHERE participant_id=?', [participantId], function(err, rows) {
            if (err) console.error(err);
            callback(rows[0].device_id);
        });
    };

    getUserByParticipantId(participantId, callback) {
        this.meta_connection.query('SELECT _id as id,device_id,participant_id,password,rescuetime_api_key FROM study_participants WHERE participant_id=?', [participantId], function(err, rows) {
            if (err) {
                console.error('could not fetch participant',err);
                callback(err,null);
            } else {
                callback(null, rows[0]);
            }
        });
    }

    getUserById(id, callback) {
        this.meta_connection.query('SELECT _id as id,device_id,participant_id,password FROM study_participants WHERE _id=?', [id], function(err, rows) {
            if (err) {
                console.error('could not fetch participant',err);
                callback(err,null);
            } else {
                callback(null, rows[0]);
            }
        });
    }

    addUser(participantId, password, deviceId, rescueTimeApiKey, callback) {
        this.meta_connection.query('INSERT INTO study_participants (device_id,participant_id,password,rescuetime_api_key) VALUES(?,?,?,?)', [deviceId,participantId,password,rescueTimeApiKey], function(err, rows) {
            if (err){
                console.error(err);
                callback(err,null);
            } else {
                if (rows.affectedRows != 1) console.error(`adding new user: affectedRows was not 1 but ${rows.affectedRows}`);

                callback(null, rows.insertId);
            }
        });
    }

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
    async queryForAccumulatedData(sourceConfig, deviceId, from, to, granularityMins, dataCb){

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
        let timestampSelectClause = 'timestamp';
        if (granularityMins > 0){
            let granularityMillis = granularityMins * 60 * 1000;
            groupClause = `GROUP BY timestamp DIV ${granularityMillis}`;
            timestampSelectClause = `((timestamp DIV ${granularityMillis})*${granularityMillis}) as timestamp`;
        }

        // TODO this lookup here is bad architecture
        let apikeyHash = await new Promise((resolve) => {
            if (sourceConfig.source_table == 'rescuetime_usage_log'){
                this.meta_connection.query('SELECT rescuetime_api_key FROM study_participants WHERE device_id=?;',[deviceId], (err,rows) => {
                    let apikeyHash = 'does not exist';
                    if (err) {
                        console.error(err);
                    } else if (rows.length == 0 || rows[0].rescuetime_api_key == null) {
                        // value stays 'does not exist', so no data will be found later
                    } else {
                        apikeyHash = md5(rows[0].rescuetime_api_key);
                    }
                    resolve(apikeyHash);
                });
            } else {
                resolve(undefined);
            }
        });

        let whereDeviceIdClause = 'device_id=? AND';
        let parameters = [deviceId, from, to];
        if (apikeyHash != undefined) {
            additionalWhereClause += ` AND apikey_hash='${apikeyHash}' `;
            whereDeviceIdClause = '';
            parameters = [from, to];
        }
        // TODO ugly workaround
        if (sourceConfig.source_table == 'plugin_openweather'){
            whereDeviceIdClause = '(device_id=? OR device_id="server") AND'; // also consider server-loaded weather data
        }
        this.aware_data_connection.query(
            `SELECT ${timestampSelectClause}, ${selector} FROM ${sourceConfig.source_table} WHERE ${whereDeviceIdClause} timestamp>=? AND timestamp <=? ${additionalWhereClause} ${groupClause} ORDER BY timestamp ASC;`
            , parameters
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
        this.queryForAccumulatedData(sourceConfig, deviceId, from, to, granularityMins, async data => {
            let timeseries = TimestampLogTimeseries.fromDataArray(await data);
            dataObjCb(timeseries);
        });
    }

    getWifiLocationMappings(deviceId, callback){
        this.meta_connection.query(
            `SELECT wifi_ssid, location FROM wifi_location WHERE device_id=?;`
            , [deviceId]
            , (error,rows) => {
                if (error) console.error(error);
                callback(rows);
            }
        )
    }

    getNotes(participantId, visualization, callback){
        this.meta_connection.query(`SELECT * FROM notes WHERE participant_id=? AND visualization=?`,[participantId, visualization],(error,rows) => {
           if (error) console.error(error);
           callback(rows);
        });
    }

    saveTimelineNote(participantId, visualization, noteText, timelineConfig, callback){
        this.meta_connection.query(`INSERT INTO notes (participant_id, visualization, note_text, timeline_config) VALUES (?,?,?,?)`,[participantId, visualization, noteText, timelineConfig],(error,rows) => {
            if (error) console.error(error);
            callback(rows.affectedRows == 1 ? true : false);
        });
    }

    queryForDescriptiveStatistics(sources, accumulationMethod, deviceId, from, to, callback){
        let tableQueries = sources.map(source => {

            let selector = '"selector choice failed"';
            if (source.sql_selector){
                selector = source.sql_selector;
            }
            else if (source.source_column) {
                selector = `${source.source_column} as value`;
            } else {
                console.warn('in sourceConfig you should set one of sql_selector or source_column');
            }

            return `SELECT ${selector}, timestamp FROM ${source.source_table} WHERE device_id=? AND timestamp>=? AND timestamp<=?`
        });
        let entriesQuery = tableQueries.join(" UNION ");
        let maxValueSubquery = `SELECT ${accumulationMethod.fn}(value) as value FROM (${entriesQuery}) as unionedTable2`
        let query = `SELECT value,timestamp as timestamp FROM (${entriesQuery}) as unionedTable1 WHERE value = ?;`

        let parameterBunch = [deviceId,from,to];
        let parameters = [];
        for(let i = 0; i<tableQueries.length; i++){
            parameters.push(...parameterBunch);
        }
        // first query selects the accumulated value
        this.aware_data_connection.query(maxValueSubquery,parameters,(error,rows)=>{
            if (error) throw error;

            if (accumulationMethod.isRealAccumulator) {
                callback(rows);
            } else {
                // second query (only for accumulators that are more like selecting one datapoint instead of calculating, e.g. min,max)
                parameters.push(rows[0].value);
                this.aware_data_connection.query(query, parameters, (error, rows) => {
                    if (error) throw error;
                    callback(rows);
                });
            }
        });

    }

    persistConfig(participantId, configKey, configObject, callback){
        this.meta_connection.query('INSERT INTO dashboard_configs (participant_id,config_key,config_object,updated_at) VALUES(?,?,?,NOW()) ON DUPLICATE KEY UPDATE config_object=?, updated_at=NOW();',
            [participantId, configKey, JSON.stringify(configObject), JSON.stringify(configObject)],
            (err,rows) => {
                if (err) {
                    console.error('upserting dashboard config failed',err);
                } else if (rows.affectedRows != 1) {
                    console.error(`upserting dashboard config: affected rows count was not 1 but ${rows.affectedRows}`);
                }
                callback();
        });
    }

    getAllDashboardConfigs(participantId, callback){
        this.meta_connection.query('SELECT config_key, config_object FROM dashboard_configs WHERE participant_id=?;',
            [participantId], (err,rows) => {
                if (rows && rows.length > 0) {
                    let configs = {};
                    for(let i = 0; i<rows.length; i++) {
                        configs[rows[i].config_key] = rows[i].config_object;
                    }
                    callback(configs);
                } else {
                    callback({});
                }
            });
    }

    /**
     *
     * @param deviceId
     * @param callback  is called with either 'ios' or 'android'
     */
    getOsType(deviceId, callback){
        this.aware_data_connection.query('SELECT * FROM aware_device WHERE device_id=?;',[deviceId], (err,rows) => {
           if (err) {
               console.error(err);
               callback(undefined);
           }
           else if (rows.length < 1) {
               console.error(`could not find aware_device entry for device_id ${deviceId}`);
               callback(undefined);
           }
           else {
               if (rows[0].board == 'Apple' || rows[0].brand.includes('iPhone') || rows[0].device.includes('iPhone')) {
                   callback('ios');
               } else {
                   callback('android');
               }
           }
        });
    }

    saveNlCorrelation(correlation, participantId, cb){
        this.meta_connection.query(
            'INSERT INTO nl_correlations ' +
            '(participant_id,feature_one,feature_two,domain_one,domain_two,`from`,`to`,p_value,correlation_coefficient,sentence,relevance_score)' +
            'VALUES(?,?,?,?,?,?,?,?,?,?,?) ' +
            ' ON DUPLICATE KEY UPDATE p_value=?, correlation_coefficient=?, sentence=?, updated_at=NOW(), relevance_score=?;',
            [
                participantId,
                correlation.featureOne,
                correlation.featureTwo,
                correlation.domainOne,
                correlation.domainTwo,
                correlation.from,
                correlation.to,
                correlation.pValue,
                correlation.correlationCoefficient,
                correlation.sentence,
                correlation.relevanceScore,
                correlation.pValue,
                correlation.correlationCoefficient,
                correlation.sentence,
                correlation.relevanceScore
            ],
            (err,rows) => {
                if (err) console.error('saving correlation failed',err);
                cb();
            }
        );
    }

    /**
     *
     * @param participantId
     * @param from may be null
     * @param to may be null
     * @param topN may be null
     * @param cb
     */
    getCorrelationsForUser(participantId, from, to, topN, cb){
        let whereClause = '';
        if (from) {
            whereClause += ` AND \`from\`>=${from}`;
        }
        if (to) {
            whereClause += ` AND \`to\`<=${to}`;
        }
        let limitClause = '';
        if (topN) {
            limitClause += ` LIMIT ${topN}`;
        }
        this.meta_connection.query(
            `SELECT * FROM nl_correlations 
            WHERE participant_id=? ${whereClause} 
            AND NOT EXISTS (
               SELECT * FROM nl_correlations_hide_rules 
               WHERE nl_correlations_hide_rules.correlation_id=nl_correlations._id 
               OR nl_correlations_hide_rules.feature=nl_correlations.feature_one
               OR nl_correlations_hide_rules.feature=nl_correlations.feature_two
            )
            ORDER BY relevance_score DESC, p_value ASC ${limitClause};`,
            [participantId],
            (err,rows) => {
                if (err) {
                    console.error(`fetching correlations for participant ${participantId} failed`,err);
                    cb([]);
                }
                else {
                    cb(rows);
                }
        });
    }

    insertHideCorrelationById(correlationId, participantId, cb){
        this.meta_connection.query('INSERT INTO nl_correlations_hide_rules ' +
            '(participant_id,correlation_id) VALUES(?,?) ON DUPLICATE KEY UPDATE updated_at=NOW();',
            [participantId, correlationId],
            (err,rows) => {
                if (err) console.error(`inserting correlation hide by id failed for participant ${participantId} / correlation ${correlationId}`,err);
                cb();
            });
    }

    insertHideCorrelationByFeature(feature, participantId, cb){
        this.meta_connection.query('INSERT INTO nl_correlations_hide_rules ' +
            '(participant_id,feature) VALUES(?,?) ON DUPLICATE KEY UPDATE updated_at=NOW();',
            [participantId, feature],
            (err,rows) => {
                if (err) console.error(`inserting correlation hide by id failed for participant ${participantId} / feature ${feature}`,err);
                cb();
            });
    }

    saveCurrentWeather(timestamp, deviceId, city, temperature, temperatureMax, temperatureMin, unit, humidity, pressure, windSpeed, windDegrees, cloudiness, rain, snow, sunrise, sunset, weatherIconId, weatherDescription, cb){
        this.aware_data_connection.query(
            'INSERT INTO plugin_openweather ' +
            '(timestamp, device_id, city, temperature, temperature_max, temperature_min, unit, humidity, pressure, wind_speed, wind_degrees, cloudiness, rain, snow, sunrise, sunset, weather_icon_id, weather_description)' +
            'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);',
            [timestamp, deviceId, city, temperature, temperatureMax, temperatureMin, unit, humidity, pressure, windSpeed, windDegrees, cloudiness, rain, snow, sunrise, sunset, weatherIconId, weatherDescription],
            (err,rows) => {
                if(err) console.error(`inserting weather failed`,err);
                cb();
            });
    }

}
module.exports = DbService;