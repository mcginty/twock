# Author: YOU

$(document).ready ->
  #jQuery.fx.interval = 100
  maxMarkers = 50
  arteriesStyle = [
    {
      stylers: [
        { visibility: "off" }
      ]
    },{
      featureType: "water",
      elementType: "geometry",
      stylers: [
        { visibility: "on" },
        { saturation: 73 },
        { lightness: -20 },
        { gamma: 0.96 }
      ]
    }
  ]

  pad = (number, length) ->
    str = "" + number
    str = "0" + str  while str.length < length
    str

  realTimeFromFloat = (floatTime) ->
    hours = Math.floor(floatTime)
    mins = Math.abs(Math.floor((hours - floatTime) * 59))
    hours += 24  while hours < 0
    "" + pad(Math.floor(hours), 2) + ":" + pad(mins, 2)
  
  arteriesMapType = new google.maps.StyledMapType(arteriesStyle, {name: "Simple"})

  mapsOptions =
    center: new google.maps.LatLng(37.71859032558813, -97.822265625)
    center: new google.maps.LatLng(37.71859032558813, -97.822265625)
    zoom: 3
    mapTypeControlOptions:
      mapTypeIds: ['arteries', google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.TERRAIN]

  markers = []
  lastInfoWindow = null

  map = new google.maps.Map(document.getElementById("map_canvas"), mapsOptions)

  map.mapTypes.set 'arteries', arteriesMapType 
  map.setMapTypeId 'arteries'

  morning = new google.maps.MarkerImage( 'images/MorningBird.png',
    new google.maps.Size(30,21),
    new google.maps.Point(0,0),
    new google.maps.Point(3, 18))

  afternoon = new google.maps.MarkerImage( 'images/AfternoonBird.png',
    new google.maps.Size(30,21),
    new google.maps.Point(0,0),
    new google.maps.Point(3, 18))

  night = new google.maps.MarkerImage( 'images/NightBird.png',
    new google.maps.Size(30,21),
    new google.maps.Point(0,0),
    new google.maps.Point(3, 18))

  golden = new google.maps.MarkerImage( 'images/GoldenBird.png',
    new google.maps.Size(30,21),
    new google.maps.Point(0,0),
    new google.maps.Point(3, 18))

  shadow = new google.maps.MarkerImage( 'images/shadow.png',
    new google.maps.Size(40,21),
    new google.maps.Point(0,0),
    new google.maps.Point(3, 18))

  timeToImg = (time) ->
      if 5 <= time < 12
        return morning
      else if 12 <= time < 17
        return afternoon
      else
        return night

  $('#key').click -> $(this).fadeOut()
  $('#title').click -> $(this).fadeOut()
  socket = io.connect()

  recentTweet = false
  highlightedMarker = null
  highlightedMarkerIcon = null
  socket.on 'tweet', (data) ->
    infowindow = new google.maps.InfoWindow
      content: '<div id="content"><div id="text" class="pullquote">'+data.tweet.text.replace(new RegExp(data.word.word, 'i'), "<strong>#{data.word.word}</strong>")+'</div><div id="guess_explanation">'+"\"#{data.word.word}\" is usually posted at #{realTimeFromFloat(data.word.time)} local time, so we used that correlation with the location of the tweet to guess your time.</div></div>"
    marker = new google.maps.Marker
      map:map
      animation:google.maps.Animation.DROP
      position: new google.maps.LatLng(data.tweet.coordinates[0], data.tweet.coordinates[1])
      title: data.word.word
      icon: timeToImg(data.word.time)
      shadow: shadow
    markers.push marker
    markers.shift() if markers.length > maxMarkers
    google.maps.event.addListener marker, 'click', ->
      lastInfoWindow.close() if lastInfoWindow?
      infowindow.open(map,marker)
      lastInfoWindow = infowindow
    if not recentTweet
      recentTweet = true
      $('#tweet').fadeOut 'fast', ->
        highlightedMarker.setIcon(highlightedMarkerIcon) if highlightedMarker?
        highlightedMarker = marker
        highlightedMarkerIcon = marker.getIcon()
        $(this).html(data.tweet.text.replace(new RegExp(data.word.word, 'i'), "<strong>#{data.word.word}</strong>")).fadeIn('fast')
      setTimeout (-> recentTweet = false), 3000

  socket.on 'guess', (guess) ->
      $('#time').html "#{guess.time}<span id=\"stdev\">σ = #{guess.stdev}</span>"
  