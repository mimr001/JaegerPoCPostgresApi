'use strict'

////////////////////// START Jaeger Stuff /////////////////////////
// Auto instrumentation MUST BE ON FIRST LINE TO KICK IN!!!
const Instrument = require('@risingstack/opentracing-auto')

// Jaeger tracer (standard distributed tracing)
const jaeger = require('jaeger-client')
const UDPSender = require('jaeger-client/dist/src/reporters/udp_sender').default
const sampler = new jaeger.RateLimitingSampler(10)
// Need this since the Jaeger server parts (reporter, collector, storage etc) are running outside the scope of
// our Docker stack in this PoC. Real case scenario, the Jaeger server parts will either run in the same
// Docker stack or in a separate Docker stack but on the same host to avoid network latency
const reporter = new jaeger.RemoteReporter(new UDPSender({
  // host: 'ec2-54-93-196-139.eu-central-1.compute.amazonaws.com', // Directly on EC2 Node for now...
  // host: 'docker.for.mac.localhost',
  // host: 'localhost',
  // port: 6832
  host: process.env.JAEGER_AGENT_UDP_HOST,
  port: process.env.JAEGER_AGENT_UDP_PORT
}))
const jaegerTracer = new jaeger.Tracer('jaeger-poc-postgresapi-jaeger-tracer', reporter, sampler)

// Metrics tracer ("free" metrics data through the use of a second tracer)
const {Tags, FORMAT_HTTP_HEADERS} = require('opentracing')
const MetricsTracer = require('@risingstack/opentracing-metrics-tracer')
const prometheusReporter = new MetricsTracer.PrometheusReporter()
const metricsTracer = new MetricsTracer('jaeger-poc-postgresapi-metrics-tracer', [prometheusReporter])

const tracers = [metricsTracer, jaegerTracer]
const instrument = new Instrument({
  tracers: tracers
})
////////////////////// END Jaeger Stuff /////////////////////////

// THESE GET AUTO INSTRUMENTED THANKS TO THE FIRST LINE
const express = require("express")
const http = require('http')
// const massive = require('massive')
const knex = require('knex')

console.log("Jaeger UDP host:" + process.env.JAEGER_AGENT_UDP_HOST)
console.log("Jaeger UDP port:" + process.env.JAEGER_AGENT_UDP_PORT)

const db = knex({
  client: 'pg',
  // connection: 'postgres://postgres:@localhost:5432/postgres'
  connection: 'postgres://postgres:@postgres:5432/postgres'
})

var app = express();
var count = 1

app.get('/pgdata', async (req, res, next) => {
  const query = 'SELECT ' + count + ' AS dummy'
  const { rows } = await db.raw(query)
  count++
  res.json(rows)
  next()
})

app.get('/metrics', (req, res) => {
  res.set('Content-Type', MetricsTracer.PrometheusReporter.Prometheus.register.contentType)
  res.end(prometheusReporter.metrics())
})

http.createServer(app).listen(8082, function() {
  console.log('Listening on port 8082')
})

