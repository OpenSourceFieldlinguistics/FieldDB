/* globals window, localStorage, navigator */
var FieldDBObject = require("./../FieldDBObject").FieldDBObject;
var Activity = require("./../activity/Activity").Activity;
var Authentication = require("./../authentication/Authentication").Authentication;
var Corpus = require("./../corpus/Corpus").Corpus;
var Database = require("./../corpus/Database").Database;
var Connection = require("./../corpus/Connection").Connection;
var DataList = require("./../data_list/DataList").DataList;
var Import = require("./../import/Import").Import;
var Search = require("./../search/Search").Search;
var Session = require("./../datum/Session").Session;
var Router = require("./../Router").Router;
var Contextualizer = require("./../locales/Contextualizer").Contextualizer;
var Q = require("q");

/**
 * @class The App handles the reinitialization and loading of the app
 *        depending on which platform (Android, Chrome, web) the app is
 *        running, who is logged in etc.
 *
 * The App should be serializable to save state to local storage for the
 * next run.
 *
 * @name App
 *
 * @property {Authentication} authentication The auth member variable is an
 *           Authentication object permits access to the login and logout
 *           functions, and the database of users depending on whether the
 *           app is online or not. The authentication is the primary way to access the current user.
 *
 * @property {Corpus} corpus The corpus is a Corpus object which will permit
 *           access to the datum, the data lists and the sessions. The corpus feeds the
 *           search object with indexes and fields for advanced search, the
 *           corpus has datalists, has teams with permissions, has a
 *           confidentiality_encryption key, it's datum have sessions, its
 *           datalists and datum have export.
 *
 * @property {Search} search The current search details.
 *
 * @property {Session} currentSession The session that is currently open.
 *
 * @property {DataList} currentDataList The datalist that is currently open.
 * @extends FieldDBObject
 * @tutorial tests/app/AppTest.js
 * @constructs
 */
