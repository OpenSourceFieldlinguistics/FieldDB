try {
  var ObservableDOM = require("frb/dom"); // add support for content editable
} catch (e) {
  console.warn("Warning contentEditable won't work because : \n", e, "\n\n");
}

var Bindings = require("frb/bindings");
var SortedSet = require("collections/sorted-set");
var UniqueSet = require("collections/set");
var CORS = require("../CORS").CORS;
// var CORS = require("../CORSNode").CORS;
var Q = require("q");
var LexiconNode = require("./LexiconNode").LexiconNode;


// Load n grams map reduce which is used in both couchdb and in the codebase
var LEXICON_NODES_MAP_REDUCE = {
  filename: "morphemesPrecedenceContext",
  map: null,
  reduce: null,
  rows: [],
  emit: function(key, val) {
    this.rows.push({
      key: key,
      value: val
    });
  }
};
try {
  var mapcannotbeincludedviarequire = require("../../couchapp_lexicon/views/morphemesPrecedenceContext/map").morphemesPrecedenceContext;
  var emit = LEXICON_NODES_MAP_REDUCE.emit;
  // ugly way to make sure references to 'emit' in map/reduce bind to the above emit
  eval("LEXICON_NODES_MAP_REDUCE.map = " + mapcannotbeincludedviarequire.toString() + ";");
} catch (exception) {
  console.log("Unable to parse the map reduce ", exception.stack);
  var emit = LEXICON_NODES_MAP_REDUCE.emit;
  LEXICON_NODES_MAP_REDUCE.map = function() {
    emit("error", "unable to load map reduce");
  };
}

// Load n grams map reduce which is used in both couchdb and in the codebase
var LEXICON_CONNECTED_GRAPH_MAP_REDUCE = {
  filename: "morphemesPrecedenceContext",
  map: null,
  reduce: null,
  rows: [],
  emit: function(key, val) {
    this.rows.push({
      key: key,
      value: val
    });
  }
};
try {
  var mapcannotbeincludedviarequire = require("../../couchapp_lexicon/views/morphemesPrecedenceContext/map").morphemesPrecedenceContext;
  var emit = LEXICON_CONNECTED_GRAPH_MAP_REDUCE.emit;
  // ugly way to make sure references to 'emit' in map/reduce bind to the above emit
  eval("LEXICON_CONNECTED_GRAPH_MAP_REDUCE.map = " + mapcannotbeincludedviarequire.toString() + ";");
} catch (exception) {
  console.log("Unable to parse the map reduce ", exception.stack);
  var emit = LEXICON_CONNECTED_GRAPH_MAP_REDUCE.emit;
  LEXICON_CONNECTED_GRAPH_MAP_REDUCE.map = function() {
    emit("error", "unable to load map reduce");
  };
}


/**
 * @class Lexicon is directed graph (triple store) between morphemes and
 *        their allomorphs and glosses. It allows the search to index
 *        the corpus to find datum, it is also used by the default glosser to guess glosses based on what the user inputs on line 1 (utterance/orthography).
 *
 * @description  Lexicon is directed graph (triple store) between morphemes and
 *        their allomorphs and glosses. It allows the search to index
 *        the corpus to find datum, it is also used by the default glosser to guess glosses based on what the user inputs on line 1 (utterance/orthography).
 *
 *
 * @extends SortedSet
 *
 * @constructs
 *
 */

