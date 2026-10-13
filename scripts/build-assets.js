#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const createWebpackConfig = require('../webpack.config');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const PUBLIC = path.join(ROOT, '.tmp/public');
const WWW = path.join(ROOT, 'www');
const mode = process.argv[2] === 'production' ? 'production' : 'development';

function copyable(source) {
  const relative = path.relative(ASSETS, source);
  if (!relative) return true;

  const parts = relative.split(path.sep);
  if (parts[0] === 'bower_components' || parts[0] === 'vendor') return false;
  if (relative === path.join('js', 'webpack-entry.js')) return false;
  if (relative.endsWith('.scss') || relative.endsWith('.less')) return false;
  if (parts[0] === 'js' && parts[1] === 'app' && relative.endsWith('.js')) return false;
  return true;
}

fs.rmSync(PUBLIC, {recursive: true, force: true});
fs.mkdirSync(PUBLIC, {recursive: true});
fs.cpSync(ASSETS, PUBLIC, {recursive: true, filter: copyable});

webpack(createWebpackConfig(mode), (error, stats) => {
  if (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
    return;
  }

  const output = stats.toString({colors: process.stdout.isTTY, preset: 'errors-warnings'});
  if (output) console.log(output);

  if (stats.hasErrors()) {
    process.exitCode = 1;
    return;
  }

  if (mode === 'development') {
    fs.rmSync(WWW, {recursive: true, force: true});
    fs.cpSync(PUBLIC, WWW, {recursive: true});
  }

  console.log(`Webpack ${mode} assets built in .tmp/public`);
});
