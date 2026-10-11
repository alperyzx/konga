'use strict';

var fs = require('fs')
var path = require('path')

module.exports.bootstrap = function bootstrap(next) {
    /**
     * It's very important to trigger this 'next' method when you are finished with the bootstrap!
     * (otherwise your server will never lift, since it's waiting on the bootstrap)
     */
    sails.services.passport.loadStrategies();


    // Create Konga data directories
    var storagePath = process.env.STORAGE_PATH || './kongadata/'
    var dirs = [storagePath, path.join(storagePath, 'uploads')]


    dirs.forEach(function(dir){
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
    })

    next();
};
