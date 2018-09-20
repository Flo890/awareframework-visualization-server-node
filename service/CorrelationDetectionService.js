let pcorr = require('compute-pcorr');
let FeatureFetcher = require('./FeatureFetcher');
let featureFetcher = new FeatureFetcher();
var jStat = require('jStat').jStat;
let DbService = require('./dbService');
let dbService = new DbService();

const SIGNIFICANCE_THRESHOLD = 0.05;
const featureMappings = require('../config/datamappings.json').mappings;
const notInfluencableDomains = ['weather','environment']; // does not include outcome domains, albeit they are not influencable as well


const participantId = 3;
const from = 1536530400000;
const to = 1536945000000;

/**
 * computes Natural Language Correlations as proposed by Bentley et al: https://dl.acm.org/citation.cfm?id=2503823
 */
class CorrelationDetectionService {

    corrFilterFn(featureOne, featureTwo){
        // filter out...
        // ... correlations within one domain, except action
        if (featureMappings[featureOne].domain == featureMappings[featureTwo].domain && !(featureMappings[featureOne].domain == 'action-work')) {
            return false;
        }
        // ... correlation between 2 not influencable domains
        if (notInfluencableDomains.includes(featureMappings[featureOne].domain) && notInfluencableDomains.includes(featureMappings[featureTwo].domain)) {
            return false;
        }
        return true;
    }

    async computeCorrelations() {

        let results = await this.doComputeCorrelationsTypeOne(participantId, 'Florian.Bemmann@campus.lmu.de', from, to, 60, this.corrFilterFn);

        let correlations = results
            .filter(result => result.isSignificant); // filter out insignificant correlation


        // build sentences
        correlations.forEach(correlation => {
            let nlc = this.buildSentence(correlation.featureOne, correlation.featureTwo, correlation.correlationCoefficient, correlation.pValue);
            let correlationEnriched = {
                ...correlation,
                domainOne: featureMappings[correlation.featureOne].domain,
                domainTwo: featureMappings[correlation.featureTwo].domain,
                sentence: nlc,
                from: from,
                to: to
            }

            let relevanceScore = 0;
            if (correlationEnriched.domainOne == 'fatigue') {
                relevanceScore = 100;
            }
            else if (correlationEnriched.domainOne == 'action-work') {
                relevanceScore = 80;
            }
            if (correlationEnriched.domainTwo == 'action-self' || correlationEnriched.domainTwo == 'action-phone') {
                relevanceScore += 10;
            }
            correlationEnriched.relevanceScore = relevanceScore;

            dbService.saveNlCorrelation(
                correlationEnriched,
                participantId
            ,()=> {
                console.log(nlc);
            })

        });
    }

    async testComputeCorrelations(){
        this.computeCorrelations();
        // let results = await this.doComputeCorrelationsTypeOne(3,'Florian.Bemmann@campus.lmu.de',1536530400000,1536945000000,60);
        //
        // console.log('----------------------');
        // results.forEach(result => {
        //    if (result.isSignificant){
        //        console.log(`significant ${result.correlationCoefficient > 0 ? 'positive' : 'negative'} correlation for ${result.featureOne} and ${result.featureTwo} found [cc:${result.correlationCoefficient}, p:${result.pValue}, n:${result.n}]`)
        //    }
        // });
    }

    /**
     * computes the type of correlations from Health Mashups paper, that are described as "significant observations based
     * on statistically significant Pearson correlations between sensors (p < 0.05)"
     * Significance is not incorporated in this function!
     * @param participantId
     * @param participantEmail
     * @param from
     * @param to
     * @param granularityMins
     * @return {Promise<*[]>}
     */
    async doComputeCorrelationsTypeOne(participantId, participantEmail, from, to, granularityMins, corrFilterFn){
        let mappings = require('../config/datamappings.json').mappings;
        let featureNames = Object.keys(mappings);

        let results = [];

        for (let i = 0; i<featureNames.length; i++) {
            for (let j = 0; j<featureNames.length; j++) {
                let featureOne = featureNames[i];
                let featureTwo = featureNames[j];

                if (i>=j) continue; // skip the second halve of the diagonal-cut feature matrix => avoid duplicate calculations
                if (!corrFilterFn(featureOne, featureTwo)) continue; // filter out correlations that aren't useful here (e.g. temperature to humidity)

                results.push(await new Promise(resolve => {
                    featureFetcher.getFeature(participantId, participantEmail, featureOne, from, to, granularityMins, f1Data => {
                        if (f1Data.length > 0) {
                            featureFetcher.getFeature(participantId, participantEmail, featureTwo, from, to, granularityMins, f2Data => {
                                if(f2Data.length > 0) {
                                    this.preprocessFeatureDatas(f1Data, f2Data, 'SKIP', (ppF1Data, ppF2Data) => {
                                        if (ppF1Data.length > 0) {
                                            let correlationMatrix = pcorr(ppF1Data, ppF2Data);
                                            let correlationCoefficient = correlationMatrix[0][1];

                                            /*
                                            basically following this: https://onlinecourses.science.psu.edu/stat501/node/259/
                                             */
                                            let tValue = this.tvalue(correlationCoefficient, ppF1Data.length);

                                            /*
                                            should be something like this: http://www.math.ucla.edu/~tom/distributions/tDist.html
                                            similar to lookup of value in t table with degree of freedom being sample size
                                             */
                                            let pValue = jStat.studentt.pdf(tValue, ppF1Data.length);

                                            resolve({
                                                featureOne: featureOne,
                                                featureTwo: featureTwo,
                                                correlationCoefficient: correlationCoefficient,
                                                pValue: pValue,
                                                isSignificant: pValue < SIGNIFICANCE_THRESHOLD,
                                                n: ppF1Data.length
                                            });

                                            console.log(`features f1:${featureOne} and f2:${featureTwo}`);
                                            console.log(`input arrays size: ${ppF1Data.length}`);
                                            console.log('correlations matrix:');
                                            console.log(correlationMatrix);
                                            console.log(`p-value: ${pValue}`);

                                        } else {resolve({})}
                                    });
                                } else {resolve({})}

                            });
                        } else {resolve({});}
                    });
                }));

            }
        }

        return results.filter(result => {return Object.keys(result).length>0});

    }

