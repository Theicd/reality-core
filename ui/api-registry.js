/**
 * api-registry.js — Global API Registry for Reality-Core
 * קטלוג 120 מקורות נתונים עם metadata מלא
 * כל API מסומן: free/key/paid, קטגוריה, endpoint בדיקה, שדות צפויים
 */

const API_REGISTRY = {
  // ═══════════════════════════════════════════════════════
  // ☁️ WEATHER (1-20)
  // ═══════════════════════════════════════════════════════
  'open-meteo': {
    id: 1, name: 'Open-Meteo', category: 'weather', tier: 'free',
    baseUrl: 'https://api.open-meteo.com',
    testEndpoint: 'https://api.open-meteo.com/v1/forecast?latitude=32.08&longitude=34.78&current_weather=true',
    expectedFields: ['current_weather'], responseType: 'json',
    rateLimit: '10000/day', cors: true, active: true,
    description: 'מזג אוויר גלובלי — טמפרטורה, רוח, לחות, גשם'
  },
  'weatherapi': {
    id: 2, name: 'WeatherAPI', category: 'weather', tier: 'key-free',
    baseUrl: 'https://api.weatherapi.com/v1',
    testEndpoint: null, // requires key
    expectedFields: ['current'], responseType: 'json',
    rateLimit: '1M/month', cors: true, active: false,
    keyEnv: 'WEATHERAPI_KEY',
    description: 'מזג אוויר, תחזית, אסטרונומיה'
  },
  'visual-crossing': {
    id: 3, name: 'Visual Crossing', category: 'weather', tier: 'key-free',
    baseUrl: 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline',
    testEndpoint: null, expectedFields: ['days'], responseType: 'json',
    rateLimit: '1000/day', cors: true, active: false,
    keyEnv: 'VISUALCROSSING_KEY',
    description: 'נתוני מזג אוויר היסטוריים ותחזית'
  },
  'meteoblue': {
    id: 4, name: 'Meteoblue', category: 'weather', tier: 'key-free',
    baseUrl: 'https://my.meteoblue.com/packages',
    testEndpoint: null, expectedFields: ['data_day'], responseType: 'json',
    rateLimit: '500/day', cors: false, active: false,
    keyEnv: 'METEOBLUE_KEY',
    description: 'תחזית מזג אוויר מדויקת (שוויץ)'
  },
  'met-no': {
    id: 5, name: 'Met.no (YR)', category: 'weather', tier: 'free',
    baseUrl: 'https://api.met.no/weatherapi',
    testEndpoint: 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=32.08&lon=34.78',
    expectedFields: ['properties'], responseType: 'json',
    rateLimit: '20/sec', cors: true, active: true,
    headers: { 'User-Agent': 'RealityCore/1.0 github.com/theicd/reality-core' },
    description: 'שירות מטאורולוגי נורבגי — חינם לחלוטין'
  },
  'stormglass': {
    id: 6, name: 'StormGlass', category: 'weather', tier: 'key-free',
    baseUrl: 'https://api.stormglass.io/v2',
    testEndpoint: null, expectedFields: ['hours'], responseType: 'json',
    rateLimit: '10/day', cors: true, active: false,
    keyEnv: 'STORMGLASS_KEY',
    description: 'מזג אוויר ימי — גלים, רוח, זרמים'
  },
  'pirate-weather': {
    id: 7, name: 'PirateWeather', category: 'weather', tier: 'key-free',
    baseUrl: 'https://api.pirateweather.net',
    testEndpoint: null, expectedFields: ['currently'], responseType: 'json',
    rateLimit: '1000/day', cors: true, active: false,
    keyEnv: 'PIRATEWEATHER_KEY',
    description: 'חלופה חינמית ל-Dark Sky API'
  },
  'tomorrow-io': {
    id: 8, name: 'Tomorrow.io', category: 'weather', tier: 'key-free',
    baseUrl: 'https://api.tomorrow.io/v4',
    testEndpoint: null, expectedFields: ['data'], responseType: 'json',
    rateLimit: '500/day', cors: true, active: false,
    keyEnv: 'TOMORROW_KEY',
    description: 'מזג אוויר + תנאי כביש + איכות אוויר'
  },
  'climacell': {
    id: 9, name: 'Climacell (→ Tomorrow.io)', category: 'weather', tier: 'deprecated',
    baseUrl: 'https://api.tomorrow.io/v4',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'הופנה ל-Tomorrow.io'
  },
  'openweather': {
    id: 10, name: 'OpenWeatherMap', category: 'weather', tier: 'key-free',
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    testEndpoint: null, expectedFields: ['main', 'weather'], responseType: 'json',
    rateLimit: '60/min', cors: true, active: false,
    keyEnv: 'OPENWEATHER_KEY',
    description: 'מזג אוויר גלובלי — פופולרי, free tier מוגבל'
  },
  'weatherbit': {
    id: 11, name: 'Weatherbit', category: 'weather', tier: 'key-free',
    baseUrl: 'https://api.weatherbit.io/v2.0',
    testEndpoint: null, expectedFields: ['data'], responseType: 'json',
    rateLimit: '500/day', cors: true, active: false,
    keyEnv: 'WEATHERBIT_KEY',
    description: 'מזג אוויר + UV + איכות אוויר'
  },
  'weatherstack': {
    id: 12, name: 'Weatherstack', category: 'weather', tier: 'key-free',
    baseUrl: 'https://api.weatherstack.com',
    testEndpoint: null, expectedFields: ['current'], responseType: 'json',
    rateLimit: '250/month', cors: false, active: false,
    keyEnv: 'WEATHERSTACK_KEY',
    description: 'מזג אוויר בזמן אמת — HTTP בלבד ב-free'
  },
  'nws': {
    id: 13, name: 'National Weather Service', category: 'weather', tier: 'free',
    baseUrl: 'https://api.weather.gov',
    testEndpoint: 'https://api.weather.gov/alerts/active?limit=5',
    expectedFields: ['features'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    headers: { 'User-Agent': 'RealityCore/1.0' },
    description: 'NWS — התרעות מזג אוויר ארה״ב, חינם לחלוטין'
  },
  'world-weather-online': {
    id: 14, name: 'World Weather Online', category: 'weather', tier: 'key-free',
    baseUrl: 'https://api.worldweatheronline.com',
    testEndpoint: null, expectedFields: ['data'], responseType: 'json',
    rateLimit: '500/day', cors: true, active: false,
    keyEnv: 'WWO_KEY', description: 'תחזית מזג אוויר גלובלית'
  },
  'aeris-weather': {
    id: 15, name: 'Aeris Weather', category: 'weather', tier: 'key-free',
    baseUrl: 'https://api.aerisapi.com',
    testEndpoint: null, expectedFields: ['response'], responseType: 'json',
    rateLimit: '1000/day', cors: true, active: false,
    keyEnv: 'AERIS_KEY', description: 'DTN Aeris — מזג אוויר מתקדם'
  },
  'foreca': {
    id: 16, name: 'Foreca', category: 'weather', tier: 'key-paid',
    baseUrl: 'https://pfa.foreca.com/api/v1',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'תחזית מזג אוויר פינית — בתשלום'
  },
  'ibm-weather': {
    id: 17, name: 'IBM Weather (TWC)', category: 'weather', tier: 'key-paid',
    baseUrl: 'https://api.weather.com',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'The Weather Company — בתשלום'
  },
  'copernicus-atmosphere': {
    id: 18, name: 'Copernicus CAMS', category: 'weather', tier: 'free',
    baseUrl: 'https://ads.atmosphere.copernicus.eu/api/v2',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'איכות אוויר אירופה — דורש הרשמה חינמית'
  },
  'openuv': {
    id: 19, name: 'OpenUV', category: 'weather', tier: 'key-free',
    baseUrl: 'https://api.openuv.io/api/v1',
    testEndpoint: null, expectedFields: ['result'], responseType: 'json',
    rateLimit: '50/day', cors: true, active: false,
    keyEnv: 'OPENUV_KEY', description: 'מדד UV בזמן אמת'
  },
  'sunrise-sunset': {
    id: 20, name: 'Sunrise-Sunset', category: 'weather', tier: 'free',
    baseUrl: 'https://api.sunrise-sunset.org',
    testEndpoint: 'https://api.sunrise-sunset.org/json?lat=32.08&lng=34.78&formatted=0',
    expectedFields: ['results'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'זריחה/שקיעה לכל נקודה בעולם'
  },

  // ═══════════════════════════════════════════════════════
  // 🌊 OCEAN (21-35)
  // ═══════════════════════════════════════════════════════
  'noaa-tides': {
    id: 21, name: 'NOAA Tides & Currents', category: 'ocean', tier: 'free',
    baseUrl: 'https://api.tidesandcurrents.noaa.gov/api/prod',
    testEndpoint: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=8518750&product=water_level&datum=STND&units=metric&time_zone=gmt&application=RealityCore&format=json',
    expectedFields: ['data'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'גאות ושפל + זרמים — ארה״ב'
  },
  'noaa-currents': {
    id: 22, name: 'NOAA Currents', category: 'ocean', tier: 'free',
    baseUrl: 'https://api.tidesandcurrents.noaa.gov/api/prod',
    testEndpoint: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=s08010&product=currents&units=metric&time_zone=gmt&application=RealityCore&format=json',
    expectedFields: ['data'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'זרמים ימיים — ארה״ב'
  },
  'noaa-buoys': {
    id: 23, name: 'NOAA Buoys', category: 'ocean', tier: 'free',
    baseUrl: 'https://www.ndbc.noaa.gov/data',
    testEndpoint: 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt',
    expectedFields: [], responseType: 'text',
    rateLimit: 'generous', cors: false, active: true,
    description: 'מצופי ים — גלים, רוח, טמפרטורה'
  },
  'copernicus-marine': {
    id: 24, name: 'Copernicus Marine', category: 'ocean', tier: 'free',
    baseUrl: 'https://nrt.cmems-du.eu/motu-web',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'נתוני אוקיינוס אירופה — דורש הרשמה'
  },
  'marine-institute': {
    id: 25, name: 'Marine Institute Ireland', category: 'ocean', tier: 'free',
    baseUrl: 'https://erddap.marine.ie/erddap',
    testEndpoint: 'https://erddap.marine.ie/erddap/info/index.json',
    expectedFields: ['table'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'נתוני ים אירלנד — ERDDAP'
  },
  'stormglass-marine': {
    id: 26, name: 'StormGlass Marine', category: 'ocean', tier: 'key-free',
    baseUrl: 'https://api.stormglass.io/v2',
    testEndpoint: null, expectedFields: ['hours'], responseType: 'json',
    rateLimit: '10/day', cors: true, active: false,
    keyEnv: 'STORMGLASS_KEY', description: 'נתוני גלים וזרמים'
  },
  'openseamap': {
    id: 27, name: 'OpenSeaMap', category: 'ocean', tier: 'free',
    baseUrl: 'https://tiles.openseamap.org',
    testEndpoint: 'https://tiles.openseamap.org/seamark/0/0/0.png',
    expectedFields: [], responseType: 'image',
    rateLimit: 'generous', cors: true, active: true,
    description: 'מפת ים פתוחה — tiles'
  },
  'global-ocean-forecast': {
    id: 28, name: 'Global Ocean Forecast', category: 'ocean', tier: 'free',
    baseUrl: 'https://nrt.cmems-du.eu',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'תחזית אוקיינוס גלובלית (Copernicus)'
  },
  'hycom': {
    id: 29, name: 'HYCOM', category: 'ocean', tier: 'free',
    baseUrl: 'https://ncss.hycom.org/thredds',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'מודל אוקיינוס גלובלי'
  },
  'sea-temperature': {
    id: 30, name: 'Sea Temperature API', category: 'ocean', tier: 'free',
    baseUrl: 'https://seatemperature.info',
    testEndpoint: null, expectedFields: [], responseType: 'html',
    rateLimit: '-', cors: false, active: false,
    description: 'טמפרטורות מי ים — web scraping'
  },
  'oceanwatch': {
    id: 31, name: 'OceanWatch', category: 'ocean', tier: 'free',
    baseUrl: 'https://oceanwatch.pifsc.noaa.gov',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'ניטור אוקיינוס — NOAA'
  },
  'sea-level': {
    id: 32, name: 'Sea Level API', category: 'ocean', tier: 'free',
    baseUrl: 'https://tidesandcurrents.noaa.gov/api',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: true, active: false,
    description: 'גובה פני הים (NOAA)'
  },
  'global-tide': {
    id: 33, name: 'Global Tide', category: 'ocean', tier: 'key-free',
    baseUrl: 'https://www.worldtides.info/api/v3',
    testEndpoint: null, expectedFields: ['heights'], responseType: 'json',
    rateLimit: '10/day', cors: true, active: false,
    keyEnv: 'WORLDTIDES_KEY', description: 'גאות/שפל גלובלי'
  },
  'marine-traffic-free': {
    id: 34, name: 'MarineTraffic (Free)', category: 'ocean', tier: 'key-paid',
    baseUrl: 'https://services.marinetraffic.com',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'תעבורה ימית — בתשלום'
  },
  'seadatanet': {
    id: 35, name: 'SeaDataNet', category: 'ocean', tier: 'free',
    baseUrl: 'https://www.seadatanet.org',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'רשת נתוני ים אירופה'
  },

  // ═══════════════════════════════════════════════════════
  // 🌍 GEOLOGY (36-45)
  // ═══════════════════════════════════════════════════════
  'usgs-earthquake': {
    id: 36, name: 'USGS Earthquake', category: 'geology', tier: 'free',
    baseUrl: 'https://earthquake.usgs.gov/fdsnws/event/1',
    testEndpoint: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    expectedFields: ['features'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'רעידות אדמה גלובליות — USGS'
  },
  'emsc-earthquake': {
    id: 37, name: 'EMSC Earthquake', category: 'geology', tier: 'free',
    baseUrl: 'https://www.seismicportal.eu/fdsnws/event/1',
    testEndpoint: 'https://www.seismicportal.eu/fdsnws/event/1/query?limit=10&format=json&minmag=3',
    expectedFields: ['features'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'רעידות אדמה אירופה-ים תיכון'
  },
  'iris-seismic': {
    id: 38, name: 'IRIS Seismic', category: 'geology', tier: 'free',
    baseUrl: 'https://service.iris.edu/fdsnws/event/1',
    testEndpoint: 'https://service.iris.edu/fdsnws/event/1/query?limit=5&format=text&minmagnitude=4&orderby=time',
    expectedFields: [], responseType: 'text',
    rateLimit: 'generous', cors: true, active: true,
    description: 'נתונים סייסמיים — IRIS'
  },
  'gfz-earthquake': {
    id: 39, name: 'GFZ Potsdam', category: 'geology', tier: 'free',
    baseUrl: 'https://geofon.gfz-potsdam.de/fdsnws/event/1',
    testEndpoint: 'https://geofon.gfz-potsdam.de/fdsnws/event/1/query?limit=5&format=text&minmag=4',
    expectedFields: [], responseType: 'text',
    rateLimit: 'generous', cors: true, active: true,
    description: 'נתונים סייסמיים — גרמניה GFZ'
  },
  'smithsonian-volcano': {
    id: 40, name: 'Smithsonian Volcanoes', category: 'geology', tier: 'free',
    baseUrl: 'https://volcano.si.edu',
    testEndpoint: null, expectedFields: [], responseType: 'html',
    rateLimit: '-', cors: false, active: false,
    description: 'תכנית הרי געש גלובלית — אין API רשמי'
  },
  'global-volcanism': {
    id: 41, name: 'Global Volcanism Program', category: 'geology', tier: 'free',
    baseUrl: 'https://volcano.si.edu/volcanolist_holocene.cfm',
    testEndpoint: null, expectedFields: [], responseType: 'html',
    rateLimit: '-', cors: false, active: false,
    description: 'רשימת הרי געש הולוצן'
  },
  'earthquake-track': {
    id: 42, name: 'EarthquakeTrack', category: 'geology', tier: 'free',
    baseUrl: 'https://earthquaketrack.com',
    testEndpoint: null, expectedFields: [], responseType: 'html',
    rateLimit: '-', cors: false, active: false,
    description: 'מעקב רעידות אדמה — web'
  },
  'seismic-portal': {
    id: 43, name: 'SeismicPortal (EMSC)', category: 'geology', tier: 'free',
    baseUrl: 'https://www.seismicportal.eu',
    testEndpoint: 'https://www.seismicportal.eu/fdsnws/event/1/query?limit=5&format=json',
    expectedFields: ['features'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'פורטל סייסמי אירופי'
  },
  'geonet-nz': {
    id: 44, name: 'GeoNet NZ', category: 'geology', tier: 'free',
    baseUrl: 'https://api.geonet.org.nz',
    testEndpoint: 'https://api.geonet.org.nz/quake?MMI=3',
    expectedFields: ['features'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'רעידות אדמה ניו זילנד'
  },
  'jma-seismic': {
    id: 45, name: 'JMA Seismic (Japan)', category: 'geology', tier: 'free',
    baseUrl: 'https://www.jma.go.jp',
    testEndpoint: null, expectedFields: [], responseType: 'html',
    rateLimit: '-', cors: false, active: false,
    description: 'סוכנות המטאורולוגיה של יפן — אין REST API ציבורי'
  },

  // ═══════════════════════════════════════════════════════
  // ☀️ SPACE WEATHER (46-60)
  // ═══════════════════════════════════════════════════════
  'noaa-swpc': {
    id: 46, name: 'NOAA SWPC', category: 'space', tier: 'free',
    baseUrl: 'https://services.swpc.noaa.gov',
    testEndpoint: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
    expectedFields: [], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'מרכז חיזוי מזג אוויר חללי — Kp, רוח סולארית'
  },
  'nasa-donki': {
    id: 47, name: 'NASA DONKI', category: 'space', tier: 'free',
    baseUrl: 'https://api.nasa.gov/DONKI',
    testEndpoint: 'https://api.nasa.gov/DONKI/notifications?type=all&api_key=DEMO_KEY',
    expectedFields: [], responseType: 'json',
    rateLimit: '1000/hr', cors: true, active: true,
    description: 'אירועי חלל — CME, flare, geomagnetic storm'
  },
  'nasa-sdo': {
    id: 48, name: 'NASA SDO (Solar Dynamics)', category: 'space', tier: 'free',
    baseUrl: 'https://sdo.gsfc.nasa.gov',
    testEndpoint: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_256_0193.jpg',
    expectedFields: [], responseType: 'image',
    rateLimit: 'generous', cors: true, active: true,
    description: 'תמונות שמש בזמן אמת'
  },
  'solar-monitor': {
    id: 49, name: 'SolarMonitor', category: 'space', tier: 'free',
    baseUrl: 'https://solarmonitor.org',
    testEndpoint: null, expectedFields: [], responseType: 'html',
    rateLimit: '-', cors: false, active: false,
    description: 'ניטור שמש — אין REST API'
  },
  'spaceweatherlive': {
    id: 50, name: 'SpaceWeatherLive', category: 'space', tier: 'free',
    baseUrl: 'https://www.spaceweatherlive.com',
    testEndpoint: null, expectedFields: [], responseType: 'html',
    rateLimit: '-', cors: false, active: false,
    description: 'מזג אוויר חללי — web'
  },
  'helioviewer': {
    id: 51, name: 'Helioviewer', category: 'space', tier: 'free',
    baseUrl: 'https://api.helioviewer.org',
    testEndpoint: 'https://api.helioviewer.org/v2/getClosestImage/?date=2024-01-01T00:00:00Z&sourceId=14',
    expectedFields: ['id'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'תמונות שמש — SDO, SOHO, STEREO'
  },
  'solar-wind': {
    id: 52, name: 'NOAA Solar Wind', category: 'space', tier: 'free',
    baseUrl: 'https://services.swpc.noaa.gov',
    testEndpoint: 'https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json',
    expectedFields: [], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'רוח סולארית — מהירות, צפיפות'
  },
  'aurora-forecast': {
    id: 53, name: 'NOAA Aurora Forecast', category: 'space', tier: 'free',
    baseUrl: 'https://services.swpc.noaa.gov',
    testEndpoint: 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',
    expectedFields: ['coordinates'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'תחזית זוהר צפוני/דרומי'
  },
  'planetary-k-index': {
    id: 54, name: 'Planetary K-Index', category: 'space', tier: 'free',
    baseUrl: 'https://services.swpc.noaa.gov',
    testEndpoint: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
    expectedFields: [], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'אינדקס Kp — פעילות גיאומגנטית'
  },
  'sunspot': {
    id: 55, name: 'SILSO Sunspot', category: 'space', tier: 'free',
    baseUrl: 'https://www.sidc.be/silso',
    testEndpoint: 'https://www.sidc.be/silso/INFO/sndtotcsv.php',
    expectedFields: [], responseType: 'text',
    rateLimit: 'generous', cors: false, active: true,
    description: 'מספר כתמי שמש — SILSO'
  },
  'solar-flare': {
    id: 56, name: 'NASA Solar Flare', category: 'space', tier: 'free',
    baseUrl: 'https://api.nasa.gov/DONKI/FLR',
    testEndpoint: 'https://api.nasa.gov/DONKI/FLR?startDate=2024-01-01&api_key=DEMO_KEY',
    expectedFields: [], responseType: 'json',
    rateLimit: '1000/hr', cors: true, active: true,
    description: 'התלקחויות סולאריות — DONKI'
  },
  'radiation-belt': {
    id: 57, name: 'NOAA Radiation Belt', category: 'space', tier: 'free',
    baseUrl: 'https://services.swpc.noaa.gov',
    testEndpoint: 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json',
    expectedFields: [], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'פרוטונים ואלקטרונים — חגורות קרינה'
  },
  'esa-space-weather': {
    id: 58, name: 'ESA Space Weather', category: 'space', tier: 'free',
    baseUrl: 'https://swe.ssa.esa.int',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'סוכנות החלל האירופית — דורש הרשמה'
  },
  'magnetosphere': {
    id: 59, name: 'NOAA Magnetosphere', category: 'space', tier: 'free',
    baseUrl: 'https://services.swpc.noaa.gov',
    testEndpoint: 'https://services.swpc.noaa.gov/products/solar-wind/mag-7-day.json',
    expectedFields: [], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'שדה מגנטי — Bz, Bt, Bx, By'
  },
  'solar-cycle': {
    id: 60, name: 'NOAA Solar Cycle', category: 'space', tier: 'free',
    baseUrl: 'https://services.swpc.noaa.gov',
    testEndpoint: 'https://services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json',
    expectedFields: [], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'מחזור סולארי — תחזית כתמי שמש'
  },

  // ═══════════════════════════════════════════════════════
  // 🛰 SATELLITES (61-75)
  // ═══════════════════════════════════════════════════════
  'n2yo': {
    id: 61, name: 'N2YO', category: 'satellites', tier: 'key-free',
    baseUrl: 'https://api.n2yo.com/rest/v1/satellite',
    testEndpoint: null, expectedFields: ['info'], responseType: 'json',
    rateLimit: '1000/hr', cors: true, active: false,
    keyEnv: 'N2YO_KEY', description: 'מעקב לוויינים + TLE'
  },
  'celestrak': {
    id: 62, name: 'CelesTrak', category: 'satellites', tier: 'free',
    baseUrl: 'https://celestrak.org',
    testEndpoint: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle',
    expectedFields: [], responseType: 'text',
    rateLimit: 'generous', cors: true, active: true,
    description: 'נתוני TLE — מסלולי לוויינים'
  },
  'space-track': {
    id: 63, name: 'Space-Track', category: 'satellites', tier: 'free',
    baseUrl: 'https://www.space-track.org',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'USSPACECOM — דורש הרשמה חינמית'
  },
  'satnogs': {
    id: 64, name: 'SatNOGS', category: 'satellites', tier: 'free',
    baseUrl: 'https://db.satnogs.org/api',
    testEndpoint: 'https://db.satnogs.org/api/satellites/?format=json&status=alive',
    expectedFields: [], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'רשת לוויינים פתוחה — SatNOGS'
  },
  'heavens-above': {
    id: 65, name: 'Heavens Above', category: 'satellites', tier: 'free',
    baseUrl: 'https://www.heavens-above.com',
    testEndpoint: null, expectedFields: [], responseType: 'html',
    rateLimit: '-', cors: false, active: false,
    description: 'מעקב לוויינים — web בלבד'
  },
  'norad-tle': {
    id: 66, name: 'NORAD TLE (via CelesTrak)', category: 'satellites', tier: 'free',
    baseUrl: 'https://celestrak.org/NORAD/elements',
    testEndpoint: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle',
    expectedFields: [], responseType: 'text',
    rateLimit: 'generous', cors: true, active: true,
    description: 'TLE לתחנות חלל'
  },
  'esa-satellite': {
    id: 67, name: 'ESA Satellite API', category: 'satellites', tier: 'free',
    baseUrl: 'https://discosweb.esoc.esa.int/api',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'ESA DISCOS — דורש הרשמה'
  },
  'planet-labs': {
    id: 68, name: 'Planet Labs', category: 'satellites', tier: 'key-paid',
    baseUrl: 'https://api.planet.com/data/v1',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'תמונות לוויין — בתשלום'
  },
  'starlink': {
    id: 69, name: 'Starlink TLE', category: 'satellites', tier: 'free',
    baseUrl: 'https://celestrak.org',
    testEndpoint: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle',
    expectedFields: [], responseType: 'text',
    rateLimit: 'generous', cors: true, active: true,
    description: 'מסלולי Starlink — CelesTrak'
  },
  'satellite-map': {
    id: 70, name: 'Satellite Imagery (NASA)', category: 'satellites', tier: 'free',
    baseUrl: 'https://gibs.earthdata.nasa.gov',
    testEndpoint: 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml',
    expectedFields: [], responseType: 'xml',
    rateLimit: 'generous', cors: true, active: true,
    description: 'תמונות לוויין NASA GIBS'
  },
  'iss-location': {
    id: 71, name: 'ISS Location', category: 'satellites', tier: 'free',
    baseUrl: 'https://api.wheretheiss.at/v1',
    testEndpoint: 'https://api.wheretheiss.at/v1/satellites/25544',
    expectedFields: ['latitude', 'longitude'], responseType: 'json',
    rateLimit: '1/sec', cors: true, active: true,
    description: 'מיקום תחנת החלל הבינלאומית'
  },
  'open-notify': {
    id: 72, name: 'Open Notify', category: 'satellites', tier: 'free',
    baseUrl: 'http://api.open-notify.org',
    testEndpoint: 'http://api.open-notify.org/astros.json',
    expectedFields: ['people'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'אסטרונאוטים בחלל + ISS'
  },
  'orbital-debris': {
    id: 73, name: 'ESA Space Debris', category: 'satellites', tier: 'free',
    baseUrl: 'https://discosweb.esoc.esa.int',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'פסולת חלל — ESA DISCOS'
  },
  'satellite-pass': {
    id: 74, name: 'N2YO Satellite Pass', category: 'satellites', tier: 'key-free',
    baseUrl: 'https://api.n2yo.com',
    testEndpoint: null, expectedFields: ['passes'], responseType: 'json',
    rateLimit: '1000/hr', cors: true, active: false,
    keyEnv: 'N2YO_KEY', description: 'מעברי לוויינים — N2YO'
  },
  'cubesat': {
    id: 75, name: 'SatNOGS CubeSat', category: 'satellites', tier: 'free',
    baseUrl: 'https://db.satnogs.org/api',
    testEndpoint: 'https://db.satnogs.org/api/satellites/?format=json',
    expectedFields: [], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'מאגר CubeSat — SatNOGS'
  },

  // ═══════════════════════════════════════════════════════
  // ✈️ AIR TRAFFIC (76-90)
  // ═══════════════════════════════════════════════════════
  'opensky': {
    id: 76, name: 'OpenSky Network', category: 'aviation', tier: 'free',
    baseUrl: 'https://opensky-network.org/api',
    testEndpoint: 'https://opensky-network.org/api/states/all?lamin=31&lamax=33&lomin=34&lomax=36',
    expectedFields: ['states'], responseType: 'json',
    rateLimit: '100/day (anon)', cors: false, active: true,
    description: 'תעבורה אווירית — rate limited'
  },
  'adsb-exchange': {
    id: 77, name: 'ADS-B Exchange', category: 'aviation', tier: 'key-paid',
    baseUrl: 'https://adsbexchange.com/api',
    testEndpoint: null, expectedFields: ['ac'], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'ADS-B — RapidAPI בתשלום'
  },
  'flightaware': {
    id: 78, name: 'FlightAware', category: 'aviation', tier: 'key-paid',
    baseUrl: 'https://aeroapi.flightaware.com/aeroapi',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'מעקב טיסות — בתשלום'
  },
  'flightradar': {
    id: 79, name: 'FlightRadar24', category: 'aviation', tier: 'key-paid',
    baseUrl: 'https://fr24api.flightradar24.com',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'FR24 — בתשלום'
  },
  'aviationstack': {
    id: 80, name: 'AviationStack', category: 'aviation', tier: 'key-free',
    baseUrl: 'https://api.aviationstack.com/v1',
    testEndpoint: null, expectedFields: ['data'], responseType: 'json',
    rateLimit: '100/month', cors: true, active: false,
    keyEnv: 'AVIATIONSTACK_KEY', description: 'נתוני טיסות — free tier מוגבל'
  },
  'openflights': {
    id: 81, name: 'OpenFlights', category: 'aviation', tier: 'free',
    baseUrl: 'https://raw.githubusercontent.com/jpatokal/openflights/master/data',
    testEndpoint: 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat',
    expectedFields: [], responseType: 'text',
    rateLimit: 'generous', cors: true, active: true,
    description: 'מאגר שדות תעופה וחברות תעופה'
  },
  'airportdb': {
    id: 82, name: 'AirportDB', category: 'aviation', tier: 'free',
    baseUrl: 'https://airportdb.io/api/v1',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: true, active: false,
    description: 'מאגר שדות תעופה'
  },
  'adsb-api': {
    id: 83, name: 'airplanes.live (ADS-B)', category: 'aviation', tier: 'free',
    baseUrl: 'https://api.airplanes.live/v2',
    testEndpoint: 'https://api.airplanes.live/v2/point/32.08/34.78/100',
    expectedFields: ['ac'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'ADS-B חינמי — CORS *'
  },
  'mode-s': {
    id: 84, name: 'Mode-S Decoder', category: 'aviation', tier: 'free',
    baseUrl: 'https://github.com/junzis/pyModeS',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'ספריית Mode-S — לא API'
  },
  'skyvector': {
    id: 85, name: 'SkyVector', category: 'aviation', tier: 'free',
    baseUrl: 'https://skyvector.com',
    testEndpoint: null, expectedFields: [], responseType: 'html',
    rateLimit: '-', cors: false, active: false,
    description: 'מפות תעופה — web בלבד'
  },
  'eurocontrol': {
    id: 86, name: 'Eurocontrol', category: 'aviation', tier: 'key-paid',
    baseUrl: 'https://www.eurocontrol.int',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'בקרת טיסות אירופה — מוגבל'
  },
  'faa-airport': {
    id: 87, name: 'FAA Airport Status', category: 'aviation', tier: 'free',
    baseUrl: 'https://soa.smext.faa.gov/asws/api/airport/status',
    testEndpoint: 'https://soa.smext.faa.gov/asws/api/airport/status/JFK',
    expectedFields: ['Name'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'סטטוס שדות תעופה ארה״ב'
  },
  'global-aviation': {
    id: 88, name: 'Global Aviation API', category: 'aviation', tier: 'key-paid',
    baseUrl: 'https://aviation-edge.com/v2',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'Aviation Edge — בתשלום'
  },
  'planefinder': {
    id: 89, name: 'PlaneFinder', category: 'aviation', tier: 'key-paid',
    baseUrl: 'https://planefinder.net',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'מעקב טיסות — בתשלום'
  },
  'flightstats': {
    id: 90, name: 'FlightStats (Cirium)', category: 'aviation', tier: 'key-paid',
    baseUrl: 'https://api.flightstats.com',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'נתוני טיסות — בתשלום'
  },

  // ═══════════════════════════════════════════════════════
  // 🚢 SHIPS (91-100)
  // ═══════════════════════════════════════════════════════
  'aisstream': {
    id: 91, name: 'AISStream', category: 'ships', tier: 'key-free',
    baseUrl: 'wss://stream.aisstream.io/v0/stream',
    testEndpoint: null, expectedFields: [], responseType: 'websocket',
    rateLimit: '-', cors: true, active: false,
    keyEnv: 'AISSTREAM_KEY', description: 'AIS WebSocket — דורש מפתח חינמי'
  },
  'marinetraffic': {
    id: 92, name: 'MarineTraffic', category: 'ships', tier: 'key-paid',
    baseUrl: 'https://services.marinetraffic.com',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'תעבורה ימית — בתשלום'
  },
  'vesselfinder': {
    id: 93, name: 'VesselFinder', category: 'ships', tier: 'key-paid',
    baseUrl: 'https://api.vesselfinder.com',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'מעקב ספינות — בתשלום'
  },
  'shipdb': {
    id: 94, name: 'ShipDB', category: 'ships', tier: 'free',
    baseUrl: 'https://shipdb.org',
    testEndpoint: null, expectedFields: [], responseType: 'html',
    rateLimit: '-', cors: false, active: false,
    description: 'מאגר ספינות — web'
  },
  'fleetmon': {
    id: 95, name: 'FleetMon', category: 'ships', tier: 'key-paid',
    baseUrl: 'https://apiv2.fleetmon.com',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'מעקב ציי ספינות — בתשלום'
  },
  'digitraffic-ais': {
    id: 96, name: 'Digitraffic AIS (Finland)', category: 'ships', tier: 'free',
    baseUrl: 'https://meri.digitraffic.fi/api/ais/v1',
    testEndpoint: 'https://meri.digitraffic.fi/api/ais/v1/locations',
    expectedFields: ['features'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'AIS פינלנד — כלי שיט בזמן אמת, חינם'
  },
  'aishub': {
    id: 97, name: 'AIS Hub', category: 'ships', tier: 'key-free',
    baseUrl: 'https://data.aishub.net',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    keyEnv: 'AISHUB_KEY', description: 'שיתוף AIS — דורש הרשמה'
  },
  'openais': {
    id: 98, name: 'OpenAIS (→ Digitraffic)', category: 'ships', tier: 'free',
    baseUrl: 'https://meri.digitraffic.fi',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: true, active: false,
    description: 'הופנה ל-Digitraffic'
  },
  'ship-positions': {
    id: 99, name: 'Datalastic Ship API', category: 'ships', tier: 'key-paid',
    baseUrl: 'https://api.datalastic.com/api/v0',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'מיקומי ספינות — בתשלום'
  },
  'marine-cadastre': {
    id: 100, name: 'Marine Cadastre (BOEM)', category: 'ships', tier: 'free',
    baseUrl: 'https://marinecadastre.gov',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'נתוני AIS היסטוריים ארה״ב'
  },

  // ═══════════════════════════════════════════════════════
  // 🌎 DISASTERS (101-110)
  // ═══════════════════════════════════════════════════════
  'nasa-eonet': {
    id: 101, name: 'NASA EONET', category: 'disaster', tier: 'free',
    baseUrl: 'https://eonet.gsfc.nasa.gov/api/v3',
    testEndpoint: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=10',
    expectedFields: ['events'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'אירועי טבע — שריפות, סופות, הרי געש'
  },
  'gdacs': {
    id: 102, name: 'GDACS', category: 'disaster', tier: 'free',
    baseUrl: 'https://www.gdacs.org/gdacsapi/api/events',
    testEndpoint: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO;DR;WF&fromDate=2024-01-01&toDate=2025-12-31&alertlevel=Green;Orange;Red',
    expectedFields: ['features'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'מערכת התרעה לאסונות גלובליים'
  },
  'global-flood': {
    id: 103, name: 'Global Flood Monitor', category: 'disaster', tier: 'free',
    baseUrl: 'https://www.globalfloodmonitor.org',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'ניטור שיטפונות גלובלי'
  },
  'wildfire-api': {
    id: 104, name: 'InciWeb Wildfires', category: 'disaster', tier: 'free',
    baseUrl: 'https://inciweb.wildfire.gov',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'שריפות יער ארה״ב'
  },
  'nasa-firms': {
    id: 105, name: 'NASA FIRMS', category: 'disaster', tier: 'free',
    baseUrl: 'https://firms.modaps.eosdis.nasa.gov/api',
    testEndpoint: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/DEMO_KEY/VIIRS_SNPP_NRT/world/1',
    expectedFields: [], responseType: 'text',
    rateLimit: '10/min', cors: true, active: true,
    description: 'נקודות חמות (שריפות) — לוויין VIIRS'
  },
  'disaster-aware': {
    id: 106, name: 'DisasterAWARE (PDC)', category: 'disaster', tier: 'key-paid',
    baseUrl: 'https://hpxml.pdc.org',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'PDC — דורש גישה ממשלתית'
  },
  'reliefweb': {
    id: 107, name: 'ReliefWeb', category: 'disaster', tier: 'free',
    baseUrl: 'https://api.reliefweb.int/v1',
    testEndpoint: 'https://api.reliefweb.int/v1/disasters?appname=RealityCore&limit=5',
    expectedFields: ['data'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'אסונות הומניטריים — UN OCHA'
  },
  'spc-storms': {
    id: 108, name: 'Storm Prediction Center', category: 'disaster', tier: 'free',
    baseUrl: 'https://www.spc.noaa.gov',
    testEndpoint: 'https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson',
    expectedFields: ['features'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'תחזית סופות — NOAA SPC'
  },
  'tropical-storm': {
    id: 109, name: 'NOAA NHC Tropical', category: 'disaster', tier: 'free',
    baseUrl: 'https://www.nhc.noaa.gov',
    testEndpoint: 'https://www.nhc.noaa.gov/CurrentSummaries.json',
    expectedFields: [], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'הוריקנים וסופות טרופיות'
  },
  'hurricane-tracker': {
    id: 110, name: 'IBTrACS (Hurricane Archive)', category: 'disaster', tier: 'free',
    baseUrl: 'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'ארכיון הוריקנים גלובלי'
  },

  // ═══════════════════════════════════════════════════════
  // ☢️ RADIATION (111-115)
  // ═══════════════════════════════════════════════════════
  'eurdep': {
    id: 111, name: 'EURDEP', category: 'radiation', tier: 'free',
    baseUrl: 'https://remap.jrc.ec.europa.eu',
    testEndpoint: 'https://remap.jrc.ec.europa.eu/api/measurements/latest',
    expectedFields: [], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'רשת ניטור קרינה אירופית'
  },
  'radnet-epa': {
    id: 112, name: 'RadNet EPA', category: 'radiation', tier: 'free',
    baseUrl: 'https://www.epa.gov/radnet',
    testEndpoint: null, expectedFields: [], responseType: 'html',
    rateLimit: '-', cors: false, active: false,
    description: 'ניטור קרינה ארה״ב — אין REST API ציבורי'
  },
  'radiation-map': {
    id: 113, name: 'GMCMap (Radiation)', category: 'radiation', tier: 'free',
    baseUrl: 'https://www.gmcmap.com',
    testEndpoint: 'https://www.gmcmap.com/AJAX_load_498498_498499.asp',
    expectedFields: [], responseType: 'text',
    rateLimit: '-', cors: false, active: false,
    description: 'מפת קרינה עולמית — scraping'
  },
  'openradiation': {
    id: 114, name: 'OpenRadiation', category: 'radiation', tier: 'free',
    baseUrl: 'https://request.openradiation.net/1',
    testEndpoint: 'https://request.openradiation.net/1/measurements?period=24h',
    expectedFields: ['data'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'מדידות קרינה קהילתיות'
  },
  'iaea-radiation': {
    id: 115, name: 'IAEA IRMIS', category: 'radiation', tier: 'free',
    baseUrl: 'https://nucleus.iaea.org/irmis',
    testEndpoint: null, expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: false,
    description: 'סוכנות אטום בינלאומית — מוגבל'
  },

  // ═══════════════════════════════════════════════════════
  // 🚨 ALERTS (116-120)
  // ═══════════════════════════════════════════════════════
  'oref-israel': {
    id: 116, name: 'Israel Home Front (Oref)', category: 'alerts', tier: 'free',
    baseUrl: 'https://www.oref.org.il',
    testEndpoint: 'https://www.oref.org.il/WarningMessages/alert/alerts.json',
    expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: true,
    description: 'פיקוד העורף — צבע אדום'
  },
  'us-alerts-cap': {
    id: 117, name: 'US CAP Alerts (IPAWS)', category: 'alerts', tier: 'free',
    baseUrl: 'https://api.weather.gov/alerts',
    testEndpoint: 'https://api.weather.gov/alerts/active?limit=5',
    expectedFields: ['features'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'התרעות חירום ארה״ב — CAP'
  },
  'meteoalarm-eu': {
    id: 118, name: 'MeteoAlarm EU', category: 'alerts', tier: 'free',
    baseUrl: 'https://feeds.meteoalarm.org/api/v1',
    testEndpoint: 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-israel',
    expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: true, active: true,
    description: 'התרעות מטאורולוגיות אירופה'
  },
  'gdacs-alerts': {
    id: 119, name: 'GDACS Alerts', category: 'alerts', tier: 'free',
    baseUrl: 'https://www.gdacs.org/gdacsapi/api/events',
    testEndpoint: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO&alertlevel=Orange;Red',
    expectedFields: ['features'], responseType: 'json',
    rateLimit: 'generous', cors: true, active: true,
    description: 'התרעות אסונות גלובליים — כתום/אדום'
  },
  'tzevaadom': {
    id: 120, name: 'Tzeva Adom (Red Alert)', category: 'alerts', tier: 'free',
    baseUrl: 'https://api.tzevaadom.co.il',
    testEndpoint: 'https://api.tzevaadom.co.il/notifications',
    expectedFields: [], responseType: 'json',
    rateLimit: '-', cors: false, active: true,
    description: 'צבע אדום — API צד שלישי'
  }
};

// ═══════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════

const API_CATEGORIES = {
  weather:    { label: '☁️ מזג אוויר', color: '#4fc3f7' },
  ocean:      { label: '🌊 אוקיינוס', color: '#00bcd4' },
  geology:    { label: '🌍 גיאולוגיה', color: '#ff7043' },
  space:      { label: '☀️ חלל', color: '#ab47bc' },
  satellites: { label: '🛰 לוויינים', color: '#7c4dff' },
  aviation:   { label: '✈️ תעופה', color: '#ffd600' },
  ships:      { label: '🚢 ספינות', color: '#26c6da' },
  disaster:   { label: '🌎 אסונות', color: '#ef5350' },
  radiation:  { label: '☢️ קרינה', color: '#ffab00' },
  alerts:     { label: '🚨 התרעות', color: '#ff1744' }
};

const API_TIERS = {
  'free':       { label: 'חינם', badge: '🟢', usable: true },
  'key-free':   { label: 'מפתח חינמי', badge: '🟡', usable: false },
  'key-paid':   { label: 'בתשלום', badge: '🔴', usable: false },
  'deprecated': { label: 'הוצא משימוש', badge: '⚫', usable: false }
};

function getApisByCategory(cat) {
  return Object.entries(API_REGISTRY).filter(([, v]) => v.category === cat).map(([k, v]) => ({ key: k, ...v }));
}

function getTestableApis() {
  return Object.entries(API_REGISTRY).filter(([, v]) => v.testEndpoint && v.active).map(([k, v]) => ({ key: k, ...v }));
}

function getFreeApis() {
  return Object.entries(API_REGISTRY).filter(([, v]) => v.tier === 'free' && v.active).map(([k, v]) => ({ key: k, ...v }));
}

function getApiStats() {
  const all = Object.values(API_REGISTRY);
  return {
    total: all.length,
    free: all.filter(a => a.tier === 'free').length,
    keyFree: all.filter(a => a.tier === 'key-free').length,
    paid: all.filter(a => a.tier === 'key-paid').length,
    deprecated: all.filter(a => a.tier === 'deprecated').length,
    active: all.filter(a => a.active).length,
    testable: all.filter(a => a.testEndpoint).length,
    byCategory: Object.keys(API_CATEGORIES).map(cat => ({
      cat, ...API_CATEGORIES[cat],
      count: all.filter(a => a.category === cat).length,
      active: all.filter(a => a.category === cat && a.active).length
    }))
  };
}

if (typeof window !== 'undefined') {
  window.API_REGISTRY = API_REGISTRY;
  window.API_CATEGORIES = API_CATEGORIES;
  window.API_TIERS = API_TIERS;
  window.getApisByCategory = getApisByCategory;
  window.getTestableApis = getTestableApis;
  window.getFreeApis = getFreeApis;
  window.getApiStats = getApiStats;
}
