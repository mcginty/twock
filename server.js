//setup Dependencies
var fs = require('fs')
    , connect = require('connect')
    , express = require('express')
    , io = require('socket.io')
    , io_client = require('socket.io-client')
    , http = require('http')
    , TwitterStream = require('./lib/twitterstream').TwitterStream
    , port = (process.env.PORT || 8081);

require.extensions[".json"] = function (m) {
    m.exports = JSON.parse(fs.readFileSync(m.filename));
};
var cache_expiration = 5*60*1000; // 5 minutes in milliseconds
var local_zone = -6; //GMT
var words = require('./words.json');
var filterlist = "";
for(var i=words.length-1; i>=0; i--) {
  filterlist += words[i].word + ",";
}
filterlist = filterlist.slice(0, -1)
console.log("Using filterlist: " + filterlist);

var pad = function(number, length) {
    var str = '' + number;
    while (str.length < length) { str = '0' + str; }
    return str;
},
isArray = function (obj) {
  return Object.prototype.toString.call(obj) === "[object Array]";
},
getNumWithSetDec = function( num, numOfDec ){
  var pow10s = Math.pow( 10, numOfDec || 0 );
  return ( numOfDec ) ? Math.round( pow10s * num ) / pow10s : num;
},
getAverageFromNumArr = function( numArr, numOfDec ){
  if( !isArray( numArr ) ){ return false; }
  var i = numArr.length, 
    sum = 0;
  while( i-- ){
    sum += numArr[ i ];
  }
  return getNumWithSetDec( (sum / numArr.length ), numOfDec );
},
getVariance = function( numArr, numOfDec ){
  if( !isArray(numArr) ){ return false; }
  var avg = getAverageFromNumArr( numArr, numOfDec ), 
    i = numArr.length,
    v = 0;
 
  while( i-- ){
    v += Math.pow( (numArr[ i ] - avg), 2 );
  }
  v /= numArr.length;
  return getNumWithSetDec( v, numOfDec );
},
getStandardDeviation = function( numArr, numOfDec ){
  if( !isArray(numArr) ){ return false; }
  var stdDev = Math.sqrt( getVariance( numArr, numOfDec ) );
  return getNumWithSetDec( stdDev, numOfDec );
},
realTimeFromFloat = function(floatTime) {
  hours = Math.floor(floatTime)
  mins = Math.abs(Math.floor((hours-floatTime)*59))
  if (hours < 0) hours = 24 + hours
  return ""+pad(Math.floor(hours),2)+":"+pad(mins,2)
},
getTimeArray = function(sources) {
  times = []
  for(var i=sources.length-1; i>=0; i--) {
    times.push(sources[i].time);
  }
  return times;
},
expireOldPosts = function(timeDifferenceMs) {
  now = +new Date;
  for(var i=words.length-1; i>=0; i--) {

    var expired = [];
    // create a list of indexes to be expired
    l = words[i].sources.length;
    for(var j=0; j<l; j++) {
      if ((now - words[i].sources[j].stamp) > timeDifferenceMs) {
        expired.push(j);
        // console.log("expiring object with index " + j);
      }
    }
    // expire those indexes from highest to lowest by removing them backwards to avoid weird splicing
    for(var j=expired.length-1; j>=0; j--) {
      words[i].sources.splice(expired[j],1);
    }
  }
},
addTimeSource = function(word, time) {
  for(var i=words.length-1; i>=0; i--) {
    if (words[i].word == word.word) {
      words[i].sources.push({time: time, stamp: +new Date});
      console.log("Variance for word " + words[i].word + " is now " + getVariance(getTimeArray(words[i].sources), 4));
      console.log("Current guess for local time: " + realTimeFromFloat(guessTimeFromZone(local_zone)));
      io.sockets.emit('guess', {
        time: realTimeFromFloat(guessTimeFromZone(local_zone)),
        zone: local_zone // GMT-0
      });
    }
  }
  expireOldPosts(cache_expiration); // Cleanup duty.
},
matchWord = function(tweet) {
  for(var i=words.length-1; i>=0; i--) {
    if (tweet.search(new RegExp(words[i].word, 'i')) > -1) {
      return words[i];
    }
  }
  return null;
},
guessTimeFromZone = function(zone) {
  guesses = []
  // Get average timezone for each word, subtract it from our time zone and add the local offset for word
  for(var i=words.length-1; i>=0; i--) {
    if (words[i].sources.length > 0) {
      //if (getVariance(getTimeArray(words[i].sources), 4) < 10) {
        guesses.push(zone - getAverageFromNumArr(getTimeArray(words[i].sources)) + words[i].time);
      //}
    }
  }
  return getAverageFromNumArr(guesses);
};

