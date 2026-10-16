# WildDuck Admin UI

React, TypeScript, Tailwind CSS, and daisyUI admin UI for WildDuck, with a local administrator login and a backend proxy that keeps the WildDuck API token on the server. Requires Node.js 22.13 or newer for built-in SQLite support.

You need a separately running WildDuck server with its HTTP API reachable from this backend and an API token with permissions for the operations you want to use. This project does not install or run WildDuck. Install dependencies from the project root. The `packages/` directory is not required to build or run the UI.

## Configuration

Configuration is loaded with `@zone-eu/wild-config`. Defaults live in `config/default.toml`. Override them with `--config=/path/to/admin-ui.toml`, `NODE_CONFIG_PATH`, or `APPCONF_*` environment variables.

Keep `config/default.toml` free of credentials. Its administrator password hash is intentionally empty, so a fresh checkout requires a private override before the server can start. Environment-specific files such as `config/development.toml` and `config/production.toml` load according to `NODE_ENV` (which defaults to `development`).

Important values:

```toml
[admin.auth]
username = "admin"
passwordHash = "<paste the generated scrypt hash here>"

[api]
url = "http://127.0.0.1:8080"
accessToken = ""
```

The admin login is local to this UI. WildDuck API calls use `api.accessToken` as `X-Access-Token`.

Generate an administrator password hash before starting the server:

```sh
npm run password:hash
```

The command prompts for a password without displaying it and prints a salted scrypt hash. Copy the entire `scrypt$...` line into `admin.auth.passwordHash` in your config override. For automation, the script also accepts a password from standard input. Avoid passing passwords as command arguments. Passwords must contain between 1 and 4096 UTF-8 bytes.

`admin.sessionSecret` defaults to a random value generated at startup, so restarting signs out existing sessions. Set a persistent random secret when sessions must survive restarts. Sessions also depend on the configured administrator database. Set `admin.secureCookies = true` when serving over HTTPS.

## Administrator database

SQLite is the default. Existing configurations using only `dbs.sqlite` continue working, including enrolled authenticators and the encryption key beside the database.

To use PostgreSQL, provision a database and configure:

```toml
[dbs]
engine = "postgres"
postgres = "postgres://admin_ui:password@localhost:5432/wildduck_admin"

[totp]
secret = "<persistent random encryption secret>"
```

The database user needs permission to create and alter application tables. The server initializes its schema before accepting requests. PostgreSQL connection URLs support the `pg` driver's TLS options, such as `sslmode=verify-full` and `sslrootcert`. Configure these for remote connections as appropriate for your PostgreSQL server.

PostgreSQL requires a persistent `totp.secret`, even before TOTP enrollment. Keep the same secret across restarts and application instances, and back it up separately from PostgreSQL. Set a persistent `admin.sessionSecret` too if sessions should survive restarts or be shared by instances. Configuration can also use `APPCONF_dbs_engine`, `APPCONF_dbs_postgres`, and `APPCONF_totp_secret`.

Selecting another engine uses separate administrator data. There is no automatic SQLite-to-PostgreSQL transfer. Sign in with the configured administrator password and enroll 2FA again. Switching back to SQLite uses its existing data.

Back up PostgreSQL with PostgreSQL backup tooling and retain the configured encryption secret. PostgreSQL mode does not create a local database or encryption-key file. Connection or initialization failures stop startup. The server never falls back to SQLite.

## Development

```sh
npm install
npm run password:hash
```

Create `config/development.toml` using the configuration example above. Paste the generated hash into `admin.auth.passwordHash`, and set `api.url` and `api.accessToken` for your WildDuck instance. Then start the app:

```sh
npm run dev
```

The React app runs on `http://localhost:5173` and proxies `/api` to the local backend on port `3100`. You can also set `NODE_CONFIG_PATH` to a private config override containing the same values.

## Production

Create a private `config/production.toml` with the administrator password hash and WildDuck API configuration, then run:

```sh
npm run build
NODE_ENV=production npm start
```

The Node backend serves the built UI and `/api` on `http://localhost:3100` by default. Place it behind an HTTPS reverse proxy and configure secure cookies and the WebAuthn origin for your public hostname. Use `admin.host` to change its bind address when needed.

The included Dockerfile builds the React app, runs nginx on port `8080`, and proxies `/api` to the bundled Node backend.

The runtime image includes `scripts/hash-password.cjs`. Private config files are excluded from the Docker build. Mount your config override read-only and set `NODE_CONFIG_PATH` to its path inside the container, or supply configuration through `APPCONF_*` environment variables, including `APPCONF_admin_auth_passwordHash`, `APPCONF_api_url`, and `APPCONF_api_accessToken`. Keep `$` characters literal when supplying the hash through a shell or Docker Compose. The WildDuck API URL must be reachable from inside the container. Container loopback refers to the container itself.

