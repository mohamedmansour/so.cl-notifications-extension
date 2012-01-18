/**
 * Modifies each Ajax request by signing the request so we could
 * be authenticated to the so.cl platform.
 *
 * @author Mohamed Mansour 2012 <hello@mohamedmansour.com>
 */
SoclAPI = function() {
  this.signingkey = null;
  this.timeshift = 0;
  this.notifications = {
    Notifications: {},
    Parties: {}
  };
  $.ajaxPrefilter(this.preAuthFilter.bind(this));
};

SoclAPI.SECRET_KEY_SERVICE = 'http://www.so.cl/app/SecretKey';
SoclAPI.NOTIFICATION_SERVICE = 'http://www.so.cl/Fusion/OpenV4/Notifications?last=10&consolidate=true';
SoclAPI.NOTIFICATION_CHECK_SERVICE = 'http://www.so.cl/Fusion/OpenV4/$batch';
SoclAPI.NOTIFICATION_SEEN_SERVICE = 'http://www.so.cl/Fusion/OpenV4/Notifications(\'seen\')';
SoclAPI.GLOBAL_COUNTERS_SERVICE = 'http://www.so.cl/Fusion/GlobalCountersV1/$batch';
SoclAPI.SEARCH_SERVICE = 'http://www.so.cl/Fusion/OpenV4/streamsearch'; //('9397')

/**
 * We we require the signing key so we can sign every AJAX Request.
 */
SoclAPI.prototype.login = function() {
  var xhr = $.ajax({
    type: 'GET',
    url: SoclAPI.SECRET_KEY_SERVICE,
    data: null,
    async: false
  });
  var resp = JSON.parse(xhr.responseText);
  var now = (new Date().valueOf() * 0.001) | 0; // convert to unix time
  this.signingkey = resp.key;
  this.timeshift = resp.ts - now;
};

/**
 * Checks if the string ends with the specified pattern.
 * 
 * @param {string} input The data to check.
 * @param {pattern} pattern The pattern to match.
 */
SoclAPI.prototype.endsWith = function(input, pattern) {
  var d = input.length - pattern.length;
  return d >= 0 && input.lastIndexOf(pattern) === d;
};

/**
 * Checks if the input is null or has any whitespace.
 * 
 * @param {string} input The data to check.
 */
SoclAPI.prototype.isNullOrWhiteSpace = function(input) {
  if (input == null) return true;
  return input.replace(/\s/g, '').length < 1;
};

/**
 * Use HMAC-SHA256 to sign the give data
 * 
 * @param {string} data Data for signing.
 * @param {string} key Secret signing key
 */
SoclAPI.prototype.SignHMACSHA256 = function(data, key) {
  return Crypto.HMAC(Crypto.SHA256, data, key, { asBytes: true });
};

/**
 * Use HMAC-SHA256 to sign the give data and return in a BASE64 encoded string
 * 
 * @param {string} data Data for signing.
 * @param {string} key Secret signing key
 */
SoclAPI.prototype.Base64SignHMACSHA256 = function(data, key) {
  return Crypto.util.bytesToBase64(this.SignHMACSHA256(data, key));
};

/**
 * Install the preauth filter so we can sign every single ajax request.
 * 
 * @param {object} option AJAX Request option.
 */
SoclAPI.prototype.preAuthFilter = function(options) {
  var url = options.url,
      urlLower = options.url.toLowerCase();
  if (urlLower.indexOf('fusion/') == -1 || this.endsWith(urlLower, '.js', true)) {
    return;
  }
  // If we have a signing key, then sign the request
  if (this.signingkey) {
    var ts = ((new Date().valueOf() * 0.001) | 0) + this.timeshift,
        queryIdx = url.indexOf('?'),
        idx1 = url.indexOf('('),
        idx2 = url.indexOf(')'),
        data = !this.isNullOrWhiteSpace(options.data) ? options.data : '';
    data += queryIdx != -1 ? decodeURIComponent(url.substr(queryIdx + 1)) : '';
    data += (idx1 > 0 && idx2 > 0 && idx2 > idx1 && (queryIdx == -1 || queryIdx > idx2)) ? url.substring(idx1 + 1, idx2) : '';
    data += ts;
    var sig = this.Base64SignHMACSHA256('' + data, this.signingkey);
    options.headers = { ts: ts, sig: sig };
  }
};

