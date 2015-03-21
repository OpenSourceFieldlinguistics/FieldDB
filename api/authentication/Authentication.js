/* globals window, document, alert */

var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var Database = require("./../corpus/Database").Database;
// var UserMask = require("./../user/UserMask").UserMask;
var User = require("./../user/User").User;
var Confidential = require("./../confidentiality_encryption/Confidential").Confidential;
var Q = require("q");
/**
 * @class The Authentication Model handles login and logout and
 *        authentication locally or remotely. *
 *
 * @property {User} user The user is a User object (User, Bot or Consultant)
 *           which is logged in and viewing the app with that user's
 *           perspective. To check whether some data is
 *           public/viewable/editable the app.user should be used to verify
 *           the permissions. If no user is logged in a special user
 *           "public" is logged in and used to calculate permissions.
 *
 * @extends FieldDBObject
 * @tutorial tests/authentication/AuthenticationTest.js
 */
var Authentication = function Authentication(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "Authentication";
  }
  this.debug("Constructing a Authentication " + options);

  var self = this;

  this.resumingSessionPromise = Database.prototype.resumeAuthenticationSession().then(function(user) {
    self.debug(user);
    self.user = user;
    self.user.fetch();
    if (self.user._rev) {
      self.user.authenticated = true;
      self.dispatchEvent("authenticated");
    }

    // if (sessionInfo.ok && sessionInfo.userCtx.name) {
    //   selfauthentication.user.username = sessionInfo.userCtx.name;
    //   selfauthentication.user.roles = sessionInfo.userCtx.roles;
    //   processUserDetails(selfauthentication.user);
    // } else {
    //   if (window.location.pathname.indexOf("welcome") < 0 && window.location.pathname.indexOf("bienvenu") < 0) {
    //     $scope.$apply(function() {
    //       // $location.path(selfbasePathname + "/#/welcome/", false);
    //       window.location.replace(selfbasePathname + "/#/welcome");
    //     });
    //   }
    // }
    return self.user;
  }, function(error) {
    self.warn("Unable to resume login ", error.userFriendlyErrors.join(" "));
    if (error.status !== 409) {
      // error.userFriendlyErrors = ["Unable to resume session, are you sure you're not offline?"];
      self.error = error.userFriendlyErrors.join(" ");
    }
    self.dispatchEvent("notauthenticated");
    self.render();

    return error;
  });

  FieldDBObject.apply(this, arguments);
};

