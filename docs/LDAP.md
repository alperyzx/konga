# LDAP authentication implementation guide

This guide describes the LDAP authentication already present in Konga and provides a safe
implementation and rollout checklist for extending it. Konga uses `passport-ldapauth` on the
server and keeps a local Konga user record for every successful LDAP login.

## How the current flow works

1. Set `KONGA_AUTH_PROVIDER=ldap` before starting Konga.
2. The login form posts `identifier` and `password` to `POST /login`.
3. `api/services/Passport.js` selects the LDAP strategy when the provider is `ldap`.
4. `config/ldap.js` binds with the service account, searches for the user, and verifies the
   supplied password through the LDAP strategy.
5. `api/services/protocols/ldap.js` maps the LDAP result to a local Konga user.
6. The local user is created or updated, including the `admin` flag, and Konga returns its
   normal session JWT.

LDAP credentials are not stored in Konga. The local user record is a role/profile cache and is
updated on each successful login.

## Configuration

Set these variables in the environment used to start Konga. Do not commit the bind password.

| Variable | Default | Purpose |
| --- | --- | --- |
| `KONGA_AUTH_PROVIDER` | `local` | Set to `ldap`. This changes the `/login` provider. |
| `KONGA_LDAP_HOST` | `ldap://localhost:389` | LDAP or LDAPS server URL. |
| `KONGA_LDAP_BIND_DN` | unset | Service-account DN used to search for users. |
| `KONGA_LDAP_BIND_PASSWORD` | unset | Service-account password. |
| `KONGA_LDAP_USER_SEARCH_BASE` | `ou=users,dc=com` | User search base DN. |
| `KONGA_LDAP_USER_SEARCH_FILTER` | `(|(uid={{username}})(sAMAccountName={{username}}))` | User search filter. `{{username}}` is replaced by the login identifier. |
| `KONGA_LDAP_USER_ATTRS` | `uid,uidNumber,givenName,sn,mail` | Attributes requested from the user entry. |
| `KONGA_LDAP_GROUP_SEARCH_BASE` | `ou=groups,dc=com` | Group search base DN. |
| `KONGA_LDAP_GROUP_SEARCH_FILTER` | `(|(memberUid={{uid}})(memberUid={{uidNumber}})(sAMAccountName={{uid}}))` | Group filter. Templates may use user attributes such as `{{uid}}` or `{{uidNumber}}`. |
| `KONGA_LDAP_GROUP_ATTRS` | `cn` | Group attributes requested. |
| `KONGA_ADMIN_GROUP_REG` | `^(admin\|konga)$` | Regular expression for groups that grant Konga admin access. |
| `KONGA_LDAP_ATTR_USERNAME` | `uid` | LDAP attribute mapped to Konga `username`. |
| `KONGA_LDAP_ATTR_FIRSTNAME` | `givenName` | LDAP attribute mapped to Konga `firstName`. |
| `KONGA_LDAP_ATTR_LASTNAME` | `sn` | LDAP attribute mapped to Konga `lastName`. |
| `KONGA_LDAP_ATTR_EMAIL` | `mail` | LDAP attribute mapped to Konga `email`. |

For Active Directory, the usual minimum changes are the user filter and attribute mapping,
for example:

```dotenv
KONGA_AUTH_PROVIDER=ldap
KONGA_LDAP_HOST=ldaps://ad.example.com:636
KONGA_LDAP_BIND_DN=CN=konga-reader,OU=Service Accounts,DC=example,DC=com
KONGA_LDAP_BIND_PASSWORD=use-a-secret-manager
KONGA_LDAP_USER_SEARCH_BASE=OU=Users,DC=example,DC=com
KONGA_LDAP_USER_SEARCH_FILTER=(sAMAccountName={{username}})
KONGA_LDAP_USER_ATTRS=sAMAccountName,givenName,sn,mail,memberOf
KONGA_LDAP_ATTR_USERNAME=sAMAccountName
KONGA_ADMIN_GROUP_REG=^(Konga-Admins)$
```

