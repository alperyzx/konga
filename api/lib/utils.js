/**
 * Shared runtime utilities.
 */

'use strict'

var moment = require("moment");
var _ = require("lodash");
var https = require('https');

module.exports = {

  getMinutesDiff: function (start, end) {
    var duration = moment.duration(moment(start).diff(moment(end)));
    return duration.asMinutes();
  },

  getAdminEmailList: function (cb) {
    sails.models.user.find({
      admin: true
    }).exec(function (err, admins) {
      if (err) return cb(err)
      if (!admins.length) return cb([])
      return cb(null, admins.map(function (item) {
        return item.email;
      }));
    });
  },

  sendSlackNotification: function (settings, message) {

    sails.log("Sending notification to slack", settings.data.integrations, message);

    var slack = _.find(settings.data.integrations, function (item) {
      return item.id === 'slack'
    })

    if (!slack || !slack.config.enabled) return;

    var field = _.find(slack.config.fields, function (item) {
      return item.id == 'slack_webhook_url'
    })

    var url = field ? field.value : "";
    if (!url) return sails.log.error('Slack notification failed: webhook URL is empty');

    var payload = JSON.stringify(typeof message === 'string' ? {text: message} : message);
    var request = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, function (response) {
      response.resume();
      if (response.statusCode >= 200 && response.statusCode < 300) {
        sails.log('Slack notification sent');
      } else {
        sails.log.error('Slack notification failed with HTTP status', response.statusCode);
      }
    });

    request.on('error', function (error) {
      sails.log.error('Slack notification failed', error);
    });
    request.end(payload);
  },

  /**
   * Fix invalid semver formats like `0.14.0rc2`
   * A valid semver format would be `0.14.0-rc2`
   * This patch addresses a very specific version invalidity.
   * It does not intent to fix invalid semver formats in general.
   * @param version
   */
  ensureSemverFormat: function (version) {
    if(version.indexOf("-") < 0) {
      // Find the index of the first alphanumeric character in the version string
      let firstAlphaIndex = version.search(/[a-zA-Z]/);
      if(firstAlphaIndex > -1) {
        // Remove everything from that character onward
        return  version.substring(0, firstAlphaIndex);
      }
    }

    return version;
  },

  withoutTrailingSlash(str) {
    if(!str) return str;
    return str.replace(/\/$/, "")
  },
}
