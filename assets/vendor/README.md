# Vendored browser dependencies

Konga's AngularJS interface still uses browser distributions that were
previously downloaded by Bower. Several exact versions were never published to
npm, so the proven files are committed here and bundled locally by Webpack.
This removes all installation-time access to the retired Bower registry.

The directory structure and load order are recorded in `webpack.config.js`.
License files from each upstream project are stored beside its browser files.
Versions match the former resolved Bower installation documented by the removed
`bower.json` file and are covered by browser hard-reload regression tests.
