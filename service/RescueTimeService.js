const moment = require('moment');
const fetch = require('node-fetch');
let RescueTimeDbService = require('./RescueTimeDbService');

class RescueTimeService {

    constructor(){
        this.rescuetimeDbService = RescueTimeDbService.getInstance();
    }

    sync(callback){
        this.rescuetimeDbService.getAllApiKeys(apiKeys => {
            if (apiKeys.length == 0){
                callback(`no RescueTime api keys configured`);
            }
           for(let i = 0; i<apiKeys.length; i++){
               let apiKey = apiKeys[i];
               this.rescuetimeDbService.getLatestRetrievedUsageLog(apiKey, latestUsageLogTimestamp => {
                   let to = moment();
                   let from = latestUsageLogTimestamp != null ? moment.unix(latestUsageLogTimestamp/1000) : moment().subtract(1,'days');

                   this.doSyncRescueTime(apiKey, from, to, callback);
               });
           }
        });
    }

    /**
     *
     * @param apiKey
     * @param from   a moment date. Only the day is relevant, because sync is requested for whole days
     * @param to   a moment date. Only the day is relevant, because sync is requested for whole days
     * @param callback
     */
    doSyncRescueTime(apiKey, from, to, callback){
        const dayFormat = 'YYYY-MM-DD';
        fetch(`https://www.rescuetime.com/anapi/data?key=${apiKey}&restrict_begin=${from.format(dayFormat)}&restrict_end=${to.format(dayFormat)}&format=json&resolution_time=hour&pv=interval`)
            .then(response => {response.json().then(json => {
                console.log(json);
                // save data

                let rowHeaders = json.row_headers;
                let rows = json.rows;

                rows.forEach(aRow => {
                    this.rescuetimeDbService.saveUsageLog({
                        date: aRow[rowHeaders.indexOf('Date')],
                        timeSpentSecs: aRow[rowHeaders.indexOf('Time Spent (seconds)')],
                        numberOfPeople: aRow[rowHeaders.indexOf('Number of People')],
                        activity: aRow[rowHeaders.indexOf('Activity')],
                        category: aRow[rowHeaders.indexOf('Category')],
                        productivity: aRow[rowHeaders.indexOf('Productivity')]
                    },apiKey);
                });

                callback(`retrieved ${rows.length} new RescueTime usage logs`);

            }).catch(jsonError => {
                console.error('could not parse RescueTime response',jsonError);
                callback(false);
            })}).catch(error => {
                console.error('RescueTime sync request failed',error);
                callback(false);
        });
    }

}
module.exports = RescueTimeService;