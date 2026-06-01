# web-chess

Static chess trainer app built by Antigravity/Gemini.

## Local preview

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000`.

## Cloudflare Pages

This is a static site. Deploy the repository root as the Pages output directory.

Recommended Pages settings:

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `/`
- Root directory: `/`

CLI deploy after logging in to Cloudflare:

```bash
npx wrangler pages deploy . --project-name web-chess
```
