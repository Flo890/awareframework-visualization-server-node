const DbService = require('./dbService');
const moment = require('moment');
const md5 = require('md5');
var fs = require("fs");
var path = require('path');

class RescueTimeDbService extends DbService {

    constructor(){
        super(() => {
            this.createTableIfNotExists();
        });
    }

    createTableIfNotExists(){
        const dbConnection = this.aware_data_connection;
        fs.readFile(path.join(__dirname, '../database_schemas/rescuetime_database_schema.sql'), "utf8", function(fileErr, data) {
            if (fileErr) {
                console.error('could not read RescueTime sql file',fileErr);
            }
            dbConnection.query(data,[],(err,rows) => {
                if(err){
                    console.error('rescuetime table create script failed');
                    console.error(err);
                }
                console.log('RescueTime create script executed');
            });
        });
    }

    getAllApiKeys(callback){
        this.meta_connection.query('SELECT DISTINCT rescuetime_api_key FROM study_participants WHERE rescuetime_api_key IS NOT NULL;',[],(err,rows) => {
           if(err){
               console.error('fetching all RescueTime api keys failed');
               console.error(err);
           }
           callback(rows.map(row => {return row.rescuetime_api_key}));
        });
    }

    getLatestRetrievedUsageLog(apikey,callback){
        let apikeyHash = md5(apikey);
        this.aware_data_connection.query('SELECT MAX(timestamp) as timestamp FROM rescuetime_usage_log WHERE apikey_hash=?;',[apikeyHash],(err,rows) => {
            if(err){
                console.error(`could not fetch latest RescueTime usage log`,err);
            }
            else if (rows.length != 1) {
                callback(null);
            } else {
                callback(rows[0].timestamp);
            }
        });
    }

    saveUsageLog(usageLog, apiKey){
        let timestamp = moment(usageLog.date, 'YYYY-MM-DD[T]hh:mm:ss');
        let apikeyHash = md5(apiKey);
        this.aware_data_connection.query('INSERT INTO rescuetime_usage_log (apikey_hash, timestamp, `date`, time_spent_secs, number_of_people, activity, category, productivity) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE time_spent_secs=?, number_of_people=?, category=?, productivity=?;',
            [apikeyHash, timestamp.unix()*1000, usageLog.date, usageLog.timeSpentSecs, usageLog.numberOfPeople, usageLog.activity, usageLog.category, usageLog.productivity, usageLog.timeSpentSecs, usageLog.numberOfPeople, usageLog.category, usageLog.productivity],
            (err,rows) => {
                if(err){
                    console.error(`inserting RescueTime usageLog for ${apikeyHash} and ${timestamp.format()} failed`,err);
                } else if(rows.affectedRows != 1){
                    console.error(`affected rows count for RescueTime insert for ${apikeyHash} and ${timestamp.format()} was not 1 but ${rows.affectedRows}`);
                } else {
                    console.log(`RescueTime insert  for ${apikeyHash} and ${timestamp.format()} successful`);
                }
        });

    }



}
module.exports = RescueTimeDbService;