For OpenLDAP, the defaults are closer to the expected schema:

```dotenv
KONGA_AUTH_PROVIDER=ldap
KONGA_LDAP_HOST=ldap://ldap.example.com:389
KONGA_LDAP_USER_SEARCH_BASE=ou=users,dc=example,dc=com
KONGA_LDAP_GROUP_SEARCH_BASE=ou=groups,dc=example,dc=com
KONGA_LDAP_USER_SEARCH_FILTER=(uid={{username}})
KONGA_LDAP_GROUP_SEARCH_FILTER=(memberUid={{uid}})
KONGA_ADMIN_GROUP_REG=^(konga-admins)$
```

## Implementing changes safely

Keep the authentication contract stable: the frontend should continue sending `identifier` and
`password` to `/login`, and successful authentication should continue returning `{ user, token }`.
That avoids changes to the Angular session handling and Kong API authorization headers.

When extending the implementation, work in this order:

1. Add or adjust configuration in `config/ldap.js`; keep environment-variable defaults there.
2. Keep LDAP-specific mapping and role decisions in `api/services/protocols/ldap.js`.
3. Keep Passport strategy selection and session/token handling in `api/services/Passport.js`.
4. Add unit tests for user mapping, group-to-admin mapping, missing attributes, and failed LDAP
   responses before changing the UI.
5. Test with a disposable directory or a read-only service account before connecting production
   LDAP.

Do not put LDAP queries in the Angular client, and do not store LDAP passwords in Konga's
`konga_passports` table. Avoid logging bind credentials, user passwords, or complete LDAP result
objects.

## Bootstrap and rollout

Konga redirects a completely empty local user database to `/register`. Before enabling LDAP in a
new installation, create the initial local Konga account or seed a user database. Then:

```bash
export KONGA_AUTH_PROVIDER=ldap
export KONGA_LDAP_HOST='ldaps://ldap.example.com:636'
export KONGA_LDAP_BIND_DN='CN=konga-reader,OU=Service Accounts,DC=example,DC=com'
export KONGA_LDAP_BIND_PASSWORD='...'
./run.sh
```

Use a non-admin LDAP account first. Confirm that the local Konga user is created/updated and that
the JWT-authenticated UI can read the configured Kong node. Then test an account matching
`KONGA_ADMIN_GROUP_REG`, followed by an account that must remain a normal user.

## Test matrix

- Valid username/password authenticates.
- Invalid password returns 401 and does not create a local user.
- Unknown username returns 401.
- Search service account can bind and search the configured base.
- User entries contain every attribute named by `KONGA_LDAP_USER_ATTRS`.
- A normal group does not grant admin access.
- An admin group grants admin access after login.
- A user removed from the admin group loses admin access on the next login.
- An existing local profile is updated from LDAP without losing its Kong node associations.
- LDAPS certificate validation works in the deployment environment.
- LDAP outage produces a clear authentication failure without exposing directory details.
- Local authentication remains available when `KONGA_AUTH_PROVIDER=local`.

For troubleshooting, temporarily increase `KONGA_LOG_LEVEL` only in a non-production
environment. Inspect status codes and sanitized error messages; never enable logging that exposes
the bind password or submitted login password.

## Current limitations to consider during implementation

- LDAP is selected globally through `KONGA_AUTH_PROVIDER`; per-user provider selection is not
  implemented.
- Konga stores a synchronized local profile and role, so LDAP group changes take effect on the
  user's next successful login rather than continuously.
- The current admin decision is based on the configured group-name regular expression. A future
  implementation may want explicit group-to-permission mapping instead of a single admin regex.
- The LDAP strategy is configured at request time in `Passport.callback`; avoid registering a new
  strategy repeatedly in a global initialization loop without checking Passport behavior.

