/*
 *
 * Example Usage
 * var app = express();
 * app.use(libstats.initClient(app, {
 *   name: 'myAppNameHere',
 *   url: 'http://localhost:1337/stats',
 *   interval: 5000 // stats reporting interval
 * }));
 *
 */

var url = require('url');
var requestP = require('request-promise');
var os = require('os');
var dns = require('dns');

exports.version = '0.0.1';

/* options object containing user overwritable options */
var options = {
  username: null,
  name: null,
  url: 'http://localhost:8000/stats',
  interval: 30000,       /* 30 seconds */
  token: '',             /*    token   */
  hostname: os.hostname(),
  ip: null,
  port: null,
  enableIPv6: false,     /* enables grabbing ipv6 if it's first -> experimental <- */
  timeout: 10000
};

/* statistics object containing all gathered statistics */
var statistics = {};

/* payload is what is sent to the controller */
var payload = {
  hash: null,
  username: null,
  statistics: statistics
};

/* middleware that increases counts per endpoint hit */
var logEndPoint = function (req, res, next) {
  var path = url.parse(req.url).pathname;

  if (!statistics[path]) {
    statistics[path] = 0;
  }

  statistics[path]++;
  next();
};

/* post statistics to the controller every interval  */
var pushStatistics = function () {
  console.log(statistics);
  payload.statistics = statistics;
  statistics = {};

  requestP({
    url: options.url,
    method: "POST",
    json: true,
    body: payload,
    timeout: options.timeout
  })
    .then(function (response) {
      /* successfully sent the stats to the controller */
      setTimeout(pushStatistics, options.interval);
      return;
    })
    .catch(function (error) {
      if (error.statusCode !== 500) {
        /* maybe controller went offline try again */
        console.log('Error: Cannot Connect to Controller.  Trying to re-register');
        registerClient();
      } else {
        /* if statusCode is 500 then there's something wrong with token? *
         * try again in 10 minutes                                       */
        console.log('Critical Error: Retrying Registration in 10 minutes.  Check your token.');
        setTimeout(pushStatistics, 600000);
      }
    });
};

var registerClient = function () {
  console.log('Trying to Register Client');

  var registerInfo = {
    username: options.username,
    ip: options.ip,
    port: options.port,
    hostname: options.hostname,
    appname: options.name
  };

  requestP({
    url: options.url + '/register',
    method: "POST",
    json: true,
    body: registerInfo,
  })
    .then(function (response) {
      console.log('Successfully Registered Client');

      /* start monitoring */
      payload.hash = response;
      setTimeout(pushStatistics, options.interval);
    })
    .catch(function (error) {
      if (error.statusCode === 500) {
        /* failed to register client try again later */
        console.log('Registration Failure.  Internal Server Error.  Retrying in 10 minutes.');
        setTimeout(registerClient, 600000);
      } else {
        /* other error  */
        console.log('Registration Failure.  Retrying...');
        setTimeout(registerClient, 5000);
      }
    });
};

exports.initClient = function (app, opts) {

  /* fill options with user overrides */
  for (var props in opts) {
    if (options[props] !== undefined) {
      options[props] = opts[props];
    }
  }

  /* copy options to payload */
  for (var props in payload) {
    if (options[props] && props !== 'statistics') {
      payload[props] = options[props];
    }
  }

  /* ip is not defined so discover the first one that is not internal */
  if (!options.ip) {
    var interfaces = os.networkInterfaces();
    for (var interface in interfaces) {
      for (var idx = 0; idx < interfaces[interface].length; idx++) {
        if (interfaces[interface][idx].internal) {
          /* we don't care about internal IPs */
          continue;
        }

        if (options.enableIPv6 && interfaces[interface][idx].family === 'IPv6') {
          options.ip = interfaces[interface][idx].address;
          console.log('ip set to ' + options.ip);
          break;
        } else if (interfaces[interface][idx].family === 'IPv4') {
          options.ip = interfaces[interface][idx].address;
          console.log('ip set to ' + options.ip);
          break;
        } else {
          // uh what?
          console.log('Unknown IP Family.  Ignoring...');
        }
      }

      /* we got the ip just bail */
      if (options.ip) {
        break;
      }
    }
  }

  registerClient();
  return logEndPoint;
};
