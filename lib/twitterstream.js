(function() {
  var Buffer, EventEmitter, LineParser, TwitterStream, https, _,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  https = require('https');

  Buffer = require('buffer').Buffer;

  EventEmitter = require('events').EventEmitter;

  _ = require('underscore');

  LineParser = require('line-parser');

  TwitterStream = (function(_super) {

    __extends(TwitterStream, _super);

    function TwitterStream(options) {
      var headers, lineParser, request,
        _this = this;
      this.options = options;
      lineParser = new LineParser();
      lineParser.on('line', function(line) {
        return _this.emit('tweet', line);
      });
      headers = {};
      headers['Authorization'] = this.basicAuth(this.options.username, this.options.password);
      options = {
        host: 'stream.twitter.com',
        path: '/1/statuses/filter.json?track=' + this.options.track,
        headers: headers
      };
      request = https.get(options, function(response) {
        response.setEncoding('utf8');
        return response.on('data', function(chunk) {
          return lineParser.chunk(chunk);
        });
      });
    }

    TwitterStream.prototype.basicAuth = function(user, pass) {
      return "Basic " + new Buffer(user + ":" + pass).toString('base64');
    };

    return TwitterStream;

  })(EventEmitter);

  exports.TwitterStream = TwitterStream;

}).call(this);