var Lexicon = function(options) {
  options = options || {};
  var entries = [];
  var equals;
  var compare;
  var getDefault = options.getDefault;

  if (!this.fieldDBtype) {
    this.fieldDBtype = "Lexicon";
  }
  /* Treat the options in a fielddb way so they dont get added to the SortedSet directly */
  if (options && (Object.prototype.toString.call(options) === "[object Array]" || options.rows)) {
    if ((options.rows && options.rows[0] && options.rows[0].key && options.rows[0].key.relation) || options[0].relation || (options[0].key && options[0].key.relation)) {
      this.warn("constructing a lexicon from a set of connected nodes");
      // this.entryRelations = options;
      var entryRelations = options.rows || options;
      this.entryRelations = entryRelations;
      // this.entryRelations = new UniqueSet();
      this.references = new UniqueSet();
      // this.updateConnectedGraph(entryRelations);

    } else {
      this.debug("constructing a lexicon from nodes", options);
      entries = options;
    }
  } else if (options && typeof options === "object") {

    if (options.equals && typeof options.equals === "function") {
      equals = options.equals;
      this.warn("using equals from options " + equals);
      delete options.equals;
    }
    /* If options was an object then use the equals and compares functions (only do this if it was an object because collections is extending the prototype of Array)

      TODO collections is extending the prototoype of arrays!!!!
      TypeError: undefined is not a function
      at Function.Array.unzip (/Users/gina/fielddbhome/FieldDB/node_modules/collections/shim-array.js:38:24)
      at GenericCollection.zip (/Users/gina/fielddbhome/FieldDB/node_modules/collections/generic-collection.js:206:18)
      at GenericOrder.compare (/Users/gina/fielddbhome/FieldDB/node_modules/collections/generic-order.js:39:27)
      at null.contentCompare (/Users/gina/fielddbhome/FieldDB/node_modules/collections/shim-array.js:254:47)
      at SortedSet.splay (/Users/gina/fielddbhome/FieldDB/node_modules/collections/sorted-set.js:377:31)
      at SortedSet.add (/Users/gina/fielddbhome/FieldDB/node_modules/collections/sorted-set.js:71:14)
      at Object.create.add.value [as add] (/Users/gina/fielddbhome/FieldDB/api/lexicon/Lexicon.js:621:31)
    */
    if (options.compare && typeof options.compare === "function") {
      compare = options.compare;
      this.warn("using compare from options " + compare);
      delete options.compare;
    }

    this.debug("constructing a lexicon from an object", options);
    for (var property in options) {
      if (options.hasOwnProperty(property)) {
        if (property === "collection" || property === "entries" || property === "nodes") {
          entries = entries.concat(entries, options[property]);
          this.debug("adding ", entries);
        } else {
          this[property] = options[property];
        }
      }
    }
  }

  /** Ensure equals and compare are set to LexiconNode compare if they were not injected */
  if (!equals || typeof equals !== "function") {
    if (typeof Lexicon.LexiconNode.prototype.uniqueEntriesOnHeadword === "function") {
      equals = Lexicon.LexiconNode.prototype.uniqueEntriesOnHeadword;
      this.debug("using uniqueEntriesOnHeadword as equals for the lexicon" + equals);
    } else {
      this.warn("using nothing for equals" + equals);
    }
  }
  if (!compare || typeof compare !== "function") {
    if (typeof Lexicon.LexiconNode.prototype.compare === "function") {
      compare = Lexicon.LexiconNode.prototype.compare;
      this.debug("using LexiconNode.prototype.compare as compare for the lexicon" + compare);
    } else {
      this.warn("using nothing for compare" + compare);
    }
  }


  this.debug("\tConstructing Lexicon... ", [], equals, compare, options.getDefault);
  // SortedSet.apply(this, [options, equals, compare, getDefault]);
  SortedSet.apply(this, [
    [], equals, compare, options.getDefault
  ]);


  if (!this.contentCompare || this.contentCompare !== compare) {
    this.bug(" Setting the contentCompare didnt work.");
    this.contentCompare = compare;
  }
  if (this.contentEquals !== equals) {
    this.bug(" Setting the contentCompare didnt work.");
    this.contentEquals = equals;
  }
  if (entries && entries.length) {
    this.add(entries);
  }
};

