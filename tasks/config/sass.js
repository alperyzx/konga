const sass = require('sass');

module.exports = function (grunt) {

  grunt.config.set('sass', {
    options: {
      implementation: sass,
      sourceMap: true,

      // Konga's theme is based on Bootstrap 3 / Bootswatch source. Dart Sass
      // reports their still-supported legacy syntax on every local startup,
      // even though this application pins Sass 1.x and the generated CSS is
      // stable. Keep real compiler warnings visible while silencing only the
      // four upstream deprecations that require a Bootstrap major migration.
      silenceDeprecations: [
        'import',
        'global-builtin',
        'color-functions',
        'slash-div'
      ]
    },
    dev: {
      files: [{
        expand: true,
        cwd: 'assets/styles/',
        src: ['importer.scss'],
        dest: '.tmp/public/styles/',
        ext: '.css'
      }]
    }
  });

  grunt.loadNpmTasks('grunt-sass');
};