Authentication.prototype = Object.create(FieldDBObject.prototype, /** @lends Authentication.prototype */ {
  constructor: {
    value: Authentication
  },

  // Internal models: used by the parse function
  INTERNAL_MODELS: {
    value: {
      user: User,
      confidential: Confidential
    }
  },

  dispatchEvent: {
    value: function(eventChannelName) {
      try {
        var event = document.createEvent("Event");
        event.initEvent(eventChannelName, true, true);
        document.dispatchEvent(event);
      } catch (e) {
        this.warn("Cant dispatch event " + eventChannelName + " the document element isn't available.", e);
      }
    }
  },

  /**
   * Contacts local or remote server to verify the username and password
   * provided in the user object. Upon success, calls the callback with the
   * user.
   *
   * @param user A user object to verify against the authentication database
   * @param callback A callback to call upon sucess.
   */
  login: {
    value: function(loginDetails) {
      var deferred = Q.defer(),
        self = this;

      var tempUser = new User(loginDetails);
      var dataToPost = {};
      dataToPost.username = loginDetails.username;
      dataToPost.password = loginDetails.password;
      dataToPost.authUrl = loginDetails.authUrl;

      //if the same user is re-authenticating, include their details to sync to the server.
      tempUser.fetch();
      if (tempUser._rev && tempUser.username !== "public") {
        dataToPost.syncDetails = "true";
        dataToPost.syncUserDetails = tempUser.toJSON();
        tempUser.warn("Backing up tempUser details", dataToPost.syncUserDetails);
        delete dataToPost.syncUserDetails._rev;
        //TODO what if they log out, when they have change to their private data that hasnt been pushed to the server,
        //the server will overwrite their details.
        //should we automatically check here, or should we make htem a button
        //when they are authetnticated to test if they ahve lost their prefs etc?
      }

      this.error = "";
      this.status = "";
      this.loading = true;

      self.resumingSessionPromise = Database.prototype.login(dataToPost).then(function(userDetails) {
          self.loading = false;

          if (!userDetails) {
            deferred.reject({
              error: userDetails,
              status: 500,
              userFriendlyErrors: ["Unknown error. Please report this 2391."]
            });
            return;
          }
          try {
            self.user = userDetails;
          } catch (e) {
            console.warn("There was a problem assigning the user. ", e);
          }
          self.user.authenticated = true;
          self.dispatchEvent("authenticated");

          deferred.resolve(self.user);
        }, //end successful login
        function(error) {
          if (!error || !error.userFriendlyErrors) {
            error.userFriendlyErrors = ["Unknown error."];
          }
          self.warn("Logging in failed: " + error.status, error.userFriendlyErrors);
          self.error = error.userFriendlyErrors.join(" ");
          self.loading = false;
          deferred.reject(error);
        });

      // Q.nextTick(function(){
      //   deferred.reject("hi")
      // });

      return deferred.promise;
    }
  },

  register: {
    value: function(options) {
      var self = this,
        deferred = Q.defer();

      Database.prototype.register(options).then(function(userDetails) {
        self.debug("registration succeeeded, waiting to login ", userDetails);

        // self.user = userDetails;

        var waitTime = 1000;
        var loopExponentialDecayLogin = function(options) {
          self.login(options).
          then(function(results) {

            self.debug("    login after registration is complete " + waitTime, results);
            deferred.resolve(results);

          }, function(error) {
            waitTime = waitTime * 2;
            if (waitTime > 60 * 1000) {
              deferred.reject(error);
            } else {
              self.debug("    waiting to login " + waitTime, error);
              self.loading = true;
              setTimeout(function() {
                loopExponentialDecayLogin(options);
              }, waitTime);
            }
          });
        };
        loopExponentialDecayLogin(options);

      }, function(error) {
        self.debug("registration failed ", error);
        deferred.reject(error);
      });

      return deferred.promise;
    }
  },

  logout: {
    value: function(options) {
      var self = this;
      this.save();

      return Database.prototype.logout(options).then(function() {
        self.dispatchEvent("logout");
        self.warn("Reloading the page");
        window.location.reload();
      });
    }
  },

  /**
   * This function parses the server response and injects it into the authentication's user public and user private
   *
   */
  user: {
    get: function() {
      return this._user;
    },
    set: function(value) {
      if (!value) {
        return;
      }
      var overwriteOrNot;

      this.debug("setting user");
      // if (!(value instanceof User)) {
      //   value = new User(value);
      // }

      if (this._user && this._user.username === value.username) {
        if (!this._user.rev) {
          this.debug("Fetching the user's full details");
          this._user.fetch();
        }
        this.debug("Merging the user", this._user, value);
        if (!(value instanceof User)) {
          value = new User(value);
        }
        if (!this._user._rev) {
          overwriteOrNot = "overwrite";
        }
        this._user.merge("self", new User(value), overwriteOrNot);
      } else {
        this.debug("Setting the user");
        this._user = new User(value);
      }

      var self = this;
      this._user.save().then(function() {
        self.debug("Saved user ");
      });
      this._user.render();

    }
  },

  save: {
    value: function() {
      return this.user.save();
    }
  },

  /**
   * This function uses the quick authentication view to get the user's
   * password and authenticate them. The authenticate process brings down the
   * user from the server, and also gets their sesson token from couchdb
   * before calling the callback.
   *
   * If there is no quick authentication view it takes them either to the user
   * page (in the ChromeApp) or the public user page (in a couchapp) where
   * they dont have to have a corpus token to see the data, and log in
   *
   * @param callback
   *          a success callback which is called once the user has been backed
   *          up to the server, and their couchdb session token is ready to be
   *          used to contact the database.
   * @param corpusPouchName
   *          an optional corpus pouch name to redirect the user to if they
   *          end up geting kicked out of the corpus page
   */
  syncUserWithServer: {
    value: function() {
      var self = this;
      this.todo("will this return a promise.");
      return this.renderQuickAuthentication().then(function(userinfo) {
        self.login(userinfo);
      });
    }
  }

});


exports.Authentication = Authentication;
