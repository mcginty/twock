###
  Twock: the dumbest clock you've ever not known about.

  by mcginty and rios3
###

# Requirements
fs        = require "fs"
connect   = require "connect"
http      = require "http"
logule    = require('logule')
twock     = require "./lib/twock"
redis   = require("redis").createClient(null,null,{detect_buffers:true})
TwitterStream = require("./lib/twitterstream-gardenhose").TwitterStream

log = logule.sub 'learn'
dict = {}
Array::unique = ->
  output = {}
  output[@[key]] = @[key] for key in [0...@length]
  value for key, value of output

log.info "Connecting to Twitter Streaming API"
stream = new TwitterStream(
  username: "jakemcginty"
  password: "JACOB98631"
)
stream.on "tweet", (tweetText) ->
  try
    tweet = JSON.parse(tweetText)
  catch error
    log.error error
    log.error "HTTP response: #{tweetText}"
    process.exit 1
  if tweet.text?
    try
      if tweet.geo?
        if tweet.geo.type == "Point"
          options =
            host: "www.askgeo.com"
            port: 80
            path: "/api/1081001/bhgur2alif3ppcvvt39007ofho/timezone.json?points=" + tweet.geo.coordinates[0] + "%2C" + tweet.geo.coordinates[1]

          http.get(options, (res) ->
            res.on "data", (data) ->
              try
                tzone = JSON.parse(data.toString("utf8"))
              catch err
                return null
              if not tzone.data[0].currentOffsetMs?
                log.error "RATE LIMIT detected by AskGeo."
                return null
              zone = tzone.data[0].currentOffsetMs / 3600000
              text = tweet.text
              for key, entitylist of tweet.entities
                for entity in entitylist
                  #text = (text.slice 0, entity.indices[0]) + text.slice entity.indices[1] if entity.indices?
                  text = text.replace entity.url, '' if entity.url?
                  text = text.replace "@#{entity.screen_name}", '' if entity.screen_name?
                  text = text.replace entity.text, '' if entity.text?
              text = text.replace '\bRT\b', '' # remove stupid retweet things
              text = text.replace /\W+|\s+/gm, ' ' # kill all odd characters
              words = (text.split ' ').unique() # only keep a word once
              words = (word.toLowerCase() for word in words) # make them all lowercase just because
              for word in words
                redis.lpush "words:#{word}", (new Date()).getUTCHours() + zone
              log.debug "#{text.yellow.bold}"
              for k,v of dict
                log.debug v
                log.debug "#{k}: #{twock.getVariance(v.times,2,0,24)}"

          ).on "error", (e) ->
            log.error "Got error: #{e.message}"
    catch error
      log.error error
      log.error tweet