'use strict';

const fs = require('fs');
const path = require('path');
const terser = require('terser');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const ROOT = __dirname;
const LEGACY_ROOT = path.join(ROOT, 'assets/vendor/legacy');

// These browser distributions intentionally remain in their proven global
// load order. They are vendored because several exact Bower versions were
// never published to npm, and fetching them at install time made production
// builds depend on the retired Bower registry.
const legacyVendorScripts = [
  'jquery/dist/jquery.js',
  'angular/angular.js',
  'angular-animate/angular-animate.js',
  'angular-loading-bar/build/loading-bar.js',
  'angular-ui-router/release/angular-ui-router.js',
  'angular-ui-utils/ui-utils.js',
  'moment/moment.js',
  'later/later.js',
  'prettycron/prettycron.js',
  'angular-bootstrap-show-errors/src/showErrors.js',
  'angular-sanitize/angular-sanitize.js',
  'angular-xeditable/dist/js/xeditable.js',
  'angular-toastr/dist/angular-toastr.tpls.js',
  'bootstrap/dist/js/bootstrap.js',
  'angularSails/dist/ngsails.io.js',
  'ngstorage/ngStorage.js',
  'angular-bootstrap/ui-bootstrap-tpls.js',
  'lodash/lodash.js',
  'bootstrap-switch/dist/js/bootstrap-switch.js',
  'angular-spinkit/build/angular-spinkit.js',
  'angular-chips/dist/angular-chips.js',
  'ng-file-upload/ng-file-upload.js',
  'angular-messages/angular-messages.js',
  'angular-utils-pagination/dirPagination.js',
  'chart.js/dist/Chart.js',
  'angular-resource/angular-resource.js',
  'angular-moment/angular-moment.js',
  'bootbox/bootbox.js',
  'ngBootbox/dist/ngBootbox.js',
  'angular-json-human/dist/angular-json-human.js',
  'angular-bootstrap-switch/dist/angular-bootstrap-switch.js',
  'angular-chart.js/dist/angular-chart.js',
  'angular-base64/angular-base64.js'
];

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes: true})
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) return listJavaScriptFiles(filename);
      return entry.isFile() && entry.name.endsWith('.js') ? [filename] : [];
    });
}

class RawScriptBundlePlugin {
  constructor(output, files, production) {
    this.output = output;
    this.files = files;
    this.production = production;
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap('RawScriptBundlePlugin', (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: `RawScriptBundlePlugin:${this.output}`,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS
        },
        async () => {
          let source = this.files.map((filename) => {
            const relativePath = path.relative(ROOT, filename);
            const contents = fs.readFileSync(filename, 'utf8')
              .replace(/^\s*\/\/[#@]\s*sourceMappingURL=.*$/gm, '');
            return `\n/* ${relativePath} */\n${contents}\n;`;
          }).join('\n');

          if (this.production) {
            const result = await terser.minify(source, {
              // Several legacy AngularJS modules use implicit DI. Match the
              // former Uglify configuration: remove whitespace/comments but
              // never rename parameters or rewrite expressions.
              compress: false,
              mangle: false,
              format: {comments: false}
            });
            if (!result.code) throw new Error('Terser produced an empty vendor bundle');
            source = result.code;
          }

          compilation.emitAsset(
            this.output,
            new compiler.webpack.sources.RawSource(source)
          );
        }
      );
    });
  }
}

class RemoveStyleRuntimePlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('RemoveStyleRuntimePlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'RemoveStyleRuntimePlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE
        },
        () => compilation.deleteAsset('min/styles.js')
      );
    });
  }
}

module.exports = function createWebpackConfig(mode) {
  const production = mode === 'production';

  return {
    mode,
    context: ROOT,
    entry: path.join(ROOT, 'assets/js/webpack-entry.js'),
    output: {
      path: path.join(ROOT, '.tmp/public'),
      filename: 'min/styles.js',
      assetModuleFilename: 'fonts/[name][ext]'
    },
    devtool: production ? false : 'source-map',
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [MiniCssExtractPlugin.loader, 'css-loader']
        },
        {
          test: /\.scss$/i,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            {
              loader: 'sass-loader',
              options: {
                sassOptions: {
                  silenceDeprecations: [
                    'import',
                    'global-builtin',
                    'color-functions',
                    'slash-div'
                  ]
                }
              }
            }
          ]
        },
        {
          test: /\.(eot|svg|ttf|woff2?)$/i,
          type: 'asset/resource'
        }
      ]
    },
    optimization: {
      // RawScriptBundlePlugin performs the only permitted JavaScript
      // minification pass. Webpack's default optimizer would mangle implicit
      // AngularJS dependency names after custom assets are emitted.
      minimize: false
    },
    plugins: [
      new MiniCssExtractPlugin({filename: 'min/production.min.css'}),
      new RawScriptBundlePlugin(
        'min/vendor.min.js',
        legacyVendorScripts.map((relativePath) => path.join(LEGACY_ROOT, relativePath)),
        production
      ),
      new RawScriptBundlePlugin(
        'min/application.min.js',
        listJavaScriptFiles(path.join(ROOT, 'assets/js/app')),
        production
      ),
      new RemoveStyleRuntimePlugin()
    ],
    performance: {hints: false},
    stats: 'errors-warnings'
  };
};