Lexicon.prototype = Object.create(SortedSet.prototype, /** @lends Lexicon.prototype */ {
  constructor: {
    value: Lexicon
  },

  debug: {
    value: function() {
      try {
        return FieldDB.FieldDBObject.prototype.debug.apply(this, arguments);
      } catch (e) {
        // console.log("Showing developer ", arguments);
      }
    }
  },
  bug: {
    value: function() {
      try {
        return FieldDB.FieldDBObject.prototype.bug.apply(this, arguments);
      } catch (e) {
        console.warn("Not telling user about a bug ", arguments);
      }
    }
  },
  popup: {
    value: function() {
      try {
        return FieldDB.FieldDBObject.popup.apply(this, arguments);
      } catch (e) {
        console.warn("Not telling user about a popup ", arguments);
      }
    }
  },
  confirm: {
    value: function() {
      try {
        return FieldDB.FieldDBObject.prototype.confirm.apply(this, arguments);
      } catch (e) {
        console.warn("Not asking user about ", arguments);
      }
    }
  },
  warn: {
    value: function(message) {

      try {
        return FieldDB.FieldDBObject.prototype.warn.apply(this, arguments);
      } catch (e) {
        if (this.warnMessage) {
          this.warnMessage += ";;; ";
        } else {
          this.warnMessage = "";
        }
        this.warnMessage = this.warnMessage + message;
        console.warn("Not warning user about ", arguments);
      }
    }
  },

  getLexicalEntries: {
    value: function(lexicalEntryToMatch) {
      var deffered = Q.defer(),
        matches = [],
        self = this;

      if (!lexicalEntryToMatch) {
        deffered.resolve(matches);
      } else {
        this.filter(function(value, key, object, depth) {
          this.debug(key + " of " + self.length);
          if (typeof lexicalEntryToMatch.uniqueEntriesOnHeadword === "function") {
            if (lexicalEntryToMatch.uniqueEntriesOnHeadword(value)) {
              matches.push(value);
              this.debug("lexicalEntryToMatch equals ", value);
            }
          } else {
            var howWellDoesThisMatch = 0;
            lexicalEntryToMatch = lexicalEntryToMatch.trim();
            for (var attr in value) {
              if (value.hasOwnProperty(attr) && value[attr] === lexicalEntryToMatch) {
                howWellDoesThisMatch = howWellDoesThisMatch + 1;
              }
            }
            if (howWellDoesThisMatch > 0) {
              matches.push(value);
              this.debug("lexicalEntryToMatch matches well enough ", value);
            } else {
              this.debug("lexicalEntryToMatch doesnt match ", value);
            }
          }
          if (key === self.length - 1) {
            deffered.resolve(matches);
          }
        }, this);
      }
      return deffered.promise;
    }
  },

  bindToView: {
    value: function() {
      return this.render(arguments);
    }
  },

  render: {
    value: function() {
      var lexicalEntriesElement,
        binding,
        bindings = [],
        listElement,
        entryvalue,
        entrykey,
        iterate,
        entryIndex,
        listItemView,
        fieldLabelElement,
        fieldDTElement,
        fieldDDElement,
        fieldElement,
        fieldList,
        headword,
        saveButton,
        contexts,
        field,
        classList;

      var self = this;
      lexicalEntriesElement = this.lexicalEntriesElement;
      if (!lexicalEntriesElement) {
        return;
      }
      if (!self.localDOM) {
        return;
      }
      listElement = self.localDOM.createElement("ul");
      lexicalEntriesElement.appendChild(listElement);

      this.forEach(function(entry) {
        var discussion,
          field;

        if (entry && entry.morphemes === "@") {
          return;
        }
        var cleanAndSaveIfChanged = function(e) {
          var result = e.target.parentElement.__data__.clean().then(function(proposedChanges) {
            if (proposedChanges.length > 0) {
              var changesAsStrings = [];
              proposedChanges.map(function(change) {
                changesAsStrings.push(change.before + " -> " + change.after);
              });
              var saveEditToAllData = self.confirm("Would you like to clean this lexical entry? (This will change all examples you see here to have this new information.)\n\n" + changesAsStrings.join("\n"));
              if (saveEditToAllData) {
                e.target.parentElement.__data__.save().then(function(result) {
                  console.log("Saving success...", result);
                  self.popup("Saved " + changesAsStrings.join(" "));
                }, function(reason) {
                  console.log("Saving failed...", reason);
                  self.bug("Save failed. " + reason.userFriendlyErrors.join(" "));
                }).fail(function(reason) {
                  console.log("Saving failed...", reason);
                  self.bug("Save failed. Please notify the app's developers " + e.target.parentElement.__data__.datumids.join(" "));
                });
              }
            }
          });

        };
        var toggleEditMode = function(e) {
          /* If the user clicks on edit, they can investigate its data in the console */
          if (!e || !e.target || !e.target.__data__) {
            return;
          }
          /* Create the json View if its not there, otherwise toggle its hidden */
          if (!e.target.jsonView) {
            e.target.jsonView = self.localDOM.createElement("textarea");
            e.target.appendChild(e.target.jsonView);
            e.target.jsonView.classList.add("lexiconJSON");
            discussion.hidden = !discussion.hidden;
          } else {
            cleanAndSaveIfChanged(e);
            discussion.hidden = !discussion.hidden;
            e.target.jsonView.hidden = discussion.hidden;
          }
          /* If jsonView is becomming hidden, save its values to the data, otherwise, fill it with the current data */
          if (e.target.jsonView.hidden) {
            var newIgt;
            try {
              newIgt = JSON.parse(e.target.jsonView.innerHTML);
              for (var field in newIgt) {
                if (newIgt.hasOwnProperty(field)) {
                  // e.target.__data__[field] = newIgt[field];
                }
              }
            } catch (except) {
              console.warn("Invalid JSON " + e.target.jsonView.innerHTML, except);
            }
          } else {
            e.target.jsonView.innerHTML = JSON.stringify(e.target.__data__, null, 2);
          }
          try {
            window.currentlySelectedNode = e.target;
            console.log(window.currentlySelectedNode.__data__);
          } catch (e) {
            console.warn("Unable to make current node investigatable on the console.");
          }
        };

        listItemView = self.localDOM.createElement("li");
        listItemView.__data__ = entry;
        listItemView.style.opacity = listItemView.__data__.confidence;
        listItemView.classList.add("lexical-entry");
        listItemView.classList.add("scrollable");
        if (listItemView.__data__.morphemes) {
          listItemView.id = listItemView.__data__.morphemes;
        }
        // console.log("\tCreating Node view for " + listItemView.id);

        headword = self.localDOM.createElement("span");
        headword.contentEditable = "true";
        headword.classList.add("headword");
        headword.setAttribute("title", "CLick to edit the headword of your lexical entry");

        saveButton = self.localDOM.createElement("button");
        saveButton.classList.add("btn");
        saveButton.setAttribute("title", "Click here to save");
        saveButton.innerHTML = "Save ";
        saveButton.onclick = cleanAndSaveIfChanged;

        contexts = self.localDOM.createElement("span");
        contexts.classList.add("utteranceContext");

        discussion = self.localDOM.createElement("span");
        discussion.contentEditable = "true";
        discussion.classList.add("discussion");
        discussion.hidden = true;
        listItemView.__data__.discussion = listItemView.__data__.discussion || "Lorem ipsum dolor sit amet, consectetur adipisicing elit, ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
        listItemView.ondblclick = toggleEditMode;

        fieldList = self.localDOM.createElement("dl");

        var component = {
          listItemView: listItemView,
          saveButtonView: saveButton,
          headwordView: headword,
          contextsView: contexts,
          discussionView: discussion,
          fieldListView: fieldList,
          fieldViews: {},
          data: entryvalue
        };

        for (field in listItemView.__data__) {
          if (listItemView.__data__.hasOwnProperty(field)) {
            if (field === "discussion" || field === "headword") {
              continue;
            }
            try {
              headword.classList.add(field + ":" + listItemView.__data__[field]);
              discussion.classList.add(field + ":" + listItemView.__data__[field]);

              fieldDTElement = self.localDOM.createElement("dt");
              fieldLabelElement = self.localDOM.createElement("span");
              fieldLabelElement.innerHTML = field;
              fieldLabelElement.classList.add("fieldlabel");
              fieldLabelElement.classList.add(field);
              fieldLabelElement.classList.add(listItemView.__data__[field]);
              fieldDTElement.appendChild(fieldLabelElement);
              fieldList.appendChild(fieldDTElement);

              fieldDDElement = self.localDOM.createElement("dd");
              fieldElement = self.localDOM.createElement("span");
              fieldElement.contentEditable = "true";
              fieldElement.classList.add("fieldvalue");
              fieldElement.classList.add(field);
              fieldElement.classList.add(listItemView.__data__[field]);
              component.fieldViews[field] = fieldElement;
              fieldDDElement.appendChild(fieldElement);
              fieldList.appendChild(fieldDDElement);

              var viewPath = "fieldViews." + field + ".value";
              var dataPath = "listItemView.__data__." + field;
              var bindSet = {};
              bindSet[viewPath] = {
                "<-": dataPath
              };
              var bindTwoWay = {};
              bindTwoWay[dataPath] = {
                "<->": viewPath
              };
              Bindings.defineBindings(component, bindSet);
              Bindings.defineBindings(component, bindTwoWay);

            } catch (e) {
              console.warn(e);
            }
          }
        }

        Bindings.defineBindings(component, {
          "headwordView.value": {
            "<-": "listItemView.__data__.headword"
          },
          "saveButtonView.innerHTML": {
            "<-": "'Save '+listItemView.__data__.headword"
          },
          // "saveButtonView.classList.has('btn-danger')": {
          //   "<-": "listItemView.__data__.unsaved"
          // },
          "discussionView.value": {
            "<-": "listItemView.__data__.discussion"
          },
          "contextsView.innerHTML": {
            // "<-": "' '+listItemView.__data__.utteranceContext.join(',')+listItemView.__data__.utteranceContext?listItemView.__data__.utteranceContext.length : '0'"
            "<-": "listItemView.__data__.utteranceContext.join(' ; ')"
          },
          "listItemView.title": {
            "<-": "'Example: '+listItemView.__data__.utteranceContext.join(' Example: ')"
          },
          "listItemView.hidden": {
            "<-": "listItemView.__data__.confidence < self.localDOM.getElementById('lexiconConfidenceThreshold').value / 10"
          }
        });

        Bindings.defineBindings(component, {
          "listItemView.__data__.headword": {
            "<->": "headwordView.value"
          },
          "listItemView.__data__.discussion": {
            "<->": "discussionView.value"
          }
        });

        listItemView.appendChild(headword);
        listItemView.appendChild(discussion);
        listItemView.appendChild(fieldList);
        listItemView.appendChild(contexts);
        listItemView.appendChild(saveButton);
        listElement.appendChild(listItemView);

      });

    }
  },

  toJSON: {
    value: function() {
      return JSON.stringify(this.toObject(), null, 2);
    }
  },

  entryRelations: {
    get: function() {
      return this._entryRelations;
    },
    set: function(value) {
      if (value.rows) {
        value = value.rows;
      }
      this._entryRelations = value;
    }
  },

  precedenceRelations: {
    get: function() {
      return this.entryRelations;
    },
    set: function(value) {
      this.entryRelations = value;
    }
  },

  guessContextSensitiveGlosses: {
    value: function(datum) {

      if (!datum.morphemes) {
        console.warn("There was no morphemes line to guess the gloss from...");
        return datum;
      }
      var glossGroups = [];
      var matchingNodes = [];
      var morphemeToFind = "";
      var morphemeGroup = datum.morphemes.split(/ +/);
      var matchingfunction = function(node) {
        if (node.morphemes === morphemeToFind) {
          // console.log(node);
          matchingNodes.push(node);
        }
      };
      for (var group in morphemeGroup) {
        var morphemes = morphemeGroup[group].split("-");
        var glosses = [];
        for (var m in morphemes) {
          if (!morphemes.hasOwnProperty(m)) {
            continue;
          }
          matchingNodes = [];
          morphemeToFind = morphemes[m];
          this.filter(matchingfunction);

          var gloss = "?"; // If there's no matching gloss, use question marks
          if (matchingNodes && matchingNodes.length > 0) {
            // Take the first gloss for this morpheme
            // console.log("Glosses which match: " + morphemes[m], matchingNodes);
            try {
              gloss = matchingNodes[0].gloss;
            } catch (e) {
              // console.log(matchingNodes);
            }
          }
          glosses.push(gloss);
        }

        glossGroups.push(glosses.join("-"));
      }
      datum.glossAlternates = datum.glossAlternates ? datum.glossAlternates.concat(glossGroups) : glossGroups;
      datum.gloss = glossGroups.join(" ");
      // Replace the gloss line with the guessed glosses
      return datum;
    }
  },

  /**
   * Finds a node in the lexicon
   *
   * @param  {Object} value either an Object or Lexicon.LexiconNode
   * @return {Array}       returns a reference to the found item(s)
   */
  find: {
    value: function(value) {
      if (!(value instanceof Lexicon.LexiconNode)) {
        value = new Lexicon.LexiconNode(value);
      }
      var result = SortedSet.prototype.find.apply(this, arguments);
      if (result) {
        this.debug("found a matching lexial entry", result.headword);
        return result.value;
      } else {
        this.debug("didnt find a matching lexial entry", value.headword);
      }
    }
  },

  /**
   * Adds to the lexicon
   *
   * @param  {Object} value a simple object, and/or  an array of objects or items either Objects or Lexicon.LexiconNodes
   * @return {Array}       returns a reference to the added item(s)
   */
  add: {
    value: function(value) {
      if (value && Object.prototype.toString.call(value) === "[object Array]") {
        for (var itemIndex = 0; itemIndex < value.length; itemIndex++) {
          value[itemIndex] = this.add(value[itemIndex]);
        }
        return value;
      }
      if (!(value instanceof Lexicon.LexiconNode)) {
        value = new Lexicon.LexiconNode(value);
        value.parent = this;
      }
      SortedSet.prototype.add.apply(this, arguments);
      return value;
    }
  },

  /**
   *  Adds a node to the lexicon, if an equivalent node (as defined by the equals function) 
   *  is found, it merges the new one into the existing one.
   *  
   * @param  {Object} value A node or array of nodes
   * @return {Object}       The node or array of nodes which were added
   */
  addOrMerge: {
    value: function(value) {
      if (value && Object.prototype.toString.call(value) === "[object Array]") {
        for (var itemIndex = 0; itemIndex < value.length; itemIndex++) {
          value[itemIndex] = this.addOrMerge(value[itemIndex]);
        }
        return value;
      }
      this.debug("running addOrMerge", value);
      var existingInLexicon = this.find(value);
      if (existingInLexicon) {
        this.warn("Merging a simlar entry into the existing entry in the lexicon", existingInLexicon, value);
        existingInLexicon.merge("self", value);
        value = existingInLexicon;
      } else {
        value = this.add(value);
        this.debug("Added value " + value.headword);
      }

      return value;
    }
  },

  /**
   * Takes as a parameters an array of this.entryRelations which came from CouchDB precedence rule query.
   * Example Rule: {"key":{"x":"@","relation":"precedes","y":"aqtu","context":"aqtu-nay-wa-n"},"value":2}
   */
  generatePrecedenceForceDirectedRulesJsonForD3: {
    value: function() {
      return this.updateConnectedGraph(arguments);
    }
  },

  updateConnectedGraph: {
    value: function(prefs) {
      if (!this.entryRelations || !this.entryRelations.length) {
        this.warn("Cannot visualize relations between lexical entities if the lexicon doesn't know about any entryRelations");
        return;
      }

      var self = this;
      if (!prefs && this.corpus && this.corpus.prefs) {
        prefs = this.corpus.prefs;
      }
      if (!prefs) {
        prefs = {};
      }
      /*
       * Create the JSON required by D3
       */
      this.connectedGraph = this.connectedGraph || {
        nodes: {}
      };

      /*
       * Cycle through the precedence rules, convert them into graph edges with the morpheme index in the morpheme array as the source/target values
       */
      this.entryRelations.map(function(entryRelation) {
        if (!entryRelation) {
          return;
        }
        try {
          var connectionEdge = entryRelation.key || entryRelation;
          var from = connectionEdge.from || connectionEdge.source || connectionEdge.previous;
          var to = connectionEdge.to || connectionEdge.target || connectionEdge.subsequent;
          var datumid = entryRelation.id || "";
          var context = connectionEdge.context;
          if (typeof context === "string") {
            context = {
              id: datumid,
              morphemes: context
            };
          }
          if (!context.id) {
            this.warn("Cant figure out the id(s) of where this node might have come from");
          }

          connectionEdge.frequencyCount = connectionEdge.value || entryRelation.key ? entryRelation.key.count : null;
          self.debug("Adding ", connectionEdge, " to connected graph");

          if (!from || !to) {
            self.warn("Missing either a `from` or `to` ", connectionEdge);
            return;
          }

          /* skip word boundaries unless otherwise specified */
          if (from.morphemes === "@" ||
            from.morphemes === "_#" ||
            from.morphemes === "#_" ||
            to.morphemes === "@" ||
            to.morphemes === "_#" ||
            to.morphemes === "#_") {
            if (!prefs.showGlosserAsMorphemicTemplate) {
              self.debug("Skipping a connection involving a word boundary ", connectionEdge);
              return;
            }
          }
          /* make the @ more like what a linguist recognizes for word boundaries */
          if (from.morphemes === "@") {
            from.morphemes = "#_";
          }
          if (to.morphemes === "@") {
            to.morphemes = "_#";
          }

          if (!(from instanceof Lexicon.LexiconNode)) {
            from = new Lexicon.LexiconNode(from);
            self.debug("Converted from into a lexicon node", from.headword);
          }

          if (!(to instanceof Lexicon.LexiconNode)) {
            to = new Lexicon.LexiconNode(to);
            self.debug("Converted to into a lexicon node", to.headword);
          }

          if (!from.morphemes || !to.morphemes) {
            self.warn("Missing morphemes on the nodes, this relation cant be added to the graph ", connectionEdge);
            return;
          }

          // use bigrams unless otherwise specified
          if ((!prefs.maxDistanceForContext && connectionEdge.distance > 1) ||
            (prefs.maxDistanceForContext & connectionEdge.distance > prefs.maxDistanceForContext)) {
            self.warn("Skipping distantly related nodes ", connectionEdge.distance);
            return;
          }
          // visualize only precedes connectionEdges unless otherwise specified
          if ((!prefs.showRelations && connectionEdge.relation !== "precedes") ||
            (prefs.showRelations && prefs.showRelations.indexOf(connectionEdge.relation) === -1)) {
            self.debug("Skipping nodes which arent related by precedence " + connectionEdge.relation);
            return;
          }

          if (!self.isWithinConfidenceRange(from, prefs.confidenceRange) ||
            !self.isWithinConfidenceRange(to, prefs.confidenceRange)) {
            self.warn("Skipping nodes which arent confident enough ", connectionEdge.confidence);
            return;
          }


          // If the utterance contains the whole word, ie the context, not just the utterance of this morpheme we dont really want it
          // delete from.utterance;
          // delete to.utterance;
          // delete from.orthography;
          // delete to.orthography;
          // 

          // connectionEdge.utteranceContext = context.utterance;
          // connectionEdge.datumid = context.id;

          // // Put the previous and subsequent morphemes into the morpheme nodes
          // // this.add(context.utterance, new Lexicon.LexiconNode({
          // //   fields: from
          // // }));
          // from.datumids = [context.id];
          // from.utteranceContext = [context.utterance];
          // if (context.url) {
          //   from.url = context.url;
          // }

          // // this.add(context.utterance, new Lexicon.LexiconNode({
          // //   fields: from
          // // }));
          // to.datumids = [context.id];
          // to.utteranceContext = [context.utterance];
          // if (context.url) {
          //   to.url = context.url;
          // }
          // this.references.add(context.id);

          // //To avoid loops
          // if (to.morphemes.indexOf("@") === -1) {
          //   this.entryRelations.add(entryRelations[i].key);
          // }

          // TODO what if a similar node is here, we should merge them.
          from = self.addOrMerge(from);
          to = self.addOrMerge(to);

          // Add the from node to the list of nodes, if it is not already there
          if (!self.connectedGraph.nodes[from.headword]) {
            self.connectedGraph.nodes[from.headword] = from;
          } else {
            self.warn(from.morphemes + " was already defined. merging with this node");
            self.connectedGraph.nodes[from.headword].merge("self", from);
          }
          from = self.connectedGraph.nodes[from.headword];

          // Add the to node to the list of nodes, if it is not already there
          if (!self.connectedGraph.nodes[to.headword]) {
            self.connectedGraph.nodes[to.headword] = to;
          } else {
            self.warn(to.morphemes + " was already defined. merging with this node");
            self.connectedGraph.nodes[to.headword].merge("self", to);
          }
          to = self.connectedGraph.nodes[to.headword];

          // Use the language of connected graphs
          connectionEdge.from = from;
          connectionEdge.to = to;


          // Dont keep other names for the two nodes
          delete connectionEdge.previous;
          delete connectionEdge.subsequent;
          delete connectionEdge.source;
          delete connectionEdge.target;

          self.connectedGraph[connectionEdge.relation] = self.connectedGraph[connectionEdge.relation] || [];
          self.connectedGraph[connectionEdge.relation].push(connectionEdge);

        } catch (exception) {
          this.warn("Skipping relation because of an error"+ exception , exception.stack, entryRelation);
        }
      });

      return this.connectedGraph;
    }
  },

  dbname: {
    get: function() {
      if (this._dbname) {
        return this._dbname;
      }
      if (this.corpus && this.corpus.dbname) {
        return this.corpus.dbname;
      }
    },
    set: function(value) {
      this._dbname = value;
    }
  },

  /**
   * Overwrite/build the lexicon from the corpus server if it is there, saves
   * the results to local storage so they can be reused offline.
   *
   * OLD url /_design/pages/_view/lexicon_create_tuples?group=true
   *
   * New url _design/lexicon/_view/morphemesPrecedenceContext?group=true&limit=400
   * 
   * @param options
   * @param callback
   */
  fetch: {
    value: function(options) {
      options = options || {};

      var url = "";
      if (options.url) {
        url = options.url;
      }

      if (!url || url === "default") {
        if (!this.dbname && !options.dbname) {
          throw "Glosser's webservice can't be guessed, there is no current corpus so the URL must be defined.";
        }
        if (this.corpus.prefs && this.corpus.prefs.lexiconURL) {
          url = this.corpus.prefs.lexiconURL;
        } else {
          url = this.corpus.url + "/_design/pages/_view/" + LEXICON_NODES_MAP_REDUCE.filename + "?group=true&limit=" + Lexicon.maxLexiconSiz;
        }
      }

      var deferred = Q.defer(),
        self = this;

      CORS.makeCORSRequest({
        type: "GET",
        url: url
      }).then(function(results) {
          // self.generatePrecedenceForceDirectedRulesJsonForD3(results.rows);
          results.rows.map(function(row) {
            self.add(row);
          });
          deferred.resolve(results.rows);
        },
        function(reason) {
          deferred.reject(reason);
        }).fail(function(error) {
        console.error(error.stack, self);
        deferred.reject(error);
      });

      return deferred.promise;
    }
  },

  buildLexiconFromCouch: {
    value: function(dbname, callback) {
      this.warn("DEPRECATED buildLexiconFromCouch use fetch instead.");
    }
  },
  /**
   * Overwrite/build the lexicon from local storage if it is there.
   *
   * @param dbname
   * @param callback
   */
  buildLexiconFromLocalStorage: {
    value: {
      value: function(dbname, callback) {
        var results = localStorage.getItem(dbname + "lexiconResults");
        if (!results) {
          return;
        }
        this.generatePrecedenceForceDirectedRulesJsonForD3(results);
        if (typeof callback === "function") {
          callback();
        }
      }
    }
  },

  isWithinConfidenceRange: {
    value: function(morpheme, confidenceRange) {
      if (!confidenceRange) {
        return true;
      }
      return morpheme.confidence <= confidenceRange.max && morpheme.confidence >= confidenceRange.min;
    }
  },

  /*
   * Some sample D3 from the force-html.html example
   * http://bl.ocks.org/mbostock/1153292
   * http://alignedleft.com/tutorials/d3/binding-data
   *
   * @param  {[type]} rulesGraph [description]
   * @param  {[type]} element [description]
   * @param  {[type]} dbname  [description]
   * @return {[type]}            [description]
   */
  visualizeAsForceDirectedGraph: {
    value: function(element, prefs) {
      var self = this;
      if (!prefs && this.corpus && this.corpus.prefs) {
        prefs = this.corpus.prefs;
      }
      if (!prefs) {
        prefs = {};
      }
      if (!prefs.showRelations) {
        prefs.showRelations = ["precedes"];
      }
      if (!this.connectedGraph || !this.connectedGraph.links.length || !this.connectedGraph.nodes) {
        this.updateConnectedGraph(prefs);

        if (!this.connectedGraph || !this.connectedGraph.nodes) {
          return this;
        }

        // Include all relations which the preferences request
        this.connectedGraph.links = [];
        prefs.showRelations.map(function(relation) {
          if (!relation || !self.connectedGraph[relation] || !self.connectedGraph[relation].length) {
            return this;
          }
          self.connectedGraph.links = self.connectedGraph.links.concat(self.connectedGraph[relation]);
        });
      }
      this.debug("Displaying a connected graph of " + this.connectedGraph.links.length + " links");

      if (self.connectedGraph.links.length === 0) {
        return this;
      }

      if (!this.d3) {
        try {
          this.d3 = d3;
        } catch (e) {
          this.warn("Lexicon will be unable to render a visual representation of itself. If you intended to render it, you should add d3 as a dependancy to your app.", this.d3);
          return this;
        }
      }

      if (!element) {
        this.warn("Lexicon will be unable to render a visual representation of itself. If you intended to render it, you should provide an element where it should be rendered.", element);
        return this;
      }
      this.debug("Using element", element);

      var width = element.clientWidth,
        height = 600;

      var tooltip;
      if (!this.localDOM) {
        try {
          this.localDOM = document;
        } catch (e) {
          // this.warn("Lexicon will be unable to render a hover on the connected graph. If you intended to render it, you should provide an localDOM to the lexicon.");
          this.warn("Lexicon will be unable to render the connected graph. If you intended to render it, you should provide an localDOM to the lexicon.");
          return this;
        }
      }
      tooltip = this.localDOM.createElement("div");
      this.localDOM.body.appendChild(tooltip);
      tooltip = this.d3.select(tooltip)
        .style("position", "absolute")
        .style("z-index", "10")
        .style("visibility", "hidden")
        .html("");

      var linkArc = function(d) {
        var dx = d.source.x - d.target.x,
          dy = d.source.y - d.target.y,
          dr = Math.sqrt(dx * dx + dy * dy); //uncomment to curve the lines
        // dr = 0;
        return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
      };

      var transform = function(d) {
        if (d.morphemes === "_#") {
          d.x = width - 20;
          d.y = height / 2;
        }
        if (d.morphemes === "#_") {
          d.x = 20;
          d.y = height / 2;
        }
        return "translate(" + d.x + "," + d.y + ")";
      };

      /*
      Short morphemes will be blue, long will be red
      */
      var color = this.d3.scale.linear()
        .range(["darkblue", "darkred"]) // or use hex values
        .domain([1, 8]);

      var lineColor = this.d3.scale.linear()
        .range(["#FFFFF", "#FFFF00"]) // or use hex values
        .domain([1, 8]);

      // var force = this.d3.layout.force()
      //   .charge(-120)
      //   .linkStrength(0.2)
      //   .linkDistance(30)
      //   .size([width, height]);

      var force = this.d3.layout.force()
        .nodes(this.d3.values(self.connectedGraph.nodes))
        .links(self.connectedGraph.links)
        .size([width, height])
        .linkStrength(0.5)
        .linkDistance(60)
        .charge(-400);


      var svg = this.localDOM.createElement("svg");
      if (typeof element.appendChild !== "function") {
        this.warn("You have provided a defective element, it is unable to append elements to itself. Appending to the body of the document instead.", element);
        // return this;
        this.localDOM.body.appendChild(svg);
      } else {
        element.appendChild(svg);
      }
      svg = this.d3.select(svg);

      svg.attr("width", width)
        .attr("height", height);

      // Per-type markers, as they don't inherit styles.
      svg.append("defs").selectAll("marker")
        .data(["precedes"])
        // .data(["suit", "licensing", "resolved"])
        .enter()
        .append("marker")
        .attr("id", function(d) {
          return d;
        })
        .style("opacity", function(d) {
          // return color(d.morphemes.length);
          return 0.5;
        })
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", -1.5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5");

      var path = svg.append("g").selectAll("path")
        .data(force.links())
        .enter().append("path")
        .attr("class", function(d) {
          return "link " + d.relation + " distance" + d.distance;
        })
        .attr("marker-end", function(d) {
          return "url(#" + d.relation + ")";
        });

      var circle = svg.append("g").selectAll("circle")
        .data(force.nodes())
        .enter().append("circle")
        .attr("class", "node")
        .attr("r", 5)
        .style("fill", function(d) {
          if (d.morphemes === "#_") {
            return "#00000";
          }
          if (d.morphemes === "_#") {
            return "#ffffff";
          }
          return color(d.morphemes.length);
          // return color(d.confidence * 10);
        })
        .style("opacity", function(d) {
          // return color(d.morphemes.length);
          return d.confidence ? d.confidence / 2 : 1;
        })
        .on("mouseover", function(object) {
          var findNode;
          if (self.localDOM) {
            findNode = self.localDOM.getElementById(object.morphemes);
          }
          if (findNode) {
            findNode = findNode.innerHTML + "<p>" + findNode.getAttribute("title") + "<p>";
          } else {
            findNode = "Morpheme: " + object.morphemes + "<br/> Gloss: " + object.gloss + "<br/> Confidence: " + object.confidence;
          }
          if (tooltip) {
            return;
          }
          return tooltip
            .style("visibility", "visible")
            .html("<div class='node_details_tooltip lexicon'>" + findNode + "</div>");
        })
        .on("mousemove", function(object) {
          /*global  event */
          if (tooltip) {
            return;
          }
          return tooltip.style("top", (event.pageY - 10) + "px")
            .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", function(object) {
          if (tooltip) {
            return;
          }
          return tooltip
            .style("visibility", "hidden");
        })
        .on("click", function(d) {
          /* show the morpheme as a search result so the user can use the viz to explore the corpus*/
          if (this.application && this.application.router) {
            // this.application.router.showEmbeddedSearch(dbname, "morphemes:"+d.morphemes);
            var url = "corpus/" + self.corpus.dbname + "/search/" + "morphemes:" + d.morphemes;
            // window.location.replace(url);
            this.application.router.navigate(url, {
              trigger: true
            });

          }
        })
        .call(force.drag);

      var text = svg.append("g").selectAll("text")
        .data(force.nodes())
        .enter().append("text")
        .attr("x", 8)
        .attr("y", ".31em")
        .style("opacity", function(d) {
          // return color(d.morphemes.length);
          return d.confidence ? d.confidence / 2 : 1;
        })
        .style("color", function(d) {
          if (d.morphemes === "#_") {
            return "#00000";
          }
          if (d.morphemes === "_#") {
            return "#ffffff";
          }
          return color(d.morphemes.length);
          // return color(d.confidence * 10);
        })
        .text(function(d) {
          return d.morphemes;
        });


      // Use elliptical arc path segments to doubly-encode directionality.
      var tick = function() {
        path.attr("d", linkArc);
        circle.attr("transform", transform);
        text.attr("transform", transform);
      };

      try {
        force
          .on("tick", tick)
          .start();
      } catch (e) {
        this.warn("\nThe lexicon was able to start the connected graph. If you are in a Node.js environment, this is normal.", e.stack);
      }

      return this;
    }

  }

});

