/**
 * FieldDB
 * A open ended database for  evolving data collection projects
 *
 * @module          FieldDB
 * @tutorial        tests/FieldDBTest.js
 * @requires        Export
 * @requires        FieldDBObject
 * @requires        CORS
 * @requires        UserMask
 */
(function(exports) {
	'use strict';
	var Export = require("./export/Export");
	var FieldDBObject = require("./FieldDBObject").FieldDBObject;
	var CORS = require("./CORS").CORS;
	var Router = require("./Router").Router;
	var UserMask = require("./user/UserMask").UserMask;
	var CorpusMask = require("./corpus/CorpusMask").CorpusMask;

	var FieldDB = {};

	FieldDB.Export = Export;
	FieldDB.FieldDBObject = FieldDBObject;
	FieldDB.CORS = CORS;
	FieldDB.Router = Router;
	FieldDB.UserMask = UserMask;
	FieldDB.CorpusMask = CorpusMask;

	exports.FieldDB = FieldDB;
	global.FieldDB = FieldDB;

}(typeof exports === 'object' && exports || this));
