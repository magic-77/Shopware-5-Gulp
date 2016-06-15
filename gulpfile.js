
'use strict';

/**
    Gulp Requirements
*/
var gulp = require('gulp'),
  $ = require('gulp-load-plugins')(),
  gutil = require('gulp-util'),
  minimist = require('minimist'),
  fs = require('fs'),
  sequence = require('run-sequence');


/**
  --shopId <Number> Set Shopware Shop ID
  --excludeSWtheme  If given, Shopware Responsive Theme will be excluded
*/
var cliflags = {
  default: {
    shopId: process.env.NODE_ENV || 1,
    excludeSWtheme: process.env.NODE_ENV || false
  }
};

var shopId = minimist(process.argv.slice(2), cliflags).shopId,
  file = '../web/cache/config_' + shopId + '.json',
  config = require(file),
  pathObject = require('path').parse(config.lessTarget),
  jsFiles = [],
  content = '',
  excludeSWtheme = minimist(process.argv.slice(2), cliflags).excludeSWtheme;


/**
    Some Basic Paths
    
    pathObject returns
    { root: '',
      dir: 'web/cache',
      base: 'timestamp_hash.css',
      ext: '.css',
      name: 'timestamp_hash' 
    }

*/
var path = {
  build: '../' + pathObject.dir,
  lessSource: '../' + pathObject.dir + '/' + pathObject.name + '.less',
  jsTarget: pathObject.name + '.js',
  variables: {
    'font-directory': '"../../themes/Frontend/Responsive/frontend/_public/src/fonts"',
    'OpenSansPath': '"../../themes/Frontend/Responsive/frontend/_public/vendors/fonts/open-sans-fontface"'
  },
  watch: {
    less: [
      '../engine/Shopware/Plugins/**/*.less',
      '../themes/Frontend/**/*.less'
    ],
    js: [
      '../themes/Frontend/**/frontend/_public/src/js/*.js',
      '!../themes/Frontend/**/frontend/_public/src/js/vendors/*.js'
    ]
  }
};


/**
    Generate LESS Includes, extracted from config_SHOPID.json,
    and exclude Shopware Responsive Theme if CLI Flag "--excludeSWtheme"
    is given
*/
config['less'].forEach(function(item) {
  if (excludeSWtheme) {
    if (item === 'themes/Frontend/Responsive/frontend/_public/src/less/all.less') {
      item = '';
    }
  }
  if (item !== '') {
    content += '@import "../' + item + '";';
  }
  content += "\n";
});
fs.writeFileSync(path.lessSource, content);


/**
    Get all Shopware JS includes, that will be injected at the Bottom
*/
config['js'].forEach(function(item) {
  jsFiles.push('../' + item);
});


/**
    Fill Array with Shopware Theme Settings
*/
for (var key in config.config) {
  path.variables[key] = config.config[key];
}


/**
    LESS Development
*/
gulp.task('less:dev', function() {
  return gulp.src(path.lessSource)
    .pipe($.sourcemaps.init())
    .pipe($.less({
      modifyVars: path.variables,
      dumpLineNumbers: 'all',
      //
      // however it doen't work for me...
      relativeUrls: true
      //
    }))
    .on('error', $.notify.onError({
      message: 'Error: <%= error.message %>',
      title: 'LESS Error'
    }))
    .pipe($.sourcemaps.write('.', {
      sourceMappingURLPrefix: pathObject.dir
    }))
    .pipe(gulp.dest(path.build));
});


/**
    LESS Production
*/
gulp.task('less:dist', function() {
  return gulp.src(path.lessSource)
    .pipe($.less({
      modifyVars: path.variables,
      //
      // however it doen't work for me...
      relativeUrls: true
      //
    }))
    .on('error', $.notify.onError({
      message: 'Error: <%= error.message %>',
      title: 'LESS Error'
    }))
    .pipe($.autoprefixer({
      cascade: false
    }))
    .pipe($.cleanCss({
      debug: true
    }, function(details) {
      gutil.log("before Compress: ", details.name + ': ' + (details.stats.originalSize / 1000) + ' Kb');
      gutil.log("after  Compress: ", details.name + ': ' + (details.stats.minifiedSize / 1000) + ' Kb');
    }))
    .pipe(gulp.dest(path.build));
});


/**
    JS Development
*/
gulp.task('concat', function() {
  return gulp.src(jsFiles)
    .pipe($.concat(path.jsTarget))
    .pipe(gulp.dest(path.build));
});


/**
    JS Production
*/
gulp.task('uglify', function() {
  return gulp.src(jsFiles)
    .pipe($.concat(path.jsTarget))
    .pipe($.uglify({
      compress: {
        drop_console: true
      }
    }))
    .pipe(gulp.dest(path.build));
});


/**
    ESLINT
    Rules: http://eslint.org/docs/rules/
*/
gulp.task('eslint', function() {
  return gulp.src(path.watch.js)
    // eslint() attaches the lint output to the eslint property
    // of the file object so it can be used by other modules.
    .pipe($.eslint({
      rules: {
        'no-console': 0,
        'no-extra-semi': 0,
        'no-unused-vars': 1,
        'no-underscore-dangle': 0,
        'no-shadow-restricted-names': 1,
        'no-shadow': 1,
        'no-undef': 1,
        'no-sequences': 1,
        'strict': 1,
        'quotes': 0,
        'no-unused-expressions': 1
      },
      globals: {
        'Modernizr': true,
        'jQuery': true,
        '$': true,
        'StateManager': true
      },
      envs: [
        'browser'
      ]
    }))
    .pipe($.eslint.failAfterError())
    .on('error', $.notify.onError({
      message: '<%= error.message %>',
      title: 'Lint Error'
    }))
    // eslint.format() outputs the lint results to the console.
    // Alternatively use eslint.formatEach() (see Docs).
    .pipe($.eslint.format());
  // To have the process exit with an error code (1) on
  // lint error, return the stream and pipe to failOnError last.
  //.pipe($.eslint.failOnError());
});



gulp.task('watch', function() {
  gulp.watch(path.watch.less, ['less:dev']);
  gulp.watch(path.watch.js, ['concat']);
});

gulp.task('default', function(cb) {
  sequence(['less:dev', 'eslint', 'concat'], 'watch', cb);
});

gulp.task('dist', function(cb) {
  sequence(['less:dist', 'eslint', 'uglify'], cb);
});
