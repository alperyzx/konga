# Change Log

All notable changes to this project will be documented in this file.

## [Unreleased]
* Replaced Bower and the Grunt asset pipeline with a reproducible Webpack 5 build.
* Vendored the exact proven AngularJS browser distributions and upstream license files, eliminating installation-time access to the retired Bower registry.
* Added `KONGA_CA_FILE` support for secure npm/Node installation behind private certificate authorities and TLS inspection proxies.
* Updated vendored jQuery, AngularJS, Bootstrap, UI-Router, and Moment distributions to their final security-maintained compatible releases.
* Removed the duplicate Bootswatch copy of Bootstrap JavaScript and hardened AngularSails cookie-key escaping.

## [0.26.10]
* Migrated the runtime to Sails 1 and Node.js 20.19+, including Passport 0.7 and Waterline compatibility fixes.
* Added model timestamps and corrected filtered count parsing, fixing error toasts on Users, Connections, Snapshots, and other sorted list pages.
* Fixed Kong connection creation and user-node association handling for Sails 1 response shapes.
* Added Kong 3.x upstream fields, including load-balancing algorithm, host header, SRV-name support, health thresholds, and target tags.
* Completed Kong Manager field parity for service TLS trust, route buffering, advanced upstream hashing and probe headers.
* Added alternate certificate pairs and standalone tagged SNI management.
* Completed create/edit workflows for Key Sets, Keys, and Vaults, including key names, JWK handling, key-set references, and Env vault configuration.
* Consolidated parity navigation under Certificates and Keys & Vaults to keep the sidebar usable.
* Added schema-driven entity support and Kong 3.x plugin schema coverage.
* Replaced the chip controls for `pre-function` and `post-function` phases with repeatable multiline Lua editors, preserving pasted source code and trailing newlines exactly in Kong's script arrays.
* Added CA Certificates, Key Sets, Keys, and Vaults management.
* Added Tag Browser, deployment capability visibility, runtime log-level control, and Prometheus metrics viewing.
* Fixed route chip conversion for headers, IPv4/IPv6 sources, destinations, malformed input, and round-trip editing.
* Fixed the Route list Strip Path and Preserve Host quick actions to persist partial updates through Kong's PATCH API.
* Added Service enable/disable controls to the Services list and create/edit forms.
* Added a native legacy-environment launcher and LDAP implementation documentation.
* Replaced partial snapshots with format-v2 Kong configuration backups covering services/routes, consumers and restorable credentials, plugins, upstreams/targets, certificates/SNIs/CAs, keys/key sets, vault metadata, OAuth state, consumer groups, and optional Admin API entities.
* Added dependency-ordered, legacy-compatible restores with preserved IDs, idempotent targets and consumer-group memberships, detailed imported/skipped/failed results, and explicit included/unavailable/excluded manifests.
* Excluded Basic Auth credentials from backup and restore because Kong exposes only one-way password hashes that cannot recreate working passwords.
* Excluded OAuth2 credentials configured with `hash_secret=true` because Kong exposes only one-way PBKDF2 client-secret hashes; normal OAuth2 credentials remain restorable.
* Fixed certificate restore to apply embedded SNI data only through the dedicated SNI collection, preventing duplicate-name conflicts.
* Added a default-off **Include sensitive data** snapshot option for credentials, OAuth state, certificates/private keys, and Kong key entities while keeping one-way hashes permanently excluded.
* Added the same persisted sensitive-data option and one-way-hash warning to scheduled snapshots.
* Widened and reorganized the instant snapshot dialog with clearer node, content, security, and action sections.
* Fixed snapshot JSON import to open the native file chooser reliably and added format validation and success/error feedback.
* Documented that snapshot records are stored in Konga's database and that local data directories, Docker volumes, datastore backups, and exported files can contain usable secrets.
* Fixed the Upstreams, Certificates, and Keys & Vaults sidebar entries being hidden when an active Gateway was loaded but the cached user node was stale.
* Fixed a refresh race that could leave the Dashboard empty while active Gateway information was still loading.
* Modernized the asset build and test tooling while retaining the AngularJS interface.
* Replaced the vulnerable Git-based HTTP client with a native Fetch/FormData implementation and upgraded audited runtime dependencies.
* Added local compatibility packages for abandoned transitive dependencies and removed obsolete Grunt watcher, `ip`, `unirest`, and SQL Server support.
* Reached `0` known vulnerabilities in `npm audit`.
* Resolved CodeQL findings for HMAC secret generation, query parsing, polynomial-time trimming, and OpenSSL command construction.
* Made self-signed certificate generation concurrency-safe and included OpenSSL and local compatibility packages in clean Docker builds.
* Added runtime coverage for every registered HTTP endpoint, authenticated list/count coverage for every model-backed API, and HTTP-client unit tests.
* Isolated backend tests in an in-memory datastore so test runs never erase local users or Kong connections.
* Corrected local datastore configuration to persist records under `STORAGE_PATH` (default `./kongadata/`).
* Added valid standalone 404/500 pages and expanded hard-reload Playwright verification against Kong 3.9.3.
* Reworked the Docker image into test/build/runtime stages, added non-root execution, excluded local data from the build context, and restored production WebSocket, onboarding, and storage-path compatibility.
* Removed local startup and asset-build deprecation warnings by modernizing custom JSON responses and wildcard routes, pruning retired policy targets and redundant Bower resolution data, and isolating legacy Bootstrap Sass notices.
* Prevented development and production asset builds from rewriting tracked server-rendered views, and added regression coverage for warning-free startup configuration.

