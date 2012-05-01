/* Author: YOUR NAME HERE
*/
var ge;
google.load("earth", "1");
function init() {
  google.earth.createInstance('map3d', initCallback, failureCallback);
}
function initCallback(pluginInstance) {
  ge = pluginInstance;
  ge.getWindow().setVisibility(true);
  // add a navigation control
  ge.getNavigationControl().setVisibility(ge.VISIBILITY_AUTO);
  // add some layers
  ge.getLayerRoot().enableLayerById(ge.LAYER_BORDERS, false);
  ge.getLayerRoot().enableLayerById(ge.LAYER_ROADS, false);

  var lookAt = ge.getView().copyAsLookAt(ge.ALTITUDE_RELATIVE_TO_GROUND);

  // USA USA
  lookAt.setLatitude(38);
  lookAt.setLongitude(-96);
  lookAt.setTilt(0.0);
  lookAt.setHeading(0.0);
  lookAt.setRange(5000000.0);
  ge.getView().setAbstractView(lookAt);
}
function failureCallback(errorCode) {
}
function createPlacemark(lat,lon,name,img) {
  var placemark = ge.createPlacemark('');
  placemark.setName(name);
  ge.getFeatures().appendChild(placemark);

  // Create style map for placemark
  var icon = ge.createIcon('');
  icon.setHref(img);
  var style = ge.createStyle('');
  style.getIconStyle().setIcon(icon);
  placemark.setStyleSelector(style);

  // Create point
  var la = ge.getView().copyAsLookAt(ge.ALTITUDE_RELATIVE_TO_GROUND);
  var point = ge.createPoint('');
  point.setLatitude(lat);
  point.setLongitude(lon);
  placemark.setGeometry(point);
}
function timeToImg(time) {
    if (time >= 5 && time < 12) {
        return 'http://localhost:8081/images/MorningBird.png';
    }
    else if (time >= 12 && time < 17) {
        return 'http://localhost:8081/images/AfternoonBird.png';
    }
    else {
        return 'http://localhost:8081/images/NightBird.png';
    }
}
$(document).ready(function() {

    var socket = io.connect();

    $('#sender').bind('click', function() {
        socket.emit('message', 'Message Sent on ' + new Date());
    });

    socket.on('tweet', function(data){
        $('#tweets').prepend('<div id="tweet">' + data.tweet.text + '</div>');
        createPlacemark(
            data.tweet.coordinates[0],
            data.tweet.coordinates[1],
            data.word.word,
            timeToImg(data.word.time));
    });

    socket.on('guess', function(guess){
        $('#time').html("#{guess.time} (&plusmn;#{guess.stdev}));
    });
});