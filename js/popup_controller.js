/**
 * Manages the popup contents.
 */
PopupController = function() {
  this.bkg = chrome.extension.getBackgroundPage();
  this.itemTemplate = $('#notification-item-template');
};

/**
 * Initializes the popup while getting hte notifications and presenting them
 * back to jquery templates.
 */
PopupController.prototype.init = function() {
  var that = this;
  var notificationsDOM = $('#notifications');
  this.bkg.controller.socl.getNotifications(function(data) {
    notificationsDOM.html('');
    data.forEach(function(elt, idx) {
      var tmpl = that.itemTemplate.tmpl({
        isNew: !elt.seen,
        synopsis: elt.synopsis,
        permalink: elt.permalink,
        htmlSynopsis: elt.htmlSynopsis,
        sourcePhotoURL: 'http://graph.facebook.com/' + elt.primarySource.authids[0].substring(3) + '/picture?type=square',
        sourceName: elt.primarySource.name,
        sourceLink: 'http://www.so.cl/#/@' + elt.primarySource.screenname
      });
      tmpl.appendTo(notificationsDOM);
    });
    that.bkg.controller.markNotificationsVisited();
  });
  $(document).on('click', 'a', this.onLinkClicked.bind(this));
};

/**
 * Listener when any link on the current popup is clicked.
 */
PopupController.prototype.onLinkClicked = function(e) {
  e.preventDefault();
  var href = $(e.target).attr('href');
  if (!href) {
    href = $(e.target).parent().attr('href');
  }
  window.open(href);
};