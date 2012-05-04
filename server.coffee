###
  Twock: the dumbest clock you've ever not known about.

  by mcginty and rios3
###
NotFound = (msg) ->
  @name = "NotFound"
  Error.call this, msg
  Error.captureStackTrace this, arguments.callee

# Requirements
fs        = require "fs"
connect   = require "connect"
express   = require "express"
io        = require "socket.io"
http      = require "http"
logule    = require('logule')
twock     = require "./lib/twock"
TwitterStream = require("./lib/twitterstream").TwitterStream

log = logule.sub 'server'

port = (process.env.PORT or 8081)



server = express.createServer()
server.configure ->
  server.set "views", __dirname + "/views"
  server.set "view options",
    layout: false

  server.use connect.bodyParser()
  server.use express.cookieParser()
  server.use express.session(secret: "shhhhhhhhh!")
  server.use connect.static(__dirname + "/static")
  server.use server.router

server.error (err, req, res, next) ->
  if err instanceof NotFound
    res.render "404.jade",
      locals:
        title: "404 - Not Found"
        description: ""
        author: ""
        analyticssiteid: "XXXXXXX"

      status: 404
  else
    res.render "500.jade",
      locals:
        title: "The Server Encountered an Error"
        description: ""
        author: ""
        analyticssiteid: "XXXXXXX"
        error: err

      status: 500

server.listen port
io = io.listen(server)
io.set('log level', 2)
io.sockets.on "connection", (socket) ->
  log.debug "Client Connected"
  socket.on "disconnect", ->
    log.debug "Client Disconnected."

log.info "Connecting to Twitter Streaming API"
stream = new TwitterStream(
  username: "jakemcginty"
  password: "JACOB98631"
  track: encodeURI(twock.filterlist)
)
stream.on "tweet", (tweetText) ->
  try
    tweet = JSON.parse(tweetText)
  catch error
    log.error error
    log.error "HTTP response: #{tweetText}"
    break
  if typeof tweet.text isnt "undefined" and tweet.text?
    try
      if tweet.geo?
        word = twock.matchWord tweet.text
        if tweet.geo.type == "Point" and word?
          options =
            host: "www.askgeo.com"
            port: 80
            path: "/api/1081001/bhgur2alif3ppcvvt39007ofho/timezone.json?points=" + tweet.geo.coordinates[0] + "%2C" + tweet.geo.coordinates[1]

          twock.grabAndPost tweet, options, word, io
    catch error
      log.error error
      log.error tweet

server.get "/", (req, res) ->
  res.render "index.jade",
    locals:
      title: "Twock"
      description: "Twick Twock"
      author: "Jake McGinty and Kellie Rios"
      analyticssiteid: "XXXXXXX"

server.get "/500", (req, res) ->
  throw new Error("This is a 500 Error")

server.get "/*", (req, res) ->
  throw new NotFound

log.info "Listening on http://0.0.0.0:" + port