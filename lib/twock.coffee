log   = require('logule').sub('twock')
fs    = require 'fs'
http  = require 'http'
# Allow json to be loaded safely by module.require
require.extensions[".json"] = (m) ->
  m.exports = JSON.parse(fs.readFileSync(m.filename))

# Twock-specific global variables
cache_expiration = 5 * 60 * 1000 # 5 minutes
local_zone = -6
words = require '../words.json'
filterlist = ""
filterlist += word.word + "," for word in words
filterlist = filterlist.slice(0, -1)

log.debug "Using filterlist: #{filterlist}"

pad = (number, length) ->
  str = "" + number
  str = "0" + str  while str.length < length
  str

isArray = (obj) ->
  Object::toString.call(obj) is "[object Array]"

getNumWithSetDec = (num, numOfDec) ->
  pow10s = Math.pow(10, numOfDec or 0)
  (if (numOfDec) then Math.round(pow10s * num) / pow10s else num)

getAverageFromNumArr = (numArr, numOfDec) ->
  return false  unless isArray(numArr)
  i = numArr.length
  sum = 0
  sum += numArr[i]  while i--
  getNumWithSetDec (sum / numArr.length), numOfDec

# zone range = [-12,12]
# therefore, we will map that to [-360,360] since that's easiest.
zoneToRadians = (zone, min, max) ->
  (zone-min)/(max-min) * 2*Math.PI

radiansToZone = (rads, min, max) ->
  res = rads*(max-min)/(2*Math.PI) + min
  if res < 0 then (max-min)+res else res

getCircularAverage = (zones, dec, min, max) ->
  return false unless isArray(zones)
  angles = (zoneToRadians zone, min, max for zone in zones)
  avg = Math.atan2 (angles.reduce ((x,y)->x + Math.sin(y)), 0), (angles.reduce ((x,y)->x + Math.cos(y)), 0)
  getNumWithSetDec radiansToZone(avg, min, max), dec

getVariance = (numArr, numOfDec, min, max) ->
  return false  unless isArray(numArr)
  avg = getCircularAverage(numArr, numOfDec, min, max)
  i = numArr.length
  v = 0
  v += Math.pow((numArr[i] - avg), 2)  while i--
  v /= numArr.length
  getNumWithSetDec v, numOfDec

getStandardDeviation = (numArr, numOfDec, min, max) ->
  return false  unless isArray(numArr)
  stdDev = Math.sqrt(getVariance(numArr, numOfDec, min, max))
  getNumWithSetDec stdDev, numOfDec

realTimeFromFloat = (floatTime) ->
  hours = Math.floor(floatTime)
  mins = Math.abs(Math.floor((hours - floatTime) * 59))
  hours += 24  while hours < 0
  "" + pad(Math.floor(hours), 2) + ":" + pad(mins, 2)

getTimeArray = (sources) ->
  times = []
  for source in sources
    times.push source.time
  times

expireOldPosts = (timeDifferenceMs) ->
  now = +new Date
  for word in words
    word.sources.filter (x) -> (now - x.stamp) <= timeDifferenceMs

addTimeSource = (in_word, time, io) ->
  for word in words
    if word.word is in_word.word
      word.sources.push
        time: time
        stamp: +new Date

      fTime = local_zone-time+word.time
      strTime = realTimeFromFloat(fTime)
      [fGuessedTime, stdev] = guessTimeFromZone(local_zone)
      strGuessedTime = realTimeFromFloat(fGuessedTime)

      log.info "#{fTime} -> #{strTime.yellow} -> #{strGuessedTime.green} [+- #{stdev}]"
      #log.info "Variance for word #{ word.word } is now #{ getVariance(getTimeArray(word.sources), 4) }"
      io.sockets.emit "guess",
        time: strGuessedTime
        stdev: stdev
        zone: local_zone
  expireOldPosts cache_expiration

matchWord = (tweet) ->
  for word in words
    return word  if tweet.search(new RegExp(word.word, "i")) > -1
  null

guessTimeFromZone = (zone) ->
  guesses = []
  stdevs = []
  for word in words
    times = getTimeArray(word.sources)
    guesses.push zone - getCircularAverage(times, 2, -12, 12) + word.time  if word.sources.length > 0
    stdevs.push getVariance(times, 2, -12, 12) if word.sources.length > 0
  avgstd = getAverageFromNumArr(stdevs, 2)
  log.debug "guesses: #{getNumWithSetDec(guess, 2) for guess in guesses} with stdev #{getVariance(guesses, 2, 0, 24)}"
  log.debug "stdevs: #{stdevs} with avg #{avgstd}"
  guesses = guesses.filter (e,i,a)-> stdevs[i] < avgstd
  log.debug "filtered guesses: #{getNumWithSetDec(guess, 2) for guess in guesses} with stdev #{getVariance(guesses, 2, 0, 24)}"

  [(getCircularAverage guesses, 2, 0, 24), getStandardDeviation(guesses,2, 0, 24)]

grabAndPost = (tweet, options, word, io) ->
  http.get(options, (res) ->
    res.on "data", (data) ->
      try
        tzone = JSON.parse(data.toString("utf8"))
      catch err
        return null
      if not tzone.data[0].currentOffsetMs?
        log.error "RATE LIMIT detected by AskGeo."
        return null
      log.info word.word.yellow.bold + " (" + word.time + ") is from GMT offset " + (tzone.data[0].currentOffsetMs / 3600000)
      addTimeSource word, tzone.data[0].currentOffsetMs / 3600000, io
      io.sockets.emit "tweet",
        tweet:
          text: tweet.text
          coordinates: tweet.geo.coordinates
          timezone: (tzone.data[0].currentOffsetMs / 3600000)

        word: word
  ).on "error", (e) ->
    log.error "Got error: #{e.message}"

exports.filterlist = filterlist
exports.guessTimeFromZone = guessTimeFromZone
exports.matchWord = matchWord
exports.grabAndPost = grabAndPost
exports.radiansToZone = radiansToZone
exports.zoneToRadians = zoneToRadians
exports.getCircularAverage = getCircularAverage