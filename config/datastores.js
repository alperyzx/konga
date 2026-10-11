'use strict';

var datastoreDefinitions = {
  localDiskDb: {
    adapter: 'sails-disk',
    filePath: process.env.NODE_ENV === 'test' ? './.tmp/' : (process.env.STORAGE_PATH || './kongadata/'),
    fileName: process.env.NODE_ENV === 'test' ? 'localDiskDb.db' : 'konga.db'
  },

  mysql: {
    adapter: 'sails-mysql',
    url: process.env.DB_URI || undefined,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_DATABASE || 'konga_database'
  },

  mongo: {
    adapter: 'sails-mongo',
    url: process.env.DB_URI || undefined,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 27017,
    user: process.env.DB_USER || undefined,
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_DATABASE || 'konga_database'
  },

  postgres: {
    adapter: 'sails-postgresql',
    url: process.env.DB_URI || undefined,
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'admin1!',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_DATABASE || 'konga_database',
    poolSize: process.env.DB_POOLSIZE || 10,
    ssl: Boolean(process.env.DB_SSL)
  },

  sqlserver: {
    adapter: 'sails-sqlserver',
    url: process.env.DB_URI || undefined,
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || undefined,
    password: process.env.DB_PASSWORD || undefined,
    port: process.env.DB_PORT || 49150,
    database: process.env.DB_DATABASE || 'konga_database'
  }
};

var selectedDatastore = process.env.DB_ADAPTER || 'localDiskDb';

if (!datastoreDefinitions[selectedDatastore]) {
  throw new Error('Unsupported DB_ADAPTER: ' + selectedDatastore);
}

module.exports.datastores = {};
module.exports.datastores[selectedDatastore] = datastoreDefinitions[selectedDatastore];
