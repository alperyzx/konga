'use strict';

// Keep third-party styles in the same order as the former Bower/Grunt
// pipeline. JavaScript vendors are emitted as a separate global script by
// webpack.config.js so their legacy UMD wrappers run exactly as before.
require('../vendor/legacy/angular-loading-bar/build/loading-bar.css');
require('../vendor/legacy/angular-xeditable/dist/css/xeditable.css');
require('../vendor/legacy/angular-toastr/dist/angular-toastr.css');
require('../vendor/legacy/bootstrap-switch/dist/css/bootstrap3/bootstrap-switch.css');
require('../vendor/legacy/angular-spinkit/build/angular-spinkit.min.css');
require('../vendor/legacy/angular-chips/dist/main.css');
require('../vendor/legacy/angular-json-human/dist/angular-json-human.css');
require('../vendor/legacy/mdi/css/materialdesignicons.css');
require('../styles/importer.scss');
