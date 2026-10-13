## More than just another GUI to [KONG Admin API](http://getkong.org)    [![Build Status](https://travis-ci.org/pantsel/konga.svg?branch=master)](https://travis-ci.org/pantsel/konga)    [![Gitter chat](https://badges.gitter.im/pantsel-konga/Lobby.png)](https://gitter.im/pantsel-konga/Lobby)


[![Dashboard](screenshots/bc3.png)](https://raw.githubusercontent.com/pantsel/konga/master/screenshots/bc2.png)

_Konga is not an official app. No affiliation with [Kong](https://www.konghq.com/)._

## Summary

- [**Discussions & Support**](#discussions--support)
- [**Features**](#features)
- [**Snapshot backups**](#snapshot-backups)
- [**Compatibility**](#compatibility)
- [**Prerequisites**](#prerequisites)
- [**Used libraries**](#used-libraries)
- [**Installation**](#installation)
- [**Configuration**](#configuration)
- [**Environment variables**](#environment-variables)
- [**Running Konga**](#running-konga)
- [**Local development helper**](#local-development-helper)
- [**Testing**](#testing)
- [**Upgrading**](#upgrading)
- [**FAQ**](#faq)
- [**More Kong related stuff**](#more-kong-related-stuff)
- [**License**](#license)

## Discussions & Support
If you need to discuss anything Konga related, we have a chatroom on Gitter:

[![Gitter chat](https://badges.gitter.im/pantsel-konga/Lobby.png)](https://gitter.im/pantsel-konga/Lobby)

## Features
* Manage Kong 3.x services, routes, consumers, plugins, upstreams, certificates, CA certificates, keys, key sets, and vaults.
* Configure service TLS trust, route streaming buffers, advanced upstream hashing/health probes, alternate certificates, and tagged SNIs.
* Create and edit Key Sets, JWK/PEM Keys, and backend-specific Vault configuration from the Keys & Vaults area.
* Render plugin configuration from the schemas exposed by the connected Kong node.
* Edit `pre-function` and `post-function` Lua safely in multiline phase editors without wrapping, splitting, or trimming pasted source.
* Import Consumers from remote sources (Databases, files, APIs etc.).
* Manage multiple Kong Nodes.
* Backup, restore and migrate Kong Nodes using Snapshots.
* Monitor Node and API states using health checks.
* Email & Slack notifications.
* Multiple users and local authentication, with an [LDAP implementation guide](./docs/LDAP.md).
* Browse entity tags and inspect Kong capabilities, metrics, and runtime log level.
* Easy database integration (MySQL, postgresSQL, MongoDB).

## Snapshot backups

Snapshot format v2 backs up the Kong configuration exposed by the selected node's Admin API.
Each snapshot records which collections were included, which optional collections were unavailable,
and which data categories are intentionally excluded. Restores run in dependency order, preserve
entity IDs where Kong supports them, and report imported, skipped, and failed items separately.

Included by default when the source Kong exposes them:

* Services, routes, consumers, plugins, upstreams, and targets.
* CA certificates, key sets, and vault entities/configuration metadata.
* ACL and mTLS credentials.
* Consumer groups and memberships, and DeGraphQL routes.

The **Include sensitive data** option is disabled by default. Enabling it additionally includes:

* Certificates, their private keys, and SNIs.
* JWK/PEM key entities, including private key material.
* Key Auth, HMAC Auth, JWT, and restorable OAuth2 credentials.
* OAuth2 tokens and authorization codes.

Manual and scheduled snapshots both expose this option. Each schedule stores its own setting;
existing schedules default to excluding sensitive data.

Use **Export** to download a snapshot JSON file and **Import from file** to add that file to another
Konga installation's snapshot library. Importing does not immediately change Kong; review the
imported snapshot and explicitly choose the entities and destination node during restore. Konga
prefixes the imported name with a timestamp to avoid name conflicts. The same restore exclusions
for Basic Auth and OAuth2 `hash_secret=true` credentials also apply to imported legacy files.

Not included:

* Konga's own users, Kong connections, settings, and audit/application data. Back up Konga's
  configured datastore or `STORAGE_PATH` separately for those records.
* Kong runtime metrics, logs, health state, cache contents, or database internals.
* Secret values held in external vault backends. Vault references and Kong vault configuration are
  included, but the external secret store requires its own backup.
* Basic Auth credentials. Kong exposes only one-way password hashes; restoring an exported hash
  would hash it again and the original plaintext password would no longer authenticate. Recreate
  Basic Auth passwords manually after restore.
* OAuth2 credentials configured with `hash_secret=true`. Kong exposes only their one-way PBKDF2
  client-secret hashes, which would also be hashed again during restore. Recreate those OAuth2
  client secrets manually. OAuth2 credentials using the default `hash_secret=false` are included
  only when **Include sensitive data** is enabled.
* Enterprise or plugin-specific collections that the source node does not expose through a supported
  Admin API endpoint. These appear in the snapshot's unavailable list rather than failing the backup.

Plugin configurations and vault metadata may themselves contain sensitive references or values, so
all snapshots still require protection even when the sensitive-data option is disabled.

Snapshots are stored as records in Konga's configured database. With the bundled local datastore,
those records are under `STORAGE_PATH` (default `./kongadata/`); Docker deployments commonly persist
them in the `/app/kongadata` volume. Snapshot records and exported JSON can contain usable credential
secrets, OAuth tokens, certificate private keys, and private JWK/PEM material. Protect the Konga
database, local data directory, Docker volume, datastore backups, and exported snapshot files as
secrets. Snapshots created without the sensitive-data option omit the known credential, OAuth state,
certificate/private-key, and Kong key collections listed above.

## Compatibility
Konga `0.26.x` targets **Kong 3.x** and is currently validated against Kong `3.9.3`
with the traditional-compatible router. The browser and schema suites use a live Kong Admin API
at `http://localhost:8001` by default.

The upstream `0.14.x` release line targeted Kong 1.x. For older Kong versions, use the
[legacy branch](https://github.com/pantsel/konga/tree/legacy) or the `konga:legacy` image.

See the completed [Kong 3.9 parity plan](./docs/kong-parity-plan.html) for field-level coverage.

## Prerequisites
- A running [Kong installation](https://getkong.org/) 
- Node.js `20.19.0` or newer
- npm

## Used libraries
* Sails.js, http://sailsjs.org/
* AngularJS, https://angularjs.org/

## Installation

Install `npm` and `node.js`. Instructions can be found [here](http://sailsjs.org/#/getStarted?q=what-os-do-i-need).

Install the locked npm dependencies. Browser dependencies are vendored with their licenses and
compiled locally by Webpack, so installation does not contact the retired Bower registry.

```bash
$ git clone https://github.com/alperyzx/konga.git
$ cd konga
$ npm ci
```

## Configuration
You can configure your  application to use your environment specified
settings.

There is an example configuration file on the root folder.

```
.env_example
```

Just copy this to `.env` and make necessary changes to it. Note that this
`.env` file is in .gitignore so it won't go to VCS at any point.

## Environment variables
These are the general environment variables Konga uses.

| VAR                | DESCRIPTION                                                                                                                | VALUES                                 | DEFAULT                                      |
|--------------------|----------------------------------------------------------------------------------------------------------------------------|----------------------------------------|----------------------------------------------|
| HOST               | The IP address that will be bind by Konga's server                                                                               | -                                      | '0.0.0.0'                                         |
| PORT               | The port that will be used by Konga's server                                                                               | -                                      | 1337                                         |
| NODE_ENV           | The environment                                                                                                            | `production`,`development`             | `development`                                |
| SSL_KEY_PATH       | If you want to use SSL, this will be the absolute path to the .key file. Both `SSL_KEY_PATH` & `SSL_CRT_PATH` must be set. | -                                      | null                                         |
| SSL_CRT_PATH       | If you want to use SSL, this will be the absolute path to the .crt file. Both `SSL_KEY_PATH` & `SSL_CRT_PATH` must be set. | -                                      | null                                         |
| KONGA_HOOK_TIMEOUT | The time in ms that Konga will wait for startup tasks to finish before exiting the process.                                | -                                      | 60000                                        |
| KONGA_ALLOWED_ORIGINS | Comma-separated browser origins allowed to open production WebSocket connections. Include Konga's public origin.       | `<origin>[,<origin>...]`                | `http://localhost:PORT,http://127.0.0.1:PORT` |
| KONGA_CA_FILE      | CA bundle used by `run.sh` for npm/Node TLS on hosts behind a private certificate authority or inspection proxy.                         | `<path-to-pem>`                         | -                                            |
| DB_ADAPTER         | The database that Konga will use. If not set, the localDisk db will be used.              | `mongo`,`mysql`,`postgres`     | -                                            |
| DB_URI             | The full db connection string. Depends on `DB_ADAPTER`. If this is set, no other DB related var is needed.                 | -                                      | -                                            |
| DB_HOST            | If `DB_URI` is not specified, this is the database host. Depends on `DB_ADAPTER`.                                          | -                                      | localhost                                    |
| DB_PORT            | If `DB_URI` is not specified, this is the database port.  Depends on `DB_ADAPTER`.                                         | -                                      | DB default.                                  |
| DB_USER            | If `DB_URI` is not specified, this is the database user. Depends on `DB_ADAPTER`.                                          | -                                      | -                                            |
| DB_PASSWORD        | If `DB_URI` is not specified, this is the database user's password. Depends on `DB_ADAPTER`.                               | -                                      | -                                            |
| DB_DATABASE        | If `DB_URI` is not specified, this is the name of Konga's db.  Depends on `DB_ADAPTER`.                                    | -                                      | `konga_database`                             |
| DB_PG_SCHEMA       | If using postgres as a database, this is the schema that will be used.                                                     | -                                      | `public`                                     |
| KONGA_LOG_LEVEL    | The logging level                                                                                                          | `silly`,`debug`,`info`,`warn`,`error`  | `debug` on dev environment & `warn` on prod. |
| TOKEN_SECRET       | The secret that will be used to sign JWT tokens issued by Konga | - | - |
| NO_AUTH            | Run Konga without Authentication                                                                                           | true/false                             | -                                         |
| BASE_URL           | Define a base URL or relative path that Konga will be loaded from. Ex: www.example.com/konga                               | <string>                                     | -                                         |
| STORAGE_PATH       | Directory used by the bundled local datastore and uploaded files.                                                         | <path>                                       | `./kongadata/`                            |
| KONGA_SEED_USER_DATA_SOURCE_FILE           | Seed default users on first run. [Docs](./docs/SEED_DEFAULT_DATA.md).                               | <string>                                     | -                                         |
| KONGA_SEED_KONG_NODE_DATA_SOURCE_FILE      | Seed default Kong Admin API connections on first run [Docs](./docs/SEED_DEFAULT_DATA.md)                               | <string>                                     | -                                         |


### Databases Integration

Konga is bundled with its own persistence mechanism for storing users and configuration.

A local persistent object store under `STORAGE_PATH` is used by default. It works well as a
bundled starter database, with the strict caveat that it is for non-production use only.

The application also supports some of the most popular databases out of the box:

1. MySQL
2. MongoDB
3. PostgreSQL

In order to use them, set the appropriate env vars in your `.env` file.
 

## Running Konga

### Development
```
$ npm start
```
Konga GUI will be available at `http://localhost:1337`

### Local development helper

This fork includes [`run.sh`](run.sh) for running Konga directly on
the host. It checks the supported Node.js version, installs locked npm dependencies when needed,
and starts Konga on port `1337`.

```bash
./run.sh                 # install missing dependencies, then start Konga
./run.sh --install       # cleanly reinstall package-lock.json dependencies first
./run.sh --production    # start with NODE_ENV=production
./run.sh --prepare postgres postgresql://user:pass@localhost:5432/konga
```

Konga is available at `http://localhost:1337`. The Kong Admin API connection is configured
inside Konga; the development setup used for parity testing is Kong at `localhost:8001` and
the Kong Manager at `localhost:8002`.

Application startup and Webpack asset builds are expected to complete without framework or Sass
warnings. Sass notices suppressed by the build are limited to deprecated constructs in the bundled
Bootstrap 3 and Bootswatch sources; application Sass warnings remain visible. npm can still report
deprecation notices for legacy runtime packages, which are distinct from audit vulnerabilities.

On a host that uses a private CA or TLS inspection proxy, provide the trusted PEM bundle without
disabling certificate validation:

```bash
KONGA_CA_FILE=/etc/pki/ca-trust/source/anchors/company-ca.pem ./run.sh --production
```

### Production

*****************************************************************************************
Production mode uses Waterline's `migrate: safe` setting and will not alter an existing database
schema. For MySQL or PostgreSQL, the `prepare` command loads Konga in development migration mode
and lets Waterline synchronize the schema. Back up the database and verify the operation against a
clone before running it on production data.

For example:

```
$ node ./bin/konga.js  prepare --adapter postgres --uri postgresql://localhost:5432/konga
```
The process exits after Waterline finishes its schema synchronization.

*****************************************************************************************

Finally:
```
$ npm run production
```
Konga GUI will be available at `http://localhost:1337`


### Production Docker Image

The following instructions assume that you have a running Kong instance following the
instructions from [Kong's docker hub](https://hub.docker.com/_/kong/)

Build the local runtime image, or build the test target to run the backend and static
parity suites inside Docker:

```bash
docker build -t konga:0.26.10 .
docker build --target test -t konga:0.26.10-test .
```

The runtime image runs as the non-root `konga` user. Persist `/app/kongadata` when using
the bundled local datastore, and set `KONGA_ALLOWED_ORIGINS` to Konga's public browser
origin in production.

```bash
docker run -p 1337:1337 \
  --network {{kong-network}} \
  --name konga \
  -e NODE_ENV=production \
  -e TOKEN_SECRET={{somerandomstring}} \
  -e KONGA_ALLOWED_ORIGINS=http://localhost:1337 \
  -v konga-data:/app/kongadata \
  konga:0.26.10
```

Omit `--network` when it is not needed. From a Docker Desktop container, use
`http://host.docker.internal:8001` to connect Konga to a Kong Admin API exposed
on the host; when both containers share a network, use Kong's container name.

#### To use one of the supported databases

1. ##### Prepare the database
> **Note**: You can skip this step if using the `mongo` adapter.

You can prepare the database using an ephemeral container that runs the prepare command.

**Args**

argument  | description | default
----------|-------------|--------
-c      | command | -
-a      | adapter (can be `postgres` or `mysql`) | -
-u     | full database connection url | -

```
$ docker run --rm pantsel/konga:latest -c prepare -a {{adapter}} -u {{connection-uri}}
```


2. ##### Start Konga
```
$ docker run -p 1337:1337 
             --network {{kong-network}} \ // optional
             -e "TOKEN_SECRET={{somerandomstring}}" \
             -e "DB_ADAPTER=the-name-of-the-adapter" \ // 'mongo', 'postgres' or 'mysql'
             -e "DB_HOST=your-db-hostname" \
             -e "DB_PORT=your-db-port" \ // Defaults to the default db port
             -e "DB_USER=your-db-user" \ // Omit if not relevant
             -e "DB_PASSWORD=your-db-password" \ // Omit if not relevant
             -e "DB_DATABASE=your-db-name" \ // Defaults to 'konga_database'
             -e "DB_PG_SCHEMA=my-schema"\ // Optionally define a schema when integrating with prostgres
             -e "NODE_ENV=production" \ // or 'development' | defaults to 'development'
             --name konga \
             pantsel/konga
             
             
 // Alternatively you can use the full connection string to connect to a database
 $ docker run -p 1337:1337 
              --network {{kong-network}} \ // optional
              -e "TOKEN_SECRET={{somerandomstring}}" \
              -e "DB_ADAPTER=the-name-of-the-adapter" \ // 'mongo', 'postgres' or 'mysql'
              -e "DB_URI=full-connection-uri" \
              -e "NODE_ENV=production" \ // or 'development' | defaults to 'development'
              --name konga \
              pantsel/konga
```


The GUI will be available at `http://{your server's public ip}:1337`


[It is possible to seed default users on first install.](./docs/SEED_DEFAULT_DATA.md)

You may also configure Konga to authenticate via [LDAP](./docs/LDAP.md).


## Testing

Backend tests use an isolated in-memory datastore, so running the suite cannot remove or alter
local Konga users, connections, or settings.

```bash
npm test                 # backend, authentication, CRUD, and registered endpoint coverage
npm audit                # dependency vulnerability report
npm run build            # development asset build
npm run build:prod       # production asset build
cd test/e2e
npm run test:static      # offline Angular/Kong schema regression suite
```

The backend suite discovers every route registered by Sails and checks that it does not produce
an uncaught server error. It also exercises sorted collections and filtered count requests for
every model-backed API—the request shape used by list pages such as Users, Connections, and
Snapshots.

The static suite also guards the local startup configuration against retired Sails policy targets,
deprecated response helpers, ambiguous wildcard routes, Bower regressions, and accidental rewrites
of the tracked server layout during asset builds.

For live Kong schema and browser tests, see the [browser test guide](./test/e2e/README.md).
The UI suite requires Konga, Kong, an installed Chrome-family browser, and `KONGA_PASSWORD`.


## Upgrading

Kong configuration is stored by Kong and is not dependent on Konga's datastore. Konga's own users,
password records, connections, settings, and saved snapshots are stored in the configured Konga
datastore and need separate upgrade planning.

Do not point development mode or `prepare` at the only copy of a production datastore. Waterline's
development migration mode uses automatic `alter` operations; it is not a versioned migration and
can change data or schema unexpectedly across the Sails 0.12 to Sails 1 adapter upgrade.

- **Bundled local datastore:** Konga 0.14 used `sails-disk` 0.10 and a single
  `kongadata/konga.db` file. Konga 0.26.10 uses `sails-disk` 2 and separate per-model files. Copying
  the old file into the new installation is not a supported migration. Use a fresh Konga datastore
  and recreate Konga users, connections, and settings.
- **MySQL or PostgreSQL:** Back up the database, restore it to a disposable clone, run
  `./run.sh --prepare <adapter> <clone-uri>`, and verify users, login, connections, settings, and
  snapshots. Only repeat the operation against production after that validation succeeds.
- **MongoDB:** It does not require relational schema preparation, but the major Sails/adapter upgrade
  should still be tested against a cloned database before production use.

For a Docker-based MySQL or PostgreSQL preparation run:

```bash
docker run --rm pantsel/konga:latest -c prepare -a {{adapter}} -u {{connection-uri}}
```

## FAQ

##### 1. Getting blank page with `Uncaught ReferenceError: angular is not defined`

Reinstall the locked dependencies and rebuild the Webpack assets:

```bash
npm ci
npm run build:prod
```

##### 2. Can't add/edit some plugin properties.
When a plugin property is an array, the input is handled by a chip component.
You will need to press `enter` after every value you type in
so that the component assigns it to an array index.
The `pre-function` and `post-function` plugins are an exception: each phase uses a repeatable
multiline Lua editor. Use **add script** under the required phase (for example, **access**) and
paste the complete Lua source into that editor. Each editor is submitted unchanged as one array
entry; use another editor only when Kong should execute an additional script in that phase.
See issue [#48](https://github.com/pantsel/konga/issues/48) for reference.

##### 3. EACCES permission denied, mkdir '/kongadata/'.
If you see this error while trying to run Konga, it means that Konga has no write permissions to
its data directory. Set `STORAGE_PATH` to a directory that Konga can write to.

##### 4. npm reports `UNABLE_TO_VERIFY_LEAF_SIGNATURE`

Configure the root/intermediate CA used by your organization and pass its PEM bundle through
`KONGA_CA_FILE`. Do not disable `strict-ssl` or set `NODE_TLS_REJECT_UNAUTHORIZED=0`.


## More Kong related stuff
- [**Kong Admin proxy**](https://github.com/pantsel/kong-admin-proxy)
- [**Kong Middleman plugin**](https://github.com/pantsel/kong-middleman-plugin)

## Author

Panagis Tselentis

## License
```
The MIT License (MIT)
=====================

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