/**
 * If the signing key is null, it assumes you are not logged on.
 */
SoclAPI.prototype.isAuthenticated = function() {
  return this.signingkey != null;
};

/**
 * Requests the service and parses it so the user can handle it.
 * 
 * @param {object} payload An object that contains
 */
SoclAPI.prototype.requestService = function(payload) {
  var success = function(data, textStatus, jqXHR) {
    if (data.status == 200) {
      var soclResult = JSON.parse(data.responseText);
      if (soclResult) {
        for (first in soclResult) {
          if (first.statusCode == 401) {
            // invalidate the session since we are unautorized!
            this.signingkey = null;
          }
          if (payload.callback) payload.callback(soclResult);
          break;
        }
      }
      else {
        payload.callback({
          statusCode: 400,
          status: 'Error',
          error: 'Something strange happened. Notify developer. hello@mohamedmansour.com'
        });
      }
    }
    else {
      payload.callback({
        statusCode: data.status,
        status: data.statusText,
        error: 'Request just didn\'t happen, try again later. Notify developer. hello@mohamedmansour.com'
      });
    }
  }.bind(this);
  
  // First check if they are logged in otherwise no need to do a request anymore.
  if (!this.isAuthenticated()) {
    console.error('You are not logged in!');
    payload.callback({
      statusCode: 401,
      status: 'Unauthorized',
      error: 'This operation requires the User to be authenticated'
    });
    return;
  }
  
  // Everything was successfull, just do it!
  $.ajax({
    type: payload.type || (payload.data ? 'POST' : 'GET'),
    url: payload.url,
    data: payload.data || null,
    dataType: 'json',
    contentType: 'application/json; charset=utf-8',
    async: true,
    complete: success
  });
};

/**
 * Checks socl if any new notifications are available.
 *
 * @param {function(object)} callback Fired when any result appears.
 */
SoclAPI.prototype.checkNotifications = function(callback) {
  this.requestService({
    url: SoclAPI.NOTIFICATION_CHECK_SERVICE,
    data: '{"Notifications":{"uri":"Notifications?_rid=0&consolidate=true","method":"GET"},"Parties":{"uri":"Parties?_rid=0&recent=0&popular=8&newest=0&friend=0&attendees=true","method":"GET"}}',
    callback: function(data) {
      this.notifications = data
      if (callback) {
        callback(data);
      }
    }.bind(this)
  });
};

/**
 * Checks socl if any new notifications are available.
 *
 * @param {function(object)} callback Fired when any result appears.
 */
SoclAPI.prototype.getNotifications = function(callback) {
  this.requestService({
    url: SoclAPI.NOTIFICATION_SERVICE,
    callback: function(data) {
      var data = data[0];
      if (data) {
        callback(data.items);
      }
    }.bind(this)
  });
};

/**
 * Tells so.cl that the notifications were read.
 */
SoclAPI.prototype.markNotificationsRead = function() {
  this.requestService({
    type: 'PUT',
    url: SoclAPI.NOTIFICATION_SEEN_SERVICE
  });
};

/**
 * Get the individual post data.
 * 
 * @param {object} payload The data to search for the post.
 * @param {function(object)} callback Fired when any result appears.
 */
SoclAPI.prototype.getPost = function(payload, callback) {
  if (!payload.user_id) {
    callback({
      statusCode: 400,
      status: 'Error',
      error: 'user_id was not supplied'
    });
    return;
  }
  if (!payload.post_id) {
    callback({
      statusCode: 400,
      status: 'Error',
      error: 'post_id was not supplied'
    });
    return;
  }
  var url = SoclAPI.SEARCH_SERVICE + '(' + payload.user_id + ')?$filter:open.Post.id=\'' + payload.post_id + '\'' +
      '&$orderby:-open.Post.createdtime&$type:open.Post&$top:1&scope:all';
  this.requestService({
    url: url,
    type: 'GET',
    callback: function(data) {
      var data = data[0];
      if (data) {
        callback(data.items);
      }
    }.bind(this)
  });
};