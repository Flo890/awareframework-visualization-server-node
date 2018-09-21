var DbService = require("./dbService");
let moment = require('moment');
const fetch = require('node-fetch');


class OpenweatherService {

    constructor() {
        this.dbService = DbService.getInstance();
    }

    loadCurrentWeather(){
        const openWeatherConfig = require('../config/openweather.json');
        if (openWeatherConfig.enable) {

            fetch(`http://api.openweathermap.org/data/2.5/weather?q=${openWeatherConfig.city}&apikey=${openWeatherConfig.apikey}`).then(json => {
                json.json().then(res => {
                    this.dbService.saveCurrentWeather(
                        moment().unix()*1000,
                        'server',
                        res.name,
                        res.main.temp,
                        res.main.temp_max,
                        res.main.temp_min,
                        null,
                        res.main.humidity,
                        res.main.pressure,
                        res.wind.speed,
                        res.wind.deg,
                        res.clouds.all,
                        res.rain ? res.rain.all : 0,
                        res.snow ? res.snow.all : 0,
                        res.sys.sunrise,
                        res.sys.sunset,
                        res.weather[0].id,
                        res.weather[0].description,
                        () => {console.log('saved weather data')}
                    );
                }).catch(jsonError => {
                    console.error(`could not parse OpenWeatherMap response json`,jsonError);
                })
            }).catch(error => {
                console.error(`could not load weather`,error);
            })
        }
    }
}
new OpenweatherService().loadCurrentWeather();
module.exports = OpenweatherService;