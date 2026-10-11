/**
 * Created by user on 24/05/2017.
 */

var path = require('path');
var storagePath = process.env.STORAGE_PATH || './kongadata/';

module.exports.paths = {
    "uploads" : path.join(storagePath, 'uploads') + path.sep
};