## Local administrator two factor authentication

TOTP and WebAuthn protect the admin UI account independently of WildDuck mailbox users. Credentials, short-lived enrollment and sign-in challenges, rate limits, and sessions are stored in the configured SQLite or PostgreSQL database. The `[totp]` issuer/secret and `[webauthn]` enabled/attachment/RP ID options follow [wildduck-webmail conventions](https://github.com/nodemailer/wildduck-webmail/blob/master/config/default.toml).

```toml
[admin.auth]
strict2fa = true

[dbs]
engine = "sqlite"
sqlite = "data/admin.sqlite"

[totp]
enabled = true
issuer = "WildDuck Admin"
secret = "" # generates a persistent encryption key beside the database

[webauthn]
enabled = true
origin = "https://admin.example.com"
rpId = "admin.example.com"
authenticatorAttachment = false # allow built-in authenticators and roaming keys
userVerification = "preferred"
```

With `strict2fa = true`, a successful password login leads to mandatory enrollment if no enabled method is enrolled. The administrator cannot access panel pages or call protected API routes until an authenticator code or WebAuthn registration is verified. Later sign-ins require one enrolled method. Strict mode also prevents removal of the last enabled method. Add another method before replacing it. At least one of TOTP or WebAuthn must be enabled in strict mode.

With `strict2fa = false` (the default), enrollment can wait. Add or remove methods in **Settings → Administrator security**. Once enrolled, 2FA is still required at each sign-in. Changes made from Settings require the current administrator password. Adding/removing a method revokes other administrator sessions.

Authenticator apps use six-digit, SHA-1 TOTP codes on a 30-second period, with one adjacent time step accepted for clock drift. Enrollment must be confirmed with a valid code. Used codes cannot be reused. Password-only sign-in steps expire after ten minutes. Enrollment and WebAuthn challenges expire after five minutes. Verification attempts are rate limited in the administrator database.

WebAuthn needs HTTPS in production. For development, open **http://localhost:5173** (or **http://localhost:3100** when serving a build), rather than the numeric loopback address. Default trusted origins include these two localhost ports. In production, set `webauthn.origin` to the exact public origin, including a non-default port if applicable. An array may allow multiple trusted origins under the same RP ID. `rpId = false` derives the RP ID from the first configured origin. Keep the RP ID stable after enrollment. Set `authenticatorAttachment` to `"platform"`, `"cross-platform"`, or `false` for either type. Set `userVerification = "required"` to require a PIN or biometric check. `"preferred"` also accepts presence-only security keys.

TOTP secrets are encrypted with AES-256-GCM. In SQLite mode, if `totp.secret` is empty, the backend creates `data/admin.sqlite.key` with owner-only access. Retain this file alongside the database, or keep your configured encryption secret unchanged. Back up the local data directory with the server stopped, or use SQLite-aware backup tooling. The Docker image declares `/app/data` as a volume. Mount a named volume or host directory there so credentials and the encryption key survive container replacement. Changing the admin password hash or 2FA policy invalidates existing sessions after restarting the server.

If all authenticators are lost, stop the server and reset this local account from the host:

```sh
npm run 2fa:reset -- --confirm=admin
```

Use the configured username after `--confirm=` and the same configuration override used by the server (for example, through `NODE_CONFIG_PATH`). The reset command removes this administrator's enrolled methods and revokes sessions without changing the password or WildDuck data. Restart the server and enroll again. Strict mode remains enforced. The recovery command uses the selected database engine and requires access to that database. Database access also grants access to this recovery mechanism.

## Validation

```sh
npm test
npm run build
npm run format:check
```

Tests exercise salted password hashing, the hash CLI, startup validation, login/session behavior, and authenticated filter/autoreply forwarding using a local mock WildDuck API. They do not require a running WildDuck instance.

Run `npm run format` to format the source, server, scripts, and tests with Prettier. The frontend uses two-space indentation. CommonJS server files, scripts, and tests use four spaces. `src/vite-env.d.ts` loads Vite's client types so TypeScript recognizes CSS and other asset imports.

## License

WildDuck Admin UI is licensed under the European Union Public License 1.2 or later, following [WildDuck's licensing](https://github.com/zone-eu/wildduck#license).

See [LICENSE](LICENSE) for the English text and [LICENSE_ET](LICENSE_ET) for the Estonian text.
