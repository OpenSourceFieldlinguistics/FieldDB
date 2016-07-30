define([
  "libs/FieldDBBackboneModel",
  "audio_video/AudioVideos",
  "datum/Datum",
  "comment/Comment",
  "comment/Comments"
], function(
  FieldDBBackboneModel,
  AudioVideos,
  Datum,
  Comment,
  Comments
) {
  var DataList = FieldDBBackboneModel.extend( /** @lends DataList.prototype */ {
    /**
     * @class The Data List widget is used for import search, to prepare handouts and to share data on the web.
     *
     * @description
     *
     * @property {String} title The title of the Data List.
     * @property {String} dateCreated The date that this Data List was created.
     * @property {String} description The description of the Data List.
     * @property {Array<String>} datumIds An ordered list of the datum IDs of the
     *   Datums in the Data List.
     *
     * @extends Backbone.Model
     * @constructs
     */
    initialize: function() {
      if (OPrime.debugMode) OPrime.debug("DATALIST init");

      if (!this.get("comments")) {
        this.set("comments", new Comments());
      }
      if (this.get("filledWithDefaults")) {
        this.fillWithDefaults();
        this.unset("filledWithDefaults");
      }
    },
    fillWithDefaults: function() {
      // If there are no comments, give it a new one
      if (!this.get("comments")) {
        this.set("comments", new Comments());
      }

      if (!this.get("dateCreated")) {
        this.set("dateCreated", (new Date()).toDateString());
      }

      // If there's no audioVideo, give it a new one.
      if (!this.get("audioVideo")) {
        this.set("audioVideo", new AudioVideos());
      }
    },
    /**
     * backbone-couchdb adaptor set up
     */

    // The couchdb-connector is capable of mapping the url scheme
    // proposed by the authors of Backbone to documents in your database,
    // so that you don't have to change existing apps when you switch the sync-strategy
    url: "/datalists",

    defaults: {
      title: "Untitled Data List",
      description: "",
      datumIds: []
    },

    // Internal models: used by the parse function
    internalModels: {
      comments: Comments,
      audioVideo: AudioVideos
    },

    //This the function called by the add button, it adds a new comment state both to the collection and the model
    insertNewComment: function(commentstring) {
      var m = new Comment({
        "text": commentstring,
      });

      this.get("comments").add(m);
      window.appView.addUnsavedDoc(this.id);

      window.app.addActivity({
        verb: "commented",
        verbicon: "icon-comment",
        directobjecticon: "",
        directobject: "'" + commentstring + "'",
        indirectobject: "on <a href='#data/" + this.id + "'><i class='icon-pushpin'></i> " + this.get('title') + "</a>",
        teamOrPersonal: "team",
        context: " via Offline App."
      });

      window.app.addActivity({
        verb: "commented",
        verbicon: "icon-comment",
        directobjecticon: "",
        directobject: "'" + commentstring + "'",
        indirectobject: "on <a href='#data/" + this.id + "'><i class='icon-pushpin'></i> " + this.get('title') + "</a>",
        teamOrPersonal: "personal",
        context: " via Offline App."
      });
    },
    getAllAudioAndVideoFiles: function(datumIdsToGetAudioVideo, callback) {
      if (!datumIdsToGetAudioVideo) {
        datumIdsToGetAudioVideo = this.get("datumIds");
      }
      if (datumIdsToGetAudioVideo.length == 0) {
        datumIdsToGetAudioVideo = this.get("datumIds");
      }
      var audioVideoFiles = [];

      if (OPrime.debugMode) OPrime.debug("DATA LIST datumIdsToGetAudioVideo " + JSON.stringify(datumIdsToGetAudioVideo));
      for (var id in datumIdsToGetAudioVideo) {
        var obj = new Datum({
          dbname: app.get("corpus").get("dbname")
        });
        obj.id = datumIdsToGetAudioVideo[id];
        var thisobjid = id;
        obj.fetch({
          success: function(model, response) {
            //TODO test this, or alternatively fill the datalists own audio video collection
            model.get("audioVideo").models.map(function(audiovid) {
              audioVideoFiles.push(audiovid.get("URL"));
              audioVideoFiles = _.unique(audioVideoFiles);
            });

            if (thisobjid == datumIdsToGetAudioVideo.length - 1) {
              if (typeof callback == "function") {
                callback(audioVideoFiles);
              }
            }
          }
        });

      }
    },

    applyFunctionToAllIds: function(datumIdsToApplyFunction, functionToApply, functionArguments) {
      if (!datumIdsToApplyFunction) {
        datumIdsToApplyFunction = this.get("datumIds");
      }
      if (datumIdsToApplyFunction.length == 0) {
        datumIdsToApplyFunction = this.get("datumIds");
      }

      if (functionToApply === "putInTrash") {
        var sure = confirm("Are you sure you want to put these " + datumIdsToApplyFunction.length + " datum in the trash?");
        if (!sure) {
          return;
        }
        var self = this;
        var totalCount = datumIdsToApplyFunction.length;
        var trashAndLoop = function(ids) {
          var thisId = ids.pop();
          if (!thisId) {
            window.app.addActivity({
              verb: "deleted",
              verbicon: "icon-trash",
              directobject: "<a href='#corpus/" + self.get("dbname") + "/data/" + self.id + "'>" + totalCount + " datum in " + self.get('title') + "</a>",
              directobjecticon: "icon-list",
              indirectobject: "in <a href='#corpus/" + window.app.get("corpus").id + "'>" + window.app.get("corpus").get('title') + "</a>",
              teamOrPersonal: "team",
              context: " via Offline App."
            });

            window.app.addActivity({
              verb: "deleted",
              verbicon: "icon-trash",
              directobject: "<a href='#corpus/" + self.get("dbname") + "/data/" + self.id + "'>" + totalCount + " datum in " + self.get('title') + "</a>",
              directobjecticon: "icon-list",
              indirectobject: "in <a href='#corpus/" + window.app.get("corpus").id + "'>" + window.app.get("corpus").get('title') + "</a>",
              teamOrPersonal: "personal",
              context: " via Offline App."
            });
            return;
          }
          var datum;
          datum = new Datum({
            _id: thisId
          });
          datum.fetch({
            success: function(model) {
              datum.putInTrash("batchmode");
              setTimeout(function() {
                trashAndLoop(ids);
              }, 500);
            },
            error: function(error) {
              console.warn("wasnt able to open this datum. skipping... ", datum, error);
              setTimeout(function() {
                trashAndLoop(ids);
              }, 500);
            }
          });
        }
        trashAndLoop(datumIdsToApplyFunction);
        return;
      }

      if (!functionToApply) {
        functionToApply = "latexitDataList";
      }
      if (!functionArguments) {
        //        functionArguments = true; //leave it null so that the defualts will apply in the Datum call
      }
      var results = "";

      if (OPrime.debugMode) OPrime.debug("DATA LIST datumIdsToApplyFunction " + JSON.stringify(datumIdsToApplyFunction));
      if (functionToApply === "latexitDataList") {
        var preamble = "";
        if (window.appView && window.appView.exportView && window.appView.exportView.model && typeof window.appView.exportView.model.exportLaTexPostamble === "function") {
          preamble = window.appView.exportView.model.exportLaTexPreamble();
        }
        var title = "";
        if (window.app && typeof window.app.get === "function" && window.app.get("corpus") && typeof window.app.get("corpus").get === "function" && window.app.get("corpus").get("title")) {
          title = window.app.get("corpus").get("title");
        }

        results = preamble + "\n\\section{" + OPrime.escapeLatexChars(title) + "}\n\n";
        if (this.get("title")) {
          results = results + "\n\\subsection{" + OPrime.escapeLatexChars(this.get("title")) + "}\n\n";
        }
        results = results + "\n" + OPrime.escapeLatexChars(this.get("description")) + "\n\n";
      }

      var datumCollection = [];
      if (this.view && this.view.collection && this.view.collection.models) {
        datumCollection = this.view.collection.models;
      }

      for (var datum in datumCollection) {
        if (datumIdsToApplyFunction.indexOf(datumCollection[datum].id > -1) && typeof datumCollection[datum][functionToApply] === "function") {
          results = results + datumCollection[datum][functionToApply](functionArguments);
        }
      }
      if (functionToApply === "latexitDataList") {
        if (window.appView && window.appView.exportView && window.appView.exportView.model && typeof window.appView.exportView.model.exportLaTexPostamble === "function") {
          results = results + window.appView.exportView.model.exportLaTexPostamble();
        }
      }

      if ($("#export-text-area")) {
        $("#export-text-area").val(results);
      }

      return results;
    },

    /**
     * Make the  model marked as Deleted, mapreduce function will
     * ignore the deleted models so that it does not show in the app,
     * but deleted model remains in the database until the admin empties
     * the trash.
     *
     * Also remove it from the view so the user cant see it.
     *
     */

    putInTrash: function() {
      this.set("trashed", "deleted" + Date.now());
      var whichDatalistToUse = 0;
      if (window.app.get("corpus").datalists.models[whichDatalistToUse].id == this.id) {
        whichDatalistToUse = 1;
      }
      var self = this;
      this.saveAndInterConnectInApp(function() {

        window.app.addActivity({
          verb: "deleted",
          verbicon: "icon-trash",
          directobjecticon: "icon-pushpin",
          directobject: "<a href='#data/" + self.id + "'>a data list</a> ",
          indirectobject: "in <a href='#corpus/" + window.app.get("corpus").id + "'>" + window.app.get("corpus").get('title') + "</a>",
          teamOrPersonal: "team",
          context: " via Offline App."
        });

        window.app.addActivity({
          verb: "deleted",
          verbicon: "icon-trash",
          directobjecticon: "icon-pushpin",
          directobject: "<a href='#data/" + self.id + "'>a data list</a> ",
          indirectobject: "in <a href='#corpus/" + window.app.get("corpus").id + "'>" + window.app.get("corpus").get('title') + "</a>",
          teamOrPersonal: "personal",
          context: " via Offline App."
        });

        window.app.get("corpus").datalists.models[whichDatalistToUse]
          .setAsCurrentDataList(function() {
            if (window.appView) {
              /* TODO test this */
              window.app.get("corpus").datalists = null;
              window.appView.currentCorpusReadView.model
                .makeSureCorpusHasADataList(function() {
                  window.appView.currentCorpusEditView
                    .changeViewsOfInternalModels();
                  //              window.appView.currentCorpusReadView.render();
                  window.appView.currentCorpusReadView
                    .changeViewsOfInternalModels();
                  //              window.appView.currentCorpusReadView.render();
                  window.app.router.navigate("render/true", {
                    trigger: true
                  });

                });
            }
          });
      });
    },

    /**
     * Accepts two functions to call back when save is successful or
     * fails. If the fail callback is not overridden it will alert
     * failure to the user.
     *
     * - Adds the dataList to the corpus if it is in the right corpus, and wasnt already there
     * - Adds the dataList to the user if it wasn't already there
     * - Adds an activity to the logged in user with diff in what the user changed.
     *
     * @param successcallback
     * @param failurecallback
     */
    saveAndInterConnectInApp: function(successcallback, failurecallback) {
      if (OPrime.debugMode) OPrime.debug("Saving the DataList");
      var self = this;
      //      var idsInCollection = [];
      //      for(d in this.datumCollection.models){
      //        idsInCollection.push( this.datumCollection.models[d] );
      //      }
      //      this.set("datumIds", idsInCollection);
      var newModel = true;
      if (this.id) {
        newModel = false;
      } else {
        this.set("dateCreated", JSON.stringify(new Date()));
      }

      //protect against users moving dataLists from one corpus to another on purpose or accidentially
      if (window.app.get("corpus").get("dbname") != this.get("dbname")) {
        if (typeof failurecallback == "function") {
          failurecallback();
        } else {
          alert('DataList save error. I cant save this dataList in this corpus, it belongs to another corpus. ');
        }
        return;
      }
      var oldrev = this.get("_rev");
      this.set("dateModified", JSON.stringify(new Date()));
      this.set("timestamp", Date.now());

      self.save(null, {
        success: function(model, response) {
          if (OPrime.debugMode) OPrime.debug('DataList save success');
          var title = model.get("title");
          var differences = "#diff/oldrev/" + oldrev + "/newrev/" + response._rev;
          //TODO add privacy for dataList in corpus
          //            if(window.app.get("corpus").get("keepDataListDetailsPrivate")){
          //              title = "";
          //              differences = "";
          //            }
          if (window.appView) {
            window.appView.toastUser("Sucessfully saved data list: " + title, "alert-success", "Saved!");
            window.appView.addSavedDoc(model.id);
          }
          var verb = "modified";
          verbicon = "icon-pencil";
          if (newModel) {
            verb = "added";
            verbicon = "icon-plus";
          }

          window.app.addActivity({
            verb: "<a href='" + differences + "'>" + verb + "</a> ",
            verbicon: verbicon,
            directobjecticon: "icon-pushpin",
            directobject: "<a href='#data/" + model.id + "'>" + title + "</a> ",
            indirectobject: "in <a href='#corpus/" + window.app.get("corpus").id + "'>" + window.app.get("corpus").get('title') + "</a>",
            teamOrPersonal: "team",
            context: " via Offline App."
          });

          window.app.addActivity({
            verb: "<a href='" + differences + "'>" + verb + "</a> ",
            verbicon: verbicon,
            directobjecticon: "icon-pushpin",
            directobject: "<a href='#data/" + model.id + "'>" + title + "</a> ",
            indirectobject: "in <a href='#corpus/" + window.app.get("corpus").id + "'>" + window.app.get("corpus").get('title') + "</a>",
            teamOrPersonal: "personal",
            context: " via Offline App."
          });

          window.app.get("authentication").get("userPrivate").get("mostRecentIds").datalistid = model.id;

          /*
           * Make sure the data list is visible in this corpus
           */
          var previousversionincorpus = window.app.get("corpus").datalists.get(model.id);
          if (previousversionincorpus == undefined) {
            window.app.get("corpus").datalists.unshift(model);
          } else {
            window.app.get("corpus").datalists.remove(previousversionincorpus);
            window.app.get("corpus").datalists.unshift(model);
          }

          //make sure the dataList is in the history of the user
          if (window.app.get("authentication").get("userPrivate").get("dataLists").indexOf(model.id) == -1) {
            window.app.get("authentication").get("userPrivate").get("dataLists").unshift(model.id);
            //              window.app.get("authentication").saveAndInterConnectInApp();
          }

          if (typeof successcallback == "function") {
            successcallback();
          }
        },
        error: function(e, f, g) {
          if (OPrime.debugMode) OPrime.debug("DataList save error", e, f, g);
          if (typeof failurecallback == "function") {
            failurecallback();
          } else {
            alert('DataList save error: ' + f.reason);
          }
        }
      });
    },
    /**
     * Accepts two functions success will be called if successful,
     * otherwise it will attempt to render the current dataList views. If
     * the dataList isn't in the current corpus it will call the fail
     * callback or it will alert a bug to the user. Override the fail
     * callback if you don't want the alert.
     *
     * @param successcallback
     * @param failurecallback
     */
    setAsCurrentDataList: function(successcallback, failurecallback) {
      if (!window.app || typeof window.app.get !== "function") {
        if (typeof successcallback == "function") {
          successcallback();
        }
        return;
      }

      if (window.app.get("corpus").get("dbname") != this.get("dbname")) {
        if (typeof failurecallback == "function") {
          failurecallback();
        } else {
          alert("This is a bug, cannot load the dataList you asked for, it is not in this corpus.");
        }
        return;
      }

      if (window.app.get("currentDataList").id != this.id) {
        window.app.set("currentDataList", this);
      }
      window.app.get("authentication").get("userPrivate").get("mostRecentIds").datalistid = this.id;
      window.app.get("authentication").saveAndInterConnectInApp();
      if (window.appView) {
        window.appView.setUpAndAssociateViewsAndModelsWithCurrentDataList(function() {
          if (typeof successcallback == "function") {
            successcallback();
          }
        });
      } else {
        if (typeof successcallback == "function") {
          successcallback();
        }
      }
    }
  });

  return DataList;
});
