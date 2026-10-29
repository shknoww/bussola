# Bússola

**Places with context.** Original project by **Marcos Mendes**. [Português (Brasil)](README.md)

**[Open app](https://bussola-mira.vercel.app)** · [Administration](https://bussola-mira.vercel.app/admin) · [Verified release and limits](docs/RELEASE.en-GB.md)

A technical pilot for exploring places, sources and review states. The public database starts empty: this is not an already curated directory. São Paulo is the initial map location, not a registration boundary. Suggestions are not published automatically. There is no political voting system or inference of individuals’ political opinions.

## Project scope

- Public HTML/CSS/JavaScript interface with a map/list, contributions and local favourites.
- Administration at `/admin.html` (also `/admin` with the Vercel configuration), with suggestions, corrections, places and an audit log.
- Same-origin Node API, a Supabase database gateway and a versioned SQL migration.
- Brazilian Portuguese by default, with British English available.

The [pilot contract](docs/CONTRACT.md) defines the implemented API. The [original PRD](docs/PRD.md) retains broader proposals and acceptance criteria; it does not establish that every criterion has passed. Physical-device installation, backup restoration, real-world curation and legal review must not be assumed.

## Development

Requires Node.js 22 and npm.

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run dev
```

The server reads process environment variables; `npm run dev` does not automatically load `.env`. For a **local test configuration**, use the keys in `.env.example` in a Git-ignored local file:

```sh
node --env-file=.env.local server/dev.mjs
```

Open the URL printed by the server, then `/admin.html`. An unconfigured database or missing secrets can produce `503`; this is not an empty database. Do not point destructive tests at production. See [deployment](docs/DEPLOYMENT.md) and [testing](docs/TESTING.md).

## Administration

The pilot uses a high-entropy random access key, **not Supabase Auth**. The original key belongs in the owner’s Keychain; the server receives its hash. The panel accepts the key in its form or through `#token=…`, immediately removes the fragment and calls `POST /api/admin/login`. It does not persist the key in localStorage/sessionStorage. Authentication uses an HttpOnly, Secure, SameSite=Strict cookie, with CSRF protection on writes.

`npm run admin:link` opens the panel using the local Keychain. Set `BUSSOLA_ORIGIN` to the correct HTTPS origin. `npm run admin:link -- --print` prints a **secret link**: never include it in issues, screenshots, logs or documentation. Removing the fragment does not make the key single-use.

Every decision needs a reason and an expected revision. Publishing a directional position or a statement about customers requires a direct HTTPS source, verified authorship/scope and a review deadline. The form defaults to 180 days; **Maintain** does not renew verification. See [moderation](docs/MODERATION.md).

## Translation dictionaries

- Public UI: `public/i18n/public-pt-BR.js` and `public-en-GB.js` export message objects.
- Admin UI: `public/i18n/admin-pt-BR.js` and `admin-en-GB.js` register message objects in `window.BUSSOLA_ADMIN_I18N`.
- Keep matching keys in both languages. Translate labels, help and errors, not API codes, identifiers, URLs or user-submitted content.
- Preserve any placeholders the caller uses. Admin `data-i18n` translates text; `data-i18n-aria` translates accessible labels. Messages are text, not HTML.
- To add a language, add its dictionary, loading and selector option. Test language changes with populated forms, errors, long text and keyboard navigation.

## Documentation

Operational documents are currently in Portuguese: [moderation](docs/MODERATION.md), [deployment and recovery](docs/DEPLOYMENT.md), [privacy](docs/PRIVACY.md), [testing](docs/TESTING.md), [design](DESIGN.md).

## Licensing and attribution

- **Original code:** [Apache License 2.0](LICENSE). Original author: Marcos Mendes. Preserve [NOTICE](NOTICE).
- **Original writing, documentation and design:** [Creative Commons Attribution 4.0 International — CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) ([legal code](https://creativecommons.org/licenses/by/4.0/legalcode)). Credit Marcos Mendes and Bússola, link to the licence and indicate changes. Attribution does not imply endorsement.
- Dependencies, fonts, maps and external content retain their own licences. Leaflet: BSD-2-Clause; DM Sans: SIL Open Font License 1.1; OpenStreetMap data: ODbL. Preserve notices in `public/vendor/` and map attribution.
- The project licence does not relicense third-party sources, business statements, personal data or trademarks.
