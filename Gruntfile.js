'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> \n\t<%= pkg.contributors.join("\\n\\t")  %>\n' +
      ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',
    // Task configuration.
    browserify: {
      src: {
        src: ['api/fielddb.js'],
        dest: '<%= pkg.name %>.js',
        options: {
          banner: '<%= banner %>',
          ignore: [],
          shim: {},
          basedir: './'
        }
      }
    },
    uglify: {
      options: {
        banner: '<%= banner %>'
      },
      dist: {
        src: '<%= browserify.src.dest %>',
        dest: '<%= pkg.name %>.min.js'
      },
    },
    // to run one folder of tests only: $ jasmine-node tests/corpus --matchall
    jasmine_node: {
      options: {
        match: '.',
        matchall: false,
        extensions: 'js',
        specNameMatcher: 'Test',
        projectRoot: './',
        requirejs: false,
        forceExit: true,
        isVerbose: true,
        showColors: true,
        jUnit: {
          report: true,
          savePath: './build/reports/jasmine/',
          consolidate: true,
          useDotNotation: false
        }
      },
      all: ['tests/']
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      gruntfile: {
        src: 'Gruntfile.js'
      },
      lib: {
        options: {
          jshintrc: '.jshintrc'
        },
        src: ['api/fielddb.js', 'api/FieldDBObject.js', 'api/Collection.js', 'api/CORS.js', 'api/FieldDBConnection.js', 'api/confidentiality_encryption/Confidential.js',  'api/corpus/Corpus.js', 'api/corpus/PsycholinguisticsDatabase.js', 'api/datum/DatumTag.js', 'api/datum/DatumTags.js',  'api/datum/DatumField.js', 'api/corpus/Database.js', 'api/import/Import.js', 'api/user/UserMask.js', 'api/user/Speaker.js', 'api/user/Consultant.js', 'api/user/Participant.js', 'api/corpus/CorpusMask.js']
      },
      test: {
        options: {
          jshintrc: 'tests/.jshintrc',
          ignores: ['tests/libs/**/*js']
        },
        src: ['tests/FieldDBTest.js', 'tests/FieldDBObjectTest.js', 'tests/confidentiality_encryption/ConfidentialTest.js', 'tests/import/ImportTest.js', 'tests/CollectionTest.js', 'tests/corpus/CorpusTest.js', 'tests/datum/DatumFieldsTest.js', 'tests/user/UserTest.js', 'tests/user/ConsultantTest.js']
      },
    },
    jsdoc: {
      dist: {
        jsdoc: 'node_modules/.bin/jsdoc',
        src: ['api/**/*.js'],
        // src: ['api/**/*.js', '!tests/libs/**/*.js', 'tests/**/*.js'],
        options: {
          destination: 'docs/javascript'
        }
      }
    },
    watch: {
      gruntfile: {
        files: '<%= jshint.gruntfile.src %>',
        tasks: ['jshint:gruntfile']
      },
      lib: {
        files: '<%= jshint.lib.src %>',
        tasks: ['jshint:lib', 'jasmine_node', 'browserify']
      },
      test: {
        files: '<%= jshint.test.src %>',
        tasks: ['jshint:test', 'jasmine_node']
      },
    },
    exec: {
      buildFieldDBAngularCore: {
        cmd: function() {
          return "bash scripts/build_fielddb_angular_core.sh";
        }
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-jasmine-node');
  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task.
  grunt.registerTask('docs', ['jsdoc']);
  grunt.registerTask('build', ['jshint', 'browserify', 'uglify']);
  grunt.registerTask('default', ['jshint', 'jasmine_node', 'browserify', 'uglify']);
  grunt.registerTask('default', ['jasmine_node', 'browserify', 'uglify']);
  grunt.registerTask('travis', ['jasmine_node', 'browserify', 'uglify', 'docs', 'exec:buildFieldDBAngularCore']);
  grunt.registerTask('fielddb-angular', ['exec:buildFieldDBAngularCore']);

};