var App = function App(options) {
  if (!this._fieldDBtype) {
    this._fieldDBtype = "App";
  }
  this.debug("Constructing App ", options);
  FieldDBObject.apply(this, arguments);

  if (FieldDBObject.application) {
    this.warn("You shouldn't declare two apps at one time. Overwriting previous app.");
    this.debug("previous app", FieldDBObject.application);
  }
  FieldDBObject.application = this;

  this.speakersList = this.speakersList || new DataList({
    title: {
      default: "locale_All_Speakers"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "speakers"
  });
  this.consultantsList = this.consultantsList || new DataList({
    title: {
      default: "locale_All_Language_Consultants"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "consultants"
  });
  this.participantsList = this.participantsList || new DataList({
    title: {
      default: "locale_All_Participants"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "participants"
  });
  this.usersList = this.usersList || new DataList({
    title: {
      default: "locale_All_Users"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "users"
  });

  this.sessionsList = this.sessionsList || new DataList({
    title: {
      default: "locale_All_Elicitation_Sessions"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "sessions",
    // docs: [],
    // docIds: []
  });
  this.datalistsList = this.datalistsList || new DataList({
    title: {
      default: "locale_All_Datalists"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "datalists"
  });
  this.datumsList = this.datumsList || new DataList({
    title: {
      default: "locale_All_Data"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    // debugMode:true,
    api: "datums"
  });
  this.commentsList = this.commentsList || new DataList({
    title: {
      default: "All Comments"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "comments"
  });

  this.responsesList = this.responsesList || new DataList({
    title: {
      default: "List of Responses"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "responses"
  });
  this.experimentsList = this.experimentsList || new DataList({
    title: {
      default: "List of Experiment Results"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "experiments"
  });
  this.reportsList = this.reportsList || new DataList({
    title: {
      default: "List of Reports"
    },
    description: {
      default: "This list was automatically generated by looking in the corpus."
    },
    api: "reports"
  });

  this.importer = this.importer || null;
  this.search = this.search || null;
  this.currentDoc = this.currentDoc || null;
  this._corpus = this._corpus || null;
  this.thisyear = (new Date()).getFullYear();
  this.whiteListCORS = this.whiteListCORS || ["self"];

  var self = this;
  Q.nextTick(function() {
    self.warn("An app of type " + self.fieldDBtype + " has become automagically available to all fielddb objects");
  });

};

App.prototype = Object.create(FieldDBObject.prototype, /** @lends App.prototype */ {
  constructor: {
    value: App
  },

  authentication: {
    get: function() {
      return this._authentication || FieldDBObject.DEFAULT_OBJECT;
    },
    set: function(value) {
      this.ensureSetViaAppropriateType("authentication", value);
    }
  },

  corpus: {
    get: function() {
      if (this._corpus) {
        return this._corpus;
      }
      return Database.prototype;
    },
    set: function(value) {
      this._corpus = value;
    }
  },

  contextualizer: {
    get: function() {
      return this._contextualizer;
    },
    set: function(value) {
      this.ensureSetViaAppropriateType("contextualizer", value);
      if (this._contextualizer && typeof this._contextualizer.loadDefaults === "function") {
        this._contextualizer.loadDefaults();
      }
    }
  },

  contextualize: {
    value: function(value) {
      if (this._contextualizer) {
        return this._contextualizer.contextualize(value);
      } else {
        if (typeof value === "object" || value.default) {
          return value.default;
        }
        return value;
      }
    }
  },

  prefs: {
    get: function() {
      if (this.corpus && this.corpus.prefs) {
        return this.corpus.prefs;
      }
      if (this.authentication && this.authentication.user && this.authentication.user.prefs) {
        return this.authentication.user.prefs;
      }
    }
  },

  enterDecryptedMode: {
    value: function(loginDetails) {
      var deferred = Q.defer(),
        self = this;

      Q.nextTick(function() {
        if (this.corpus && typeof this.corpus.login === "function") {
          this.corpus.login(loginDetails).then(function() {

            self.decryptedMode = true;
            deferred.resolve(true);

          }, function(error) {
            deferred.reject(error);
          }).fail(function(error) {
            console.error(error.stack, self);
            deferred.reject(error);
          });
        } else {
          deferred.reject("User is not authenticated. Please log in.");
        }
      });
      return deferred.promise;
    }
  },

  fetch: {
    value: function() {
      this.todo("use same logic as the user from localStorage");
    }
  },

  // Internal models: used by the parse function
  INTERNAL_MODELS: {
    value: {
      corpus: Corpus,
      contextualizer: Contextualizer,
      authentication: Authentication,
      currentSession: Session,
      currentDataList: DataList,
      search: Search
    }
  },

  startApp: {
    value: function(callback) {
      /* Tell the app to render everything */
      this.render();

      if (typeof this.router === "function") {
        /* Tell the router to render the home screen divs */
        this.router = new Router();
        this.router.renderDashboardOrNot(true);

        FieldDBObject.history.start();
        if (typeof callback === "function") {
          this.debug("Calling back the startApps callback");
          callback();
        }
      }

    }
  },

  loading: {
    get: function() {
      return this._loading || this.fetching || false;
    },
    set: function(value) {
      if (value === this._loading) {
        return;
      }
      value = !!value;
      if (value === true) {
        this.status = "Loading dashboard";
      }
      this.loading = value;
    }
  },

  /**
   * This function creates the backbone objects, and links them up so that
   * they are ready to be used in the views. This function should be called on
   * app load, either by main, or by welcome new user. This function should
   * not be called at any later time as it will break the connection between
   * the views and the models. To load different models into the app after it
   * has first loaded, use the loadFieldDBObjectsById function below.
   *
   * @param params An object containing key and value route parameters
   */
  processRouteParams: {
    value: function(routeParams) {
      var self = this;

      if (!routeParams) {
        this.warn("Route params are undefined, not loading anything");
        return;
      }
      this.routeParams = routeParams;

      /*
       * Handle precise routes
       */
      if (routeParams.importType) {
        self.debug("Creating an importer");
        this.importer = this.importer || new Import({
          importType: routeParams.importType
            // corpus: this.corpus
        });
      } else if (routeParams.reportType) {
        this.reportsList.filter = function(report) {
          if (routeParams.reportType.match(report.fieldDBtype.toLowerCase())) {
            return true;
          } else {
            return false;
          }
        };
      } else if (routeParams.speakerType) {
        this.speakersList.filter = function(speaker) {
          if (routeParams.speakerType.match(speaker.fieldDBtype.toLowerCase())) {
            return true;
          } else {
            return false;
          }
        };
      } else if (routeParams.searchQuery) {
        this.search = this.search || new Search({
          searchKeywords: routeParams.searchQuery
        });
      } else if (routeParams.docid) {
        if (this.doc && this.doc.save) {
          this.doc.bug("Switching to another document without saving...");
        }
        this.doc = new FieldDBObject({
          id: routeParams.docid
        });
      }

      /*
       * Letting the url determine which team is loaded
       */
      if (routeParams.team) {
        routeParams.team = Connection.validateUsername(routeParams.team).identifier;

        /*
         * Letting the url determine which corpus is loaded
         */
        if (routeParams.corpusidentifier) {
          routeParams.corpusidentifier = Connection.validateIdentifier(routeParams.corpusidentifier).identifier;
          this.currentCorpusDashboard = routeParams.team + "/" + routeParams.corpusidentifier;
          this.currentCorpusDashboardDBname = routeParams.team + "-" + routeParams.corpusidentifier;
          if (this.currentCorpusDashboardDBname.split("-").length < 2) {
            this.status = "Please try another url of the form teamname/corpusname " + this.currentCorpusDashboardDBname + " is not valid.";
            return;
          }

          // this.team.dbname = this.currentCorpusDashboardDBname;
          if (this.corpus && this.corpus.save) {
            this.corpus.bug("Switching to another corpus without saving...");
          }
          if (!this.corpus || this.currentCorpusDashboardDBname !== this.corpus.dbname) {
            this.corpus = new Corpus({
              dbname: this.currentCorpusDashboardDBname
            });
          }
        }
      }
      if (routeParams.docid) {
        var tempdoc = new FieldDBObject({
          id: routeParams.docid
        }).fetch().then(function(result) {
          console.log(tempdoc);
          self.currentDoc = FieldDBObject.convertDocIntoItsType(result);
          self.render();
        }, function(error) {
          console.log("Unable to display this document.", error);
        });
      }

      /*
       * Fetching models if they are not complete
       */
      if (this.corpus && this.corpus.dbname && !this.corpus.title) {
        this.corpus.status = "Loading corpus details.";
        return this.corpus.loadCorpusByDBname(this.corpus.dbname).then(function(result) {
          self.debug("Suceeded to download corpus details.", result);
          self.status = self.corpus.status = "Loaded corpus details.";
          if (self.application.importer) {
            self.application.importer.corpus = self.corpus;
          }
          self.render();

          return self;
        }, function(result) {
          self.debug("Failed to download corpus details.", result);

          self.status = self.corpus.status = "Failed to download corpus details. Are you sure this is the corpus you wanted to see: " + self.corpus.dbname;
          // self.loginDetails.username = self.team.username;
          self.render();
          return self;
        }).fail(function(error) {
          console.error(error.stack, self);
        });
      } else {
        this.debug("Not fetching corpus, its aleady here.", this.corpus);
      }
    }
  },

  router: {
    value: Router
  },

  showHelpOrNot: {
    value: function() {
      var self = this;

      var username = this.authentication.user.username;
      if (username === "public") {
        //Dont show the help screen for the public user
        return;
      }
      var helpShownCount = localStorage.getItem(username + "helpShownCount") || 0;
      var helpShownTimestamp = localStorage.getItem(username + "helpShownTimestamp") || 0;

      /*
       * dont show the guide immediately if they are truely a new
       * user, let them see the dashboard before they wonder how
       * to use it. 60 seconds later, show the help.
       */
      if (helpShownTimestamp === 0) {
        self.helpCountReason = "Just in case you were wondering what all those buttons are for, check out Gretchen's Illustrated Guide to your dashboard! ";

        self.helpCount = 3 - helpShownCount;
        localStorage.setItem(username + "helpShownCount", ++helpShownCount);
        localStorage.setItem(username + "helpShownTimestamp", Date.now());
        self.timeout(function() {
          self.router.navigate("help/illustratedguide", {
            trigger: true
          });
        }, 60000);
        return;
      }

      /*
       * If this is not a brand new user:
       */
      var milisecondsSinceLastHelp = Date.now() - helpShownTimestamp;

      /* if its been more than 5 days, reset the help shown count to trigger the illustrated guide */
      if (milisecondsSinceLastHelp > 432000000 && helpShownTimestamp !== 0) {
        helpShownCount = 0;
        self.helpCountReason = "Welcome back! It's been more than 5 days since you opened the app. ";
      }
      if (helpShownCount > 3) {
        // do nothing
      } else {
        self.helpCount = 3 - helpShownCount;
        localStorage.setItem(username + "helpShownCount", ++helpShownCount);
        localStorage.setItem(username + "helpShownTimestamp", Date.now());
        self.router.navigate("help/illustratedguide", {
          trigger: true
        });
      }
    }
  },

  renderHelp: function(helptype) {
    this.render(helptype);
  },

  /**
     * This function is used to save the entire app state that is needed to load when the app is re-opened.
     * http://stackoverflow.com/questions/7794301/window-onunload-is-not-working-properly-in-chrome-browser-can-any-one-help-me
     *
     * $(window).on("beforeunload", function() {
        return "Your own message goes here...";
      });
     */
  warnUserAboutSavedSyncedStateBeforeUserLeaves: {
    value: function(e) {
      this.debug("warnUserAboutSavedSyncedStateBeforeUserLeaves", e);
      this.save();

      var returntext = "";
      if (this.view) {
        if (this.view.totalUnsaved.length >= 1) {
          returntext = "You have unsaved changes, click cancel to save them. \n\n";
        }
        if (this.view.totalUnsaved.length >= 1) {
          returntext = returntext + "You have unsynced changes, click cancel and then click the sync button to sync them. This is only important if you want to back up your data or if you are sharing your data with a team. \n\n";
        }
      }
      if (returntext === "") {
        return; //don't show a pop up
      } else {
        return "Either you haven't been using the app and Chrome wants some of its memory back, or you want to leave the app.\n\n" + returntext;
      }
    }
  },
  /**
   * Saves a json file via REST to a couchdb, must be online.
   *
   * @param bareActivityObject
   */
  addActivity: {
    value: function(bareActivityObject) {
      var self = this;

      bareActivityObject.verb = bareActivityObject.verb.replace("href=", "target='_blank' href=");
      bareActivityObject.directobject = bareActivityObject.directobject.replace("href=", "target='_blank' href=");
      bareActivityObject.indirectobject = bareActivityObject.indirectobject.replace("href=", "target='_blank' href=");
      bareActivityObject.context = bareActivityObject.context.replace("href=", "target='_blank' href=");

      self.debug("Saving activity: ", bareActivityObject);
      var backboneActivity = new Activity(bareActivityObject);

      var connection = this.connection;
      var activitydb = connection.dbname + "-activity_feed";
      if (bareActivityObject.teamOrPersonal !== "team") {
        activitydb = this.authentication.user.username + "-activity_feed";
        backboneActivity.attributes.user.set("gravatar", this.authentication.user.gravatar);
      }

      if (bareActivityObject.teamOrPersonal === "team") {
        self.currentCorpusTeamActivityFeed.addActivity(bareActivityObject);
      } else {
        self.currentUserActivityFeed.addActivity(bareActivityObject);
      }
    }
  },

  /**
   * This function saves the dashboard session, datalist and then corpus. Its success callback is called if all saves succeed, its fail is called if any fail.
   * @param successcallback
   * @param failurecallback
   */
  save: {
    value: function() {
      var promises = [];

      this.authentication.dispatchEvent("saveyourselfnow");

      promises.push(this.currentSession.save());
      promises.push(this.currentDataList.save());
      promises.push(this.corpus.save());
      promises.push(this.authentication.save());

      this.authentication.staleAuthentication = true;

    }
  },

  subscribers: {
    value: {
      any: []
    }
  },

  subscribe: {
    value: function(type, fn, context) {
      type = type || "any";
      fn = typeof fn === "function" ? fn : context[fn];

      if (typeof this.subscribers[type] === "undefined") {
        this.subscribers[type] = [];
      }
      this.subscribers[type].push({
        fn: fn,
        context: context || this
      });
    }
  },

  unsubscribe: {
    value: function(type, fn, context) {
      this.visitSubscribers("unsubscribe", type, fn, context);
    }
  },

  publish: {
    value: function(type, publication) {
      this.visitSubscribers("publish", type, publication);
    }
  },

  visitSubscribers: {
    value: function(action, type, arg, context) {
      var pubtype = type || "any";
      var subscribers = this.subscribers[pubtype];
      if (!subscribers || subscribers.length === 0) {
        this.debug(pubtype + ": There were no subscribers.");
        return;
      }
      var i;
      var maxUnsubscribe = subscribers ? subscribers.length - 1 : 0;
      var maxPublish = subscribers ? subscribers.length : 0;

      if (action === "publish") {
        // count up so that older subscribers get the message first
        for (i = 0; i < maxPublish; i++) {
          if (subscribers[i]) {
            // TODO there is a bug with the subscribers they are getting lost, and
            // it is trying to call fn of undefiend. this is a workaround until we
            // figure out why subscribers are getting lost. Update: i changed the
            // loop to count down and remove subscribers from the ends, now the
            // size of subscribers isnt changing such that the subscriber at index
            // i doesnt exist.
            subscribers[i].fn.call(subscribers[i].context, arg);
          }
        }
        this.debug("Visited " + subscribers.length + " subscribers.");

      } else {

        // count down so that subscribers index exists when we remove them
        for (i = maxUnsubscribe; i >= 0; i--) {
          try {
            if (!subscribers[i].context) {
              this.debug("This subscriber has no context. should we remove it? " + i);
            }
            if (subscribers[i].context === context) {
              var removed = subscribers.splice(i, 1);
              this.debug("Removed subscriber " + i + " from " + type, removed);
            } else {
              this.debug(type + " keeping subscriber " + i, subscribers[i].context);
            }
          } catch (e) {
            this.debug("problem visiting Subscriber " + i, subscribers);
          }
        }
      }
    }
  },

  isAndroidApp: {
    get: function() {

      // Development tablet navigator.userAgent:
      // Mozilla/5.0 (Linux; U; Android 3.0.1; en-us; gTablet Build/HRI66)
      // AppleWebKit/534.13 (KHTML, like Gecko) Version/4.0 Safari/534.13
      // this.debug("The user agent is " + navigator.userAgent);
      try {
        return navigator.userAgent.indexOf("OfflineAndroidApp") > -1;
      } catch (e) {
        this.warn("Cant determine app type isAndroidApp, " + e);
        return false;
      }
    }
  },

  isAndroid4: {
    get: function() {
      try {
        return navigator.userAgent.indexOf("Android 4") > -1;
      } catch (e) {
        this.warn("Cant determine app type isAndroid4, " + e);
        return false;
      }
    }
  },

  isChromeApp: {
    get: function() {
      try {
        return window.location.href.indexOf("chrome-extension") > -1;
      } catch (e) {
        this.warn("Cant determine app type isChromeApp, " + e);
        return false;
      }
    }
  },

  isCouchApp: {
    get: function() {
      try {
        return window.location.href.indexOf("_design/pages") > -1;
      } catch (e) {
        this.warn("Cant determine app type isCouchApp, " + e);
        return false;
      }
    }
  },

  isTouchDBApp: {
    get: function() {
      try {
        return window.location.href.indexOf("localhost:8128") > -1;
      } catch (e) {
        this.warn("Cant determine app type isTouchDBApp, " + e);
        return false;
      }
    }
  },

  isNodeJSApp: {
    get: function() {
      try {
        return window.location.href !== undefined;
      } catch (e) {
        // this.debug("Cant access window, app type isNodeJSApp, ", e);
        return true;
      }
    }
  },

  isBackboneCouchDBApp: {
    get: function() {
      return false;
    }
  },

  /**
   * If not running offline on an android or in a chrome extension, assume we are
   * online.
   *
   * @returns {Boolean} true if not on offline Android or on a Chrome Extension
   */
  isOnlineOnly: {
    get: function() {
      return !this.isAndroidApp && !this.isChromeApp;
    }
  },

  toJSON: {
    value: function(includeEvenEmptyAttributes, removeEmptyAttributes) {
      this.debug("Customizing toJSON ", includeEvenEmptyAttributes, removeEmptyAttributes);

      var attributesNotToJsonify = ["corpus", "authentication"];
      var json = FieldDBObject.prototype.toJSON.apply(this, [includeEvenEmptyAttributes, removeEmptyAttributes, attributesNotToJsonify]);

      this.debug(json);
      return json;
    }
  }


});
exports.App = App;
