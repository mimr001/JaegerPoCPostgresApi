const express = require("express")
const http = require('http')
const massive = require("massive")

var app = express();
var count = 1

massive({
  host: 'postgres',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: ''
}).then(instance => {
  app.set('db', instance);

  app.get('/pgdata', function(req, res, next) {
    app.get('db').run('select ' + count + ' as dummy')
      .then(rs => {
        res.send(rs)
        count++
      })
  })

  http.createServer(app).listen(8082, function() {
    console.log('Listening on port 8082')
  })
})
