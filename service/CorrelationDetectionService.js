let pcorr = require('compute-pcorr');
let FeatureFetcher = require('./FeatureFetcher');
let featureFetcher = new FeatureFetcher();
var jStat = require('jStat').jStat;

const SIGNIFICANCE_THRESHOLD = 0.05;

/**
 * computes Natural Language Correlations as proposed by Bentley et al: https://dl.acm.org/citation.cfm?id=2503823
 */
class CorrelationDetectionService {

    async testComputeCorrelations(){
        let results = await this.doComputeCorrelations(1,'Florian.Bemmann@campus.lmu.de',1535061600000,1535148000000,60);

        console.log('----------------------');
        results.forEach(result => {
           if (result.isSignificant){
               console.log(`significant ${result.correlationCoefficient > 0 ? 'positive' : 'negative'} correlation for ${result.featureOne} and ${result.featureTwo} found [cc:${result.correlationCoefficient}, p:${result.pValue}, n:${result.n}]`)
           }
        });
    }

    async doComputeCorrelations(participantId, participantEmail, from, to, granularityMins){
        let mappings = require('../config/datamappings.json').mappings;
        let featureNames = Object.keys(mappings);

        let results = [];

        for (let i = 0; i<featureNames.length; i++) {
            for (let j = 0; j<featureNames.length; j++) {
                let featureOne = featureNames[i];
                let featureTwo = featureNames[j];

                if (i>=j) continue; // skip the second halve of the diagonal-cut feature matrix => avoid duplicate calculations

                results.push(await new Promise(resolve => {
                    featureFetcher.getFeature(participantId, participantEmail, featureOne, from, to, granularityMins, f1Data => {
                        if (f1Data.length > 0) {
                            featureFetcher.getFeature(participantId, participantEmail, featureTwo, from, to, granularityMins, f2Data => {
                                if(f2Data.length > 0) {
                                    this.preprocessFeatureDatas(f1Data, f2Data, 'SKIP', (ppF1Data, ppF2Data) => {
                                        if (ppF1Data.length > 0) {
                                            let correlationMatrix = pcorr(ppF1Data, ppF2Data);
                                            let correlationCoefficient = correlationMatrix[0][1]; // TODO ??? should be the chi square value

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

}
module.exports = CorrelationDetectionService;