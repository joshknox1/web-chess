# Chess Trainer

Static chess trainer app built by Antigravity/Gemini.

## Local preview

```bash
python3 -m http.server 3000 --directory public
```

Then open `http://localhost:3000`.

## Cloudflare Workers/Pages static deploy

The deployable static files live in `public/` so Wrangler does not upload `node_modules`.

Cloudflare build/deploy settings:

- Build command: `npx wrangler deploy`
- Build output directory: leave blank if using the deploy command above
- Root directory: `/`

The committed `wrangler.jsonc` points Cloudflare at `./public`.
