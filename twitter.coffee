http = require('http')
Buffer = require('buffer').Buffer
EventEmitter = require('events').EventEmitter
_ = require('underscore')
cli = require('cli')

options = cli.parse
  username: ['u', 'Your twitter username', 'string'],
  password: ['p', 'Your twitter password', 'string'],
  track: ['t', 'The keywords to track', 'string']

TwitterStream = require('./lib/twitterstream').TwitterStream

streamer = new TwitterStream(options)

streamer.on 'tweet', (tweetText) ->
  tweet = JSON.parse(tweetText)
  if tweet.text?
    console.log tweet.user.screen_name + ': ' + tweet.text
  else if tweet.limit?
    console.log tweetText
  else
    console.log 'ERROR'
    console.log tweetText
    throw 'unknown tweet type'