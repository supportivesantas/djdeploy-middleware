var express = require('express');
var libstats = require('./lib/libstats');
var app = express();


app.use(libstats.initClient(app, {
  username: 'zelifus',            /* your github username                  */
  name: 'test',                   /* your app name                         */
  port: 8080,                     /* your app port number                  */
  interval: 600000,               /* suggested reporting interval: 10 min) */
  url: 'https://www.djdeploy.com/stats'
}));

app.get('/*', function (req, res) {
  res.send('Hello World');
});

var server = app.listen(8080, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log("Example app listening at http://%s:%s", host, port);

});
