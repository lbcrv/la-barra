# La Barra

An arcade 3D table football (futbolito) game for the browser, set in a Honduran corner shop: one player against a bot, two players on one screen, or two players online with a room code. Red, Atlético La Esquina, against blue, Real Pulpería.

## Project rules

- **No AI slop.** No emojis anywhere (UI, copy, README, commits). No purple gradients, glassmorphism, sparkle icons or "AI-powered" badges. Copy is plain and concrete.
- **The look is a cartoon of the barrio.** Toon shading with thick ink outlines, chunky big-headed players that squash and stretch when they kick, saturated shop colours (painted wood, green field, red and blue teams, warm bulb light). Juice on every hit: ball trail, screen shake, comic-book "¡GOOOL!" lettering. Score is kept with abacus beads like real tables. Everything is modelled or drawn in code; no stock 3D models, no generated images.
- **Arcade, but fair.** Short matches (first to 5), power-ups that drop onto the table, a narrator with short Honduran lines. Power-ups change the ball or the rods for a few seconds; they never decide a goal on their own.
- **Physics stays real under the cartoon.** The exaggeration is visual. The ball, rods and kicks keep the real-scale physics below.
- **Real proportions.** Physics runs in metres with a real table's measurements (field 1.20 x 0.68 m, 35 mm ball). Constants live in `src/game/table.ts`; never hardcode a dimension in a component.
- **Controls stay simple.** The rod nearest the ball is picked automatically. Mouse or finger slides it, click or tap kicks. Two players share a keyboard: W/S + D, and arrows up/down + left.
- **Costs $0.** Static site on Vercel's free tier. No paid services and no server of our own: online play is peer to peer, with the host's browser running the physics.
- **Spanish first.** Player-facing text is Spanish, with English as a toggle. README is English.
- **Invented teams only.** No real club names, crests or brands.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
