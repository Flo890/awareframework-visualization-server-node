const PerformetricDbService = require('./PerformetricDbService');
const moment = require('moment');
const fetch = require('node-fetch');

class PerformetricService {

    constructor() {
        this.performetricDbService = new PerformetricDbService();
        this.config = require('../config/performetric.json');
    }

    /**
     *
     * @param callback optional, will be called with some status text
     */
    sync(callback){
        this.performetricDbService.getLatestPerformetricSyncDate(async latestToDate => {

            if (latestToDate == undefined) {
                latestToDate = moment().subtract( this.config.data_frequency, 'minutes').unix()*1000;
            }

            let syncFrom = latestToDate;
            let syncTo = moment();

            let accessInfo = undefined;
            let accessInfoCreateTime = undefined;
            let counter = 0;
            for (; syncFrom < syncTo; syncFrom += this.config.data_frequency*60*1000){
                let iterationTo = (this.config.data_frequency*60*1000) + syncFrom;

                // one outer promise for one sync call including evtl. access token refresh
                let promise = new Promise((resolveOuter,rejectOuter) => {

                    // one promise for loading or refreshing the access token
                    new Promise((resolve,reject) => {
                        if (!accessInfo || !accessInfoCreateTime || moment.unix() > accessInfoCreateTime + accessInfo.expires_in - 60) {
                            // refresh 60 seconds before the access token expires
                            this.requestAccessToken().then(accessInfoResponse => {
                                console.log(`received new access info`,accessInfoResponse);
                                accessInfo = accessInfoResponse;
                               resolve(accessInfoResponse);
                            }).catch(error => {
                                console.error(`fetching access token failed`,error);
                                reject(error);
                            });
                            accessInfoCreateTime = moment.unix();
                        } else {
                            console.log('using existing accessInfo');
                            resolve(accessInfo);
                        }
                    }).then(accessInfo => {
                        // if access info obtained from promise, make sync call
                        this.syncRequestFromTo(syncFrom, iterationTo, accessInfo).then(result => {
                            // store data
                            this.savePerformetricData(result, syncFrom, iterationTo);
                            resolveOuter(); // does not ensure if insert was successful
                        }).catch(error => {
                            rejectOuter(error);
                        });
                        counter++;
                    });
                });
                let anything = await Promise.resolve(promise);

            }

            callback(`executed ${counter} sync calls`);
        });
    }

    requestAccessToken() {
        console.log('will query new access token');

        return new Promise((resolve,reject) => {

            let params = `client_id=${this.config.client_id}&client_secret=${this.config.client_secret}&scope=${this.config.scope}`+
                        `&grant_type=${this.config.grant_type}&password=${this.config.password}&username=${this.config.username}`;

            fetch(this.config.access_token_url,{
                method: 'POST',
                body: params,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }).then(json => {
                json.json().then(response => {
                    resolve(response);
                }).catch(error => {
                    reject(error);
                })
            }).catch(error => {
                console.error(`requesting access token failed`,error);
                reject(error);
            });
        });
    }

    syncRequestFromTo(from, to, accessInfo) {
        return new Promise((resolve,reject) => {
            const companyId = Object.keys(accessInfo.additional_info.organizations)[0];
            const apiDateFormat = 'YYYY-MM-DDTHH:mm:ss.000';

            let fromFromatted = moment.unix(from/1000).format(apiDateFormat);
            let toFormatted = moment.unix(to/1000).format(apiDateFormat);

            console.log(`performetric sync from ${fromFromatted} to ${toFormatted}`);

            fetch(`https://alphaapi.performetric.net/api/reports/${companyId}/fatigue`,{
                method: 'POST',
                body: `{"timeperiods":[{"from":"${fromFromatted}","to":"${toFormatted}"}]}`,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessInfo.access_token}`
                }
            }).then(json => {json.json().then(response => {
                resolve(response);
            }).catch(jsonError => {
                console.error(`could not parse json`,jsonError);
                reject(jsonError);
            })}).catch(reqError => {
                console.error(`sync request failed`,reqError);
                reject(reqError);
            });
        });
    }

    savePerformetricData(data, from, to){
                this.performetricDbService.insertPerformetricData(data, from, to);
    }

}
module.exports = PerformetricService;