/**
 * Constructs a lexicon given an input of precedenceRules or an orthography
 *
 * @param {[type]} options [description]
 */
var LexiconFactory = function(options) {
  // var lex = new Lexicon(null, Lexicon.prototype.fieldsEqual, Lexicon.prototype.fieldsCompare);
  var lex = new Lexicon();

  if (options.orthography || options.wordFrequencies) {
    if (options.nonContentWordsArray) {
      options.userSpecifiedNonContentWords = true;
      if (Object.prototype.toString.call(options.nonContentWordsArray) === "[object Array]" && options.nonContentWordsArray.length === 0) {
        options.userSpecifiedNonContentWords = false;
        // console.log("User sent an empty array of non content words, attempting to automatically detect them");
      }
      // else if (options.nonContentWordsArray.trim && !options.nonContentWordsArray.trim()) {
      //   options.userSpecifiedNonContentWords = false;
      // }
    }
    if (options.orthography && (!options.wordFrequencies || options.wordFrequencies.length === 0) && typeof Lexicon.bootstrapLexicon === "function") {
      Lexicon.bootstrapLexicon(options);
    }
    options.wordFrequencies = options.wordFrequencies || [];

    for (var wordIndex in options.wordFrequencies) {
      if (!options.wordFrequencies.hasOwnProperty(wordIndex)) {
        continue;
      }
      var word = options.wordFrequencies[wordIndex];
      if (typeof word === "string") {
        word = {
          orthography: word
        };
      }
      /* accept Datum as words */
      if (!word && word) {
        word = word;
      }
      if (!word) {
        word = {};
      }
      if (word.orthography && !word.orthography) {
        word.orthography = word.orthography;
        delete word.orthography;
      }
      word.count = word.count || 0;
      word.categories = word.categories || [];
      word.datumids = word.datumids || word.docids || [];
      if (options._id) {
        word.datumids.push(options._id);
      }
      if (options.url) {
        word.url = options.url;
      }
      if (lex.length > Lexicon.maxLexiconSize) {
        console.warn("Ignoring lexical entry (lexicon has reached max size " + Lexicon.maxLexiconSize + ") ", word);
        continue;
      }
      lex.add(new Lexicon.LexiconNode(word));
    }
  }

  for (var property in options) {
    if (options.hasOwnProperty(property)) {
      lex[property] = options[property];
    }
  }
  return lex;
};

Lexicon.LexiconNode = LexiconNode;
Lexicon.LexiconFactory = LexiconFactory;
Lexicon.maxLexiconSize = 1000;

exports.Lexicon = Lexicon;