### Breaking changes
* Node.js versions older than `20.19.0` are no longer supported.
* The SQL Server datastore adapter has been removed; supported external adapters are MongoDB, MySQL, and PostgreSQL.

## [0.14.9](https://github.com/pantsel/konga/releases/tag/0.14.9)
* Fix security issue that allowed a user to escalate to admin status. (Kudos to [j3ssie](https://github.com/j3ssie)).
* Fix XSS vulnerabity on alerts and notifications. (Kudos to [j3ssie](https://github.com/j3ssie)).
* Fix issues #555, #562. Initial registration allows multiple admin users to be created
* Implemented missing `headers`, `snis`, `sources`, `destingations` and `path_handling` fields on routes.
* Implemented missing `client_certificate` field on services.
* Added the ability to seed initial user and node data via configmaps and mounts PR: #522
* Added Basic Auth credentials support on Connections PR: #393
* Implemented ACME plugin configuration
* Updated project dependencies
* Fix some typos PRs: #551, #546

## [0.14.7](https://github.com/pantsel/konga/releases/tag/0.14.7)
* Fixed `NO_AUTH` onboarding problems related to #474 when using a database.

## [0.14.6](https://github.com/pantsel/konga/releases/tag/0.14.6)
* Fixed `NO_AUTH` onboarding problems related to #474.
* Minor improvements.

## [0.14.5](https://github.com/pantsel/konga/releases/tag/0.14.5)
* Fix issue #473 concerning password length validation on first user registration.

## [0.14.4](https://github.com/pantsel/konga/releases/tag/0.14.4)
* Added support for `TAGS` in all major Kong Entities (Starting from Kong `1.1.0-rc1`).
* Konga can now be used without authentication. In order to do that,
  simply set the env var `NO_AUTH=true`.
* You can now seed default Users and Kong Connections on first install.
  Check out the [docs](./docs/SEED_DEFAULT_DATA.md).
* The new env var `BASE_URL`, allows you to run Konga behind a reverse proxy on a relative path.
  For example, if you configure your proxy to route requests to `example.com/konga`
  you will need to set `BASE_URL=/konga/`
* Fix compatibility with new `response-ratelimiting` plugin schema. Ref issue #363.
* Add ENV HOST support for sails `host` to bind host by IP address. Ref pull req #451. Big ups to [narate](https://github.com/narate)!
* Updated Dockerfile node.js version to 10.16
* Various minor fixes and improvements
   

## [0.14.1](https://github.com/pantsel/konga/releases/tag/0.14.1) - 27-01-2019
> Starting from version 0.14.0, Konga won't be compatible with Kong versions
  prior to 1.0.0 due to the breaking changes on Kong's API and plugin schemas.
  
* **[Compatibility]** Kong 1.0.0 compatibility. 
* **[Deprecation]** APIs and related implementations are deprecated.
* **[Fix]** Missing fields are included on the upstream form.
* **[Fix]** The bundled Kong plugins are no longer needed in order
features like `Accessible Consumer Routes` and `Snapshots` to work properly.
* **[Enhancement]** You can now set up alert triggers and dispatch notifications when upstream targets are not healthy.

## [0.13.0](https://github.com/pantsel/konga/releases/tag/0.13.0) - 29-09-2018
* Better onboarding experience on first install.
* User accounts are not auto-generated by default. You need to manually register the admin account 
on first run.
* The default Kong connection (http://kong:8001) is not auto-generated on first install.
* Login and Sign up pages got a clean redesign.
* Fix minor issues

## [0.12.3](https://github.com/pantsel/konga/releases/tag/0.12.3) - 26-09-2018
* **[Fix]** Solved some routing issues when running Konga behind a reverse proxy at a sub-path. [#278](https://github.com/pantsel/konga/issues/278)
* **[Fix]** Fix Glitch that prevented editing services or routes on first login. [#281](https://github.com/pantsel/konga/issues/281)
* Other minor issues

## [0.12.2](https://github.com/pantsel/konga/releases/tag/0.12.2) - 22-08-2018
* **[Fix]** Fix wrong require path on db prepare.
* Other minor issues

## [0.12.1](https://github.com/pantsel/konga/releases/tag/0.12.1) - 28-07-2018
* **[Deprecation]** Deprecated consumer imports. This feature was not adopted and provided unnecessary
complexity to maintenance as well as increased the overall project's size.
* **[Fix]** Fixed the trailing slash issue. Konga is now able to communicate with
Kong even if a trailing slash exists in the connection url.
* Cleaned up unused dependencies.
* When installing Konga from source, the `confing/local.js` file is deprecated
in favor of a `.env` file. Check the README.md for details.

## [0.12.0](https://github.com/pantsel/konga/releases/tag/0.12.0) - 07-07-2018
* **[Fix]** Fix snapshots implementation. Use auto generated entity ids for proper relationships mapping.
* **[Compatibility]** Implement new Kong plugins properly.
* **[Compatibility]** Only handle plugins available on server. Starting with Kong 0.14, the list of available plugins
can be defined in KONG_PLUGINS env var.
* **[Enhancement]** Implemented Accessible Services and Routes logic on Consumer page.
* **[Enhancement]** Implemented Eligible consumers listing based on ACLs and Authentication plugins in Services & Routes
* **[Compatibility]** Changed certificates and snis logic for compatibility with Kong 0.14
* **[Fix]** Changed the db prepare command
* Updated dependencies.
* Various other fixes and improvements.

## [0.11.2](https://github.com/pantsel/konga/releases/tag/0.11.2) - 15-06-2018
* Various Fixes.

## [0.11.0](https://github.com/pantsel/konga/releases/tag/0.11.0) - 08-06-2018
* **[Compatibility]** Services and Routes support (Kong 0.13+).
* **[Fix [#217](https://github.com/pantsel/konga/issues/217)]** Api health checks are now deleted as they should when deleting an api.
* **[Enhancement]** Added the ability to set description and tags to Kong's services
for better management.
* **[Enhancement]** In plugin management forms, all text inputs are changed to textareas
so that custom plugins can be better integrated [#189](https://github.com/pantsel/konga/issues/189).
* **[Enhancement]** Database integrations can now be setup by only using the connection url as well as
defining connection attributes separately.
* Various other fixes and improvements.

> **This update introduces changes in db schema. If you have integrated Konga with a database other 
than mongoDB, you will have to apply the migrations as described in README.md**

## [0.10.4](https://github.com/pantsel/konga/releases/tag/0.10.4) - 08-03-2018

* Better assets caching

## [0.10.3](https://github.com/pantsel/konga/releases/tag/0.10.3) - 07-03-2018

* Added passive health checks configuration in upstreams

## [0.10.2](https://github.com/pantsel/konga/releases/tag/0.10.2) - 03-03-2018

* **[Fix [#178](https://github.com/pantsel/konga/issues/178)]** Fix issue that produced hook timeouts.
* **[Fix [#175](https://github.com/pantsel/konga/issues/175)]** Health checks are now removed when an API is deleted.
* **[Fix]** Fix GET targets AND Add possibility to select Hash_on for Upstreams for Kong 0.12.x.
* **[Fix]** Fix SSL connection to Postgres.
* **[Fix]** Fix api timeouts to match Kong defaults.
* **[Fix [#146](https://github.com/pantsel/konga/issues/146)]** Update active Connection's version automatically when Kong version changes.
* **[Fix [#131](https://github.com/pantsel/konga/issues/131)]** Statsd plugin management is working as expected again for
versions of Kong >= 0.11.x. As a result, Kong versions < 0.11.x are not supported.
* **[Enhancement]** Feature to change Konga default users [#168](https://github.com/pantsel/konga/issues/168).
[See details](https://github.com/pantsel/konga/blob/master/DEFAULTUSERSEEDDATA.md)
* **[0.12.x compat]** Show Upstream health for node when Kong >=0.12.2
* Various other minor bug fixes and improvements.



## [0.9.1](https://github.com/pantsel/konga/releases/tag/0.9.1) - 06-12-2017

* **[Fix]** Fix certificate uploads.
* **[Enhancement]** Reveal all of oauth credential info in consumer credentials list.
* **[Fix]** Address connection ui issues.
* **[Fix]** Fix user signup.
* **[Enhancement]** [Add environment variables for socket adapter configuration to allow easy socket configuration in docker.](Add environment variables for socket adapter configuration to allow easy socket configuration in docker.)


## [0.9.0](https://github.com/pantsel/konga/releases/tag/0.9.0) - 23-10-2017

> A database update is required! Make sure you run Konga in dev mode once so that
the migrations will take place.

* **[Enhancement]** Only admin users can access snapshots.
* **[Enhancement]** You don't have to manually specify Kong version when creating a connection anymore. It is now retrieved automatically throughout the application.
* **[Enhancement]** You can now schedule your Kong node snapshots and leave Konga to do the rest. 
* **[Enhancement]** Introducing connection types (**Breaking change**). 
* **[Enhancement]** Added support for `JWT Auth Loopback API`. 
* **[Fix]** Fixed some issues with snapshots and snapshot restoration.
* **[Fix]** Consumer imports are working again.
* **[Fix]** Fixed database info display on dashboard page when using Cassandra.


#### Breaking Changes
Due to the new **Connection types** logic, the existing connections to Kong admin
API are likely to stop working. You will need to create new ones using the new forms.
No data or settings will be lost.

## [0.8.9](https://github.com/pantsel/konga/releases/tag/0.8.9) - 8-10-2017
* Allow certificates deletion.
* Manage SNIs from certificates detail modal.

## [0.8.8](https://github.com/pantsel/konga/releases/tag/0.8.8) - 8-10-2017

* When starting the app for the first time using postgres or MySQL adapters, Konga will now create the databases automatically.
* Parts of UI are redesigned in a cleaner way.
* Consumer page now also displays the APIs a consumer can access based on his ACLs.
* Slack integration. You can now configure Konga to send notifications to slack.
* Fix issue which prevented consumer creation with empty `username` or `custom_id`.
* Other minor bug fixes and improvements.

## [0.8.0](https://github.com/pantsel/konga/releases/tag/v0.8.0) - 23-5-2017

* UI/UX revamp.
* Massive refactoring and logic improvements.
* Configurable user permissions.
* Various bug fixes and improvements.

## [0.8.7](https://github.com/pantsel/konga/releases/tag/0.8.7) - 29-9-2017

* [FIX] Tests are working again.
* [FIX] Better error handling when adding groups and credentials to consumers.
* [FIX] <code>kongadata</code> dir is now created inside the project folder by default. The docker volume now becomes <code>/app/kongadata</code>

## [0.8.6](https://github.com/pantsel/konga/releases/tag/v0.8.6) - 24-9-2017

## [0.8.5](https://github.com/pantsel/konga/releases/tag/v0.8.5) - 23-9-2017

* Fix docker automated builds failure.
* Removed kong admin url from connections chooser.
* Sails js hookTimeout is now configurable via env var <code>KONGA_HOOK_TIMEOUT</code>.

## [0.8.4](https://github.com/pantsel/konga/releases/tag/v0.8.4) - 19-9-2017

* Fix bug where a new user could not be created when users where not allowed to sign up.
* Hide API keys in connections when logged in as a simple user.

## [0.8.3](https://github.com/pantsel/konga/releases/tag/v0.8.2) - 20-8-2017

* Kong 0.11.x compatibility.
* Added the ability to manage consumer plugins directly from the consumer edit page.
* More dynamic backwards compatibility logic.
* Other minor fixes and improvements.


## [0.8.1](https://github.com/pantsel/konga/releases/tag/v0.8.1) - 3-7-2017




 