function grabAndPost(tweet, options, word) {
  http.get(options, function(res) {
    res.on('data', function(data) {
      try { tzone = JSON.parse(data.toString('utf8')); }
      catch(err) { return null; }
      if (typeof tzone.data === "undefined" || typeof tzone.data[0] === "undefined" || typeof tzone.data[0].currentOffsetMs === "undefined") {
        console.log("RATE LIMIT detected by AskGeo.");
        return null;
      } 
      addTimeSource(word, tzone.data[0].currentOffsetMs/3600000);
      console.log("Tweet matching " + word.word + " ("+word.time+") is from GMT offset " + (tzone.data[0].currentOffsetMs/3600000));
      // Submit a minimized data packet through SocketIO to our server distribution IO
      io.sockets.emit('tweet', 
        {
          tweet: {
            text: tweet.text,
            coordinates: tweet.geo.coordinates,
            timezone: (tzone.data[0].currentOffsetMs/3600000)
          },
          word: word});
    });
  }).on('error', function(e) {
    console.log("Got error: " + e.message);
  });
}
//Setup Express
var server = express.createServer();
server.configure(function(){
    server.set('views', __dirname + '/views');
    server.set('view options', { layout: false });
    server.use(connect.bodyParser());
    server.use(express.cookieParser());
    server.use(express.session({ secret: "shhhhhhhhh!"}));
    server.use(connect.static(__dirname + '/static'));
    server.use(server.router);
});

//setup the errors
server.error(function(err, req, res, next){
    if (err instanceof NotFound) {
        res.render('404.jade', { locals: { 
                  title : '404 - Not Found'
                 ,description: ''
                 ,author: ''
                 ,analyticssiteid: 'XXXXXXX' 
                },status: 404 });
    } else {
        res.render('500.jade', { locals: { 
                  title : 'The Server Encountered an Error'
                 ,description: ''
                 ,author: ''
                 ,analyticssiteid: 'XXXXXXX'
                 ,error: err 
                },status: 500 });
    }
});
server.listen(port);

  //Setup Socket.IO
  var io = io.listen(server);
  io.sockets.on('connection', function(socket){
      console.log('Client Connected');
      // If we get a tweet in from node, broadcast to all listening clients.
      socket.on('disconnect', function(){
        console.log('Client Disconnected.');
      });
  });

/*var localhost = io_client.connect('http://localhost:8081');
localhost.on('disconnect', function() {
  console.log("DISCONNECT DETECTED");
});
localhost.on('error', function() {
  console.log("ERROR DETECTED");
});*/
console.log("Attempting TwitterStream connection.");
var stream = new TwitterStream({
  username: 'jakemcginty',
  password: 'JACOB98631',
  track: encodeURI(filterlist)
});

stream.on('tweet', function(tweetText) {
  var tweet = JSON.parse(tweetText);
  if (typeof tweet.text !== "undefined" && tweet.text != null) {
    //if (typeof tweet.user.time_zone !== "undefined" && tweet.user.time_zone != null) {
    if (tweet.geo != null) {
      word = matchWord(tweet.text);
      //console.log(tweet);
      // For now, let's only deal with Point-type geolocation data
      // Also, if we can't figure out what filter the tweet was matched to, we can't get anywhere so just skip.
      if (tweet.geo.type = 'Point' && word != null) {
        // Use AskGeo API to lookup the timezone offset from GMT
        var options = {
          host: 'www.askgeo.com',
          port: 80,
          path: '/api/1081001/bhgur2alif3ppcvvt39007ofho/timezone.json?points='
            + tweet.geo.coordinates[0] + '%2C' + tweet.geo.coordinates[1]
        }
        grabAndPost(tweet, options, word)
      }
    }
  }
});



///////////////////////////////////////////
//              Routes                   //
///////////////////////////////////////////

/////// ADD ALL YOUR ROUTES HERE  /////////

server.get('/', function(req,res){
  res.render('index.jade', {
    locals : { 
              title : 'Twock'
             ,description: 'Twick Twock'
             ,author: 'Jake McGinty and Kellie Rios'
             ,analyticssiteid: 'XXXXXXX'
            }
  });
});


//A Route for Creating a 500 Error (Useful to keep around)
server.get('/500', function(req, res){
    throw new Error('This is a 500 Error');
});

//The 404 Route (ALWAYS Keep this as the last route)
server.get('/*', function(req, res){
    throw new NotFound;
});

function NotFound(msg){
    this.name = 'NotFound';
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}


console.log('Listening on http://0.0.0.0:' + port );