    tvalue(correlationCoefficient, n){
        return correlationCoefficient*Math.sqrt(n-2)/Math.sqrt(1-(Math.pow(correlationCoefficient,2)));
    }

    /**
     * - brings data into numeric arrays format
     * - the value at index i corresponds to the same timestamp for both features
     * @param data1
     * @param data2
     * @param samplingMethod
     *          - SKIP: remove all datapoints whose timestamp does not occur in both feature datas
     *          - FLOOR_10m: floors all timestamp to a 10min bin (16:00, 16:10, 16:20, ...)
     * @param callback
     */
    preprocessFeatureDatas(data1,data2,samplingMethod,callback){
        let array1 = [];
        let array2 = [];
        switch(samplingMethod){
            case 'SKIP':
                for (let i = 0; i<data1.length; i++) {
                    let correspondingD2Point = undefined;
                    if ((correspondingD2Point = data2.filter(data2Point => {return data1[i].timestamp == data2Point.timestamp})[0])){
                        array1.push(data1[i].value);
                        array2.push(correspondingD2Point.value);
                    }
                }
                break;
            case 'FLOOR_10m':
                let getFlooredTimestamp = timestamp => {

                };

                for (let i = 0; i<data1.length; i++) {
                    let f1DataPoint = data1[i];
                    let f2DataPoints = data2.filter(data2Point => {getFlooredTimestamp(data2Point.timestamp) == getFlooredTimestamp(f1DataPoint.timestamp)});
                    // TODO don't know if we need that. Check real data first
                   // let closestPo
                }
                break;
            default:
                throw new Error(`sampling method not valid: ${samplingMethod}`);
                break;
        }
        callback(array1,array2);
    }

    buildSentence(featureOne, featureTwo, correlationCoefficient, pValue) {

        // it makes more sense to have "you are more tired when temperature is high" instead of "temperature is higher when you are more tired"
        let switchFeatures =
            notInfluencableDomains.includes(featureMappings[featureOne].domain)
            || featureMappings[featureTwo].domain == 'fatigue'
            || (featureMappings[featureOne].domain != 'fatigue' && featureMappings[featureTwo].domain == 'action-work');

        if (switchFeatures) {
            let featureTemp = featureOne;
            featureOne = featureTwo;
            featureTwo = featureTemp;
        }

        let orderAdjective = correlationCoefficient > 0 ? 'more' : 'less';
        let featureOneVerb = featureMappings[featureOne].correlation_verb;
        let featureTwoVerb = featureMappings[featureTwo].correlation_verb;
        let strengthAdjective = '';
        if (pValue > 0.04) {
            strengthAdjective = 'probably';
        } else if (pValue > 0.02) {
            strengthAdjective = 'likely';
        } else {
            strengthAdjective = 'most likely';
        }

        return `${featureOne.includes('is') ? '' : 'You'} ${strengthAdjective} ${featureOneVerb} ${orderAdjective} on days where ${featureTwoVerb.includes('is') ? '' : 'you'} ${featureTwoVerb}`;
    }

    // --------- client methods ---------
    getCorrelations(participantId, cb){
        dbService.getCorrelationsForUser(participantId, from, to ,100000, correlations => {
            let ratedCorrelations = correlations.sort((c1,c2) => {

            });
            correlations.forEach(c => {
               if (c.domain_one == 'fatigue') {
                   c.relevance = 100;
               } // TODO
            });
            cb(ratedCorrelations);
        });
    }

    addHideCorrelationById(correlationId, participantId, cb){
        dbService.insertHideCorrelationById(correlationId, participantId, cb);
    }

    addHideCorrelationByFeature(feature, participantId, cb){
        dbService.insertHideCorrelationByFeature(feature, participantId, cb);
    }

}
module.exports = CorrelationDetectionService;