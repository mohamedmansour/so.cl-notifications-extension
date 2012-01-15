/**
 * Manages a single instance of the entire application.
 *
 * @author Mohamed Mansour 2011 (http://mohamedmansour.com)
 * @constructor
 */
BackgroundController = function() {
  this.onExtensionLoaded();
  this.socl = new SoclAPI();
  this.socl.login();
  this.browserActionRenderer = new BrowserActionRenderer();
};

BackgroundController.NOTIFICATION_CHECK_INTERVAL = 60000; // Every minute.

/**
 * Triggered when the extension just loaded. Should be the first thing
 * that happens when chrome loads the extension.
 */
BackgroundController.prototype.onExtensionLoaded = function() {
  var currVersion = chrome.app.getDetails().version;
  var prevVersion = settings.version;
  if (currVersion != prevVersion) {
    // Check if we just installed this extension.
    if (typeof prevVersion == 'undefined') {
      this.onInstall();
    } else {
      this.onUpdate(prevVersion, currVersion);
    }
    settings.version = currVersion;
  }
};

/**
 * Triggered when the extension just installed.
 */
BackgroundController.prototype.onInstall = function() {
};

/**
 * Triggered when the extension just uploaded to a new version. DB Migrations
 * notifications, etc should go here.
 *
 * @param {string} previous The previous version.
 * @param {string} current  The new version updating to.
 */
BackgroundController.prototype.onUpdate = function(previous, current) {
};

/**
 * Initialize the main Background Controller
 */
BackgroundController.prototype.init = function() {
  this.startNotificationCheckService();
};

/**
 * Start the notification check service to see if we have any notifications.
 */
BackgroundController.prototype.startNotificationCheckService = function() {
  var that = this;
  var checkLoop = function() {
    // Attempt to relogin if your not signed in.
    if (!that.socl.isAuthenticated()) {
      that.socl.login();
    }
    that.socl.checkNotifications(that.onNotificationCheckReceived.bind(that));
  };
  this.notificationCheckServiceInterval =
      window.setInterval(checkLoop,
      BackgroundController.NOTIFICATION_CHECK_INTERVAL);
  checkLoop();
};

BackgroundController.prototype.stopNotificationCheckService = function() {
  window.clearInterval(this.notificationCheckServiceInterval);
};

BackgroundController.prototype.onNotificationCheckReceived = function(data) {
  this.browserActionRenderer.drawBadgeIcon(data.Notifications.items[0], true);
};

BackgroundController.prototype.markNotificationsVisited = function() {
  this.socl.markNotificationsVisited();
  this.browserActionRenderer.drawBadgeIcon(0, true);
};