# aimlock

Valorant crosshair browser that loads crosshair data from Supabase BaaS.

## Files

| Path | Purpose |
| --- | --- |
| `web/index.html` | App entry page |
| `web/styles.css` | App styles |
| `web/app.js` | Search, filters, pagination, Supabase data loading |
| `web/preview.js` | Crosshair preview renderer |
| `web/auth.js` | Google sign-in UI and favorite state |
| `web/auth-config.js` | Google OAuth client ID |
| `web/baas-config.js` | Supabase URL/key/table config |
| `docs/supabase-crosshairs.sql` | Supabase table and read policy setup |
| `docs/supabase-crosshairs-data.sql` | Seed data for the `crosshairs` table |

## Run

Open `web/index.html` directly in a browser. No local server is required.

Data is loaded from the Supabase project configured in `web/baas-config.js`.

When opened as `file://`, Google sign-in is not available because Google OAuth requires an authorized web origin. The app uses a local login fallback in that mode so favorites can still work on this computer.

## Supabase Setup

Run these files in the Supabase SQL Editor:

1. `docs/supabase-crosshairs.sql`
2. `docs/supabase-crosshairs-data.sql`

Then set `web/baas-config.js`:

```js
window.AIMLOCK_BAAS = {
  enabled: true,
  provider: "supabase",
  supabaseUrl: "https://YOUR_PROJECT_ID.supabase.co",
  supabaseAnonKey: "YOUR_PUBLISHABLE_OR_ANON_KEY",
  table: "crosshairs",
};
```

Use only a publishable or anon public key in browser code. Never put a `service_role` or secret key in this file.

## Google Login

For real Google sign-in, deploy the `web` folder to an HTTPS host such as GitHub Pages, Netlify, or Vercel. Then add that site origin to the Google Cloud OAuth client:

```text
https://your-site.example
```

If you open `index.html` directly from disk, the origin is `file://`, and Google blocks the sign-in flow.
