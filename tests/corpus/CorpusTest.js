var Corpus = require("../../api/corpus/Corpus").Corpus;
var SAMPLE_v1_CORPUS_MODELS = require("../../sample_data/corpus_v1.22.1.json");
var DatumFields = require("../../api/datum/DatumFields").DatumFields;

var specIsRunningTooLong = 5000;

describe("Corpus", function() {
  it("should be load", function() {
    expect(Corpus).toBeDefined();
  });

  describe("construction options", function() {

    it("should accept v1.22.1 json", function() {
      var corpus = new Corpus(SAMPLE_v1_CORPUS_MODELS[0]);
      expect(corpus.dbname).toEqual("sapir-firstcorpus");
      expect(corpus.pouchname).toEqual("sapir-firstcorpus");

      var serialized = corpus.toJSON();
      expect(serialized.pouchname).toBeDefined();
    });

    it("should accept v2.2 json", function() {
      var corpus = new Corpus({
        dbname: "lingllama-communitycorpus"
      });
      expect(corpus.dbname).toEqual("lingllama-communitycorpus");
      expect(corpus.pouchname).toEqual("lingllama-communitycorpus");

      var serialized = corpus.toJSON();
      expect(serialized.pouchname).toBeDefined();
      expect(serialized.datumfields).toBeUndefined();
    });

    it("should not be able to change a dbname if it has been set", function() {
      var corpus = new Corpus(Corpus.prototype.defaults);
      expect(corpus.dbname).toEqual("");
      corpus.dbname = "testingdefaultcorpuscreation-kartuli";
      expect(function() {
        corpus.dbname = "adiffernetuser-kartuli";
      }).toThrow('This is the testingdefaultcorpuscreation-kartuli. You cannot change the dbname of a corpus, you must create a new object first.');
    });

  });

  describe("prefs", function() {
    it("should be possible to set team preferences for a view", function() {
      var corpus = new Corpus();
      expect(corpus.prefs).toBeUndefined();
      corpus.preferredDashboardLayout = "layoutEverythingAtOnce";
      corpus.preferredDatumTemplate = "yalefieldmethodsspring2014template";
      corpus.preferredLocale = "fr";

      var serialized = corpus.toJSON();
      expect(serialized.prefs.type).toEqual("UserPreference");
      expect(serialized.prefs.preferredDashboardLayout).toEqual("layoutEverythingAtOnce");
      expect(serialized.prefs.preferredDatumTemplate).toEqual("yalefieldmethodsspring2014template");
      expect(serialized.prefs.preferredLocale).toEqual("fr");

      corpus.preferredDatumTemplate = "default";
      expect(corpus.preferredDatumTemplate).toBeUndefined();
    });
  });

  describe("datum creation", function() {
    var corpus;

    beforeEach(function() {
      // console.log(Corpus.prototype.defaults);
      corpus = new Corpus(Corpus.prototype.defaults);
      corpus.dbname = "testingnewdatum-kartuli";
    });

    it("should have default datumFields", function() {
      expect(corpus.datumFields instanceof DatumFields).toBeTruthy();
      expect(corpus.datumFields.constructor === DatumFields);
      // console.log(corpus.datumFields.utterance);
      // console.log(corpus.datumFields.toJSON());
      expect(corpus.datumFields.utterance.labelFieldLinguists).toEqual('Utterance');
      expect(corpus.datumFields.clone()).toBeDefined();
    });

    it("should create a datum with the datumFields", function(done) {
      corpus.newDatum().then(function(datum) {
        expect(datum.datumFields.utterance.labelFieldLinguists).toEqual('Utterance');
      }).then(done, done);
      // console.log(datum.toJSON());
    }, specIsRunningTooLong);

  });


  xdescribe("serialization ", function() {


    xit("should clean v1.22.1 to a maximal json", function() {
      var corpus = new Corpus(SAMPLE_v1_CORPUS_MODELS[0]);
      expect(corpus.toJSON("complete")).toEqual("");
    });

    xit("should clean v1.22.1 to a minimaljson", function() {
      var corpus = new Corpus(SAMPLE_v1_CORPUS_MODELS[0]);
      expect(corpus.toJSON(null, "lightweight")).toEqual({
        _id: "60B9B35A-A6E9-4488-BBF7-CB54B09E87C1",
        _rev: "19-863850b93c42a90205017215a45b7668",
        title: "Sample Corpus",
        titleAsUrl: "sample_corpus",
        description: "This is a sample corpus which I made by importing one of my colleagues data files from FileMaker Pro.  It has some comments in it to explain what I did to make the corpus and search it.",
        datumFields: [{
          "label": "dateElicited",
          "value": "",
          "mask": "",
          "encrypted": "",
          "shouldBeEncrypted": "checked",
          "help": "This field came from file import ",
          "userchooseable": ""
        }, {
          "label": "notes",
          "value": "",
          "mask": "",
          "encrypted": "",
          "shouldBeEncrypted": "checked",
          "help": "This field came from file import ",
          "userchooseable": ""
        }, {
          "label": "checkedWithConsultant",
          "value": "lucia",
          "mask": "lucia",
          "encrypted": "",
          "shouldBeEncrypted": "checked",
          "help": "This field came from file import ",
          "userchooseable": ""
        }, {
          "label": "dialect",
          "value": "",
          "mask": "",
          "encrypted": "",
          "shouldBeEncrypted": "checked",
          "help": "This field came from file import ",
          "userchooseable": ""
        }],
        dbname: "sapir-firstcorpus",
        confidential: {
          secretkey: "8acfb0d3-9ce4-3c02-e7c1-f56b78b705dd"
        },
        publicCorpus: "Private",
        version: "v2.0.1"
      });
    });

  });

});



