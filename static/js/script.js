(function() {

  $(document).ready(function() {
    var afternoon, arteriesMapType, arteriesStyle, golden, lastInfoWindow, map, mapsOptions, markers, maxMarkers, morning, night, pad, realTimeFromFloat, recentTweet, shadow, socket, timeToImg;
    maxMarkers = 50;
    arteriesStyle = [
      {
        stylers: [
          {
            visibility: "off"
          }
        ]
      }, {
        featureType: "water",
        elementType: "geometry",
        stylers: [
          {
            visibility: "on"
          }, {
            saturation: 73
          }, {
            lightness: -20
          }, {
            gamma: 0.96
          }
        ]
      }
    ];
    pad = function(number, length) {
      var str;
      str = "" + number;
      while (str.length < length) {
        str = "0" + str;
      }
      return str;
    };
    realTimeFromFloat = function(floatTime) {
      var hours, mins;
      hours = Math.floor(floatTime);
      mins = Math.abs(Math.floor((hours - floatTime) * 59));
      while (hours < 0) {
        hours += 24;
      }
      return "" + pad(Math.floor(hours), 2) + ":" + pad(mins, 2);
    };
    arteriesMapType = new google.maps.StyledMapType(arteriesStyle, {
      name: "Simple"
    });
    mapsOptions = {
      center: new google.maps.LatLng(37.71859032558813, -97.822265625),
      center: new google.maps.LatLng(37.71859032558813, -97.822265625),
      zoom: 3,
      mapTypeControlOptions: {
        mapTypeIds: ['arteries', google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.TERRAIN]
      }
    };
    markers = [];
    lastInfoWindow = null;
    map = new google.maps.Map(document.getElementById("map_canvas"), mapsOptions);
    map.mapTypes.set('arteries', arteriesMapType);
    map.setMapTypeId('arteries');
    morning = new google.maps.MarkerImage('images/MorningBird.png', new google.maps.Size(30, 21), new google.maps.Point(0, 0), new google.maps.Point(3, 18));
    afternoon = new google.maps.MarkerImage('images/AfternoonBird.png', new google.maps.Size(30, 21), new google.maps.Point(0, 0), new google.maps.Point(3, 18));
    night = new google.maps.MarkerImage('images/NightBird.png', new google.maps.Size(30, 21), new google.maps.Point(0, 0), new google.maps.Point(3, 18));
    golden = new google.maps.MarkerImage('images/GoldenBird.png', new google.maps.Size(30, 21), new google.maps.Point(0, 0), new google.maps.Point(3, 18));
    shadow = new google.maps.MarkerImage('images/shadow.png', new google.maps.Size(40, 21), new google.maps.Point(0, 0), new google.maps.Point(3, 18));
    timeToImg = function(time) {
      if ((5 <= time && time < 12)) {
        return morning;
      } else if ((12 <= time && time < 17)) {
        return afternoon;
      } else {
        return night;
      }
    };
    $('#key').click(function() {
      return $(this).fadeOut();
    });
    $('#title').click(function() {
      return $(this).fadeOut();
    });
    socket = io.connect();
    recentTweet = false;
    socket.on('tweet', function(data) {
      var infowindow, marker;
      infowindow = new google.maps.InfoWindow({
        content: '<div id="content"><div id="text" class="pullquote">' + data.tweet.text.replace(new RegExp(data.word.word, 'i'), "<strong>" + data.word.word + "</strong>") + '</div><div id="guess_explanation">' + ("\"" + data.word.word + "\" is usually posted at " + (realTimeFromFloat(data.word.time)) + " local time, so we used that correlation with the location of the tweet to guess your time.</div></div>")
      });
      marker = new google.maps.Marker({
        map: map,
        animation: google.maps.Animation.DROP,
        position: new google.maps.LatLng(data.tweet.coordinates[0], data.tweet.coordinates[1]),
        title: data.word.word,
        icon: timeToImg(data.word.time),
        shadow: shadow
      });
      markers.push(marker);
      if (markers.length > maxMarkers) markers.shift();
      google.maps.event.addListener(marker, 'click', function() {
        if (lastInfoWindow != null) lastInfoWindow.close();
        infowindow.open(map, marker);
        return lastInfoWindow = infowindow;
      });
      if (!recentTweet) {
        recentTweet = true;
        $('#tweet').fadeOut('fast', function() {
          return $(this).html(data.tweet.text.replace(new RegExp(data.word.word, 'i'), "<strong>" + data.word.word + "</strong>")).fadeIn('fast');
        });
        return setTimeout((function() {
          return recentTweet = false;
        }), 3000);
      }
    });
    return socket.on('guess', function(guess) {
      return $('#time').html("" + guess.time + "<span id=\"stdev\">σ = " + guess.stdev + "</span>");
    });
  });

}).call(this);