describe("Corpus: as a user I want to be able to merge two corpora", function() {
  var oneCorpus;
  var anotherCorpus;

  beforeEach(function() {
    oneCorpus = new Corpus({
      dbname: "teammatetiger-quechua",
      title: "Quechua Corpus",
      datumFields: [{
        "label": "utterance",
        "help": "Teammate's help info"
      }]
    });
    anotherCorpus = new Corpus({
      dbname: "lingllama-quechua",
      title: "Quechua",
      datumFields: [{
        "label": "utterance",
        "help": "An adapted utterance line for quechua data"
      }]
    });
  });

  it("should merge the corpus details into the first corpus", function() {
    oneCorpus.merge("self", anotherCorpus, "overwrite&changeDBname");
    expect(oneCorpus).toBeDefined();
    expect(oneCorpus.title).toEqual("Quechua");
    expect(oneCorpus.datumFields.utterance.help).toEqual("An adapted utterance line for quechua data");
  });

  it("should be able to ask the user what to do if the corpus details conflict", function() {
    oneCorpus.merge("self", anotherCorpus, "changeDBname");
    expect(oneCorpus).toBeDefined();
    expect(oneCorpus.confirmMessage).toContain('I found a conflict for _dbname, Do you want to overwrite it from "teammatetiger-quechua" -> "lingllama-quechua"');
    expect(oneCorpus.confirmMessage).toContain('I found a conflict for _title, Do you want to overwrite it from "Quechua Corpus" -> "Quechua"');
    expect(oneCorpus.confirmMessage).toContain('I found a conflict for _titleAsUrl, Do you want to overwrite it from "quechua_corpus" -> "quechua"');
  });

  it("should merge the corpus details into a third corpus without affecting the other corpora", function() {
    var aNewCorpus = new Corpus({
      dbname: "comunity-quechua",
      datumFields: [{
        "label": "morphemes",
        "help": "A help text"
      }]
    });
    expect(aNewCorpus.dbname).toEqual("comunity-quechua");
    expect(aNewCorpus.title).toEqual("");

    aNewCorpus.merge(oneCorpus, anotherCorpus, "overwrite&keepDBname");
    expect(aNewCorpus).toBeDefined();

    expect(aNewCorpus.dbname).toEqual("comunity-quechua");
    expect(aNewCorpus.title).toEqual("Quechua");
    expect(aNewCorpus.datumFields.morphemes.help).toEqual("A help text");
    expect(aNewCorpus.datumFields.utterance.help).toEqual("An adapted utterance line for quechua data");

    expect(oneCorpus.dbname).toEqual("teammatetiger-quechua");
    expect(oneCorpus.title).toEqual("Quechua Corpus");
    expect(oneCorpus.datumFields.utterance.help).toEqual("Teammate's help info");
    expect(oneCorpus.datumFields.morphemes).toBeUndefined();

    expect(anotherCorpus.dbname).toEqual("lingllama-quechua");
    expect(anotherCorpus.title).toEqual("Quechua");
    expect(anotherCorpus.datumFields.utterance.help).toEqual("An adapted utterance line for quechua data");
    expect(anotherCorpus.datumFields.morphemes).toBeUndefined();

  });

  xit("should change the dbname of the datum to the target corpus dbname", function() {
    expect(true).toBeTruthy();
  });

});


describe("Corpus: as a psycholinguist I want to have any number of fields on my participants.", function() {
  it("should be have speaker fields on participants", function() {
    expect(Corpus.prototype.defaults_psycholinguistics.participantFields.length).toBe(10);
  });
});


xdescribe("Corpus: as a team we want to be able to go back in time in the corpus revisions", function() {
  it("should be able to import from GitHub repository", function() {
    expect(true).toBeTruthy();
  });
});

xdescribe("Corpus: as a user I want to be able to import via drag and drop", function() {
  it("should detect drag and drop", function() {
    expect(true).toBeTruthy();
  });
});

xdescribe("Corpus: as a user I want to be able to go offline, but still have the most recent objects in my corpus available", function() {
  it("should have the most recent entries available", function() {
    expect(true).toBeTruthy();
  });
  it("should store the corpus offine", function() {
    expect(true).toBeTruthy();
  });
});
