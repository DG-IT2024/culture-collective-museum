# Culture Collective: implementation plan

A 3D walk-through digital museum of Philippine popular culture (MO-HUM080 · H1102 · Group 2), with three eras: **2000–2010**, **Now (2025–2026)** and **2030**. It's due today and built by one person, so the phases are ordered so that a **submittable museum exists after Phase 2**. Everything after that adds features, and each phase can be cut if time runs out.

## Decisions (locked)

| Area | Decision |
|---|---|
| Platform | Own web app: Three.js (no build step) + a small Node/Express server |
| Hosting | Railway web service + **Railway Postgres** for posts |
| Devices | Laptop (WASD + mouse, pointer lock) and phone (left joystick, drag to look, tap to open) |
| Floor plan | **Loop**: Lobby → 2000s → Now → 2030 → Final room → corridor → back to Lobby |
| Room size | Medium gallery, about 26 × 30 m, 6.5 m ceiling |
| Era room walls | Affect on the **left**, Body on the **right**, Performance on the **back** wall. 5 exhibits each, 15 per room |
| Content | Only the 3 aspects (no Key Events / Overall Trends). Images from `past/`, `present/` and `future/`. Text from Phase 3 (E/H/K, F/I/L, G/J/M rows 9–13) |
| Labels | The wall shows title + year. Clicking opens a card with the full worksheet text (group's wording), image, curator and credit |
| Affect walls | Memorial treatment: dimmer, candle-like lights, a remembrance note, playful effects toned down nearby |
| Doorways | Time-warp portals: a flash, the era title appears, the sound changes |
| Freedom Walls | One per era room, **near the exit door**. 2000s = Friendster testimonials · Now = TikTok comment section · 2030 = holographic message stream |
| Posting | Optional nickname (blank = Anonymous) + message ≤ 200 chars, no sign-in. Bad-word filter (English + Filipino). **Hidden after 3 reports** |
| 2000s vibe | Y2K pastel + sparkles, Friendster-themed wall |
| Now vibe | TikTok neon (pink/cyan) + P-pop concert stage |
| 2030 vibe | Floating holo frames, central hologram, **smart-glasses prompt** on entering → scripted guide **DIWA** (friendly Taglish) |
| Final room | Phone evolution on **rising pedestals** (Nokia 3310 → smartphone → smart glasses), "Stand here" floor marker + neon "Culture Collective" sign, passport check-out desk, "Salamat sa pagbisita!" thank-you wall, short credits corridor back to the lobby |
| Lobby | Start screen = logo + **Enter** only. Turning 3D gold/cream logo centerpiece. Side wall: "Curated by" with 7 plaques, all titled **Curator**. Opposite wall: welcome text |
| Brand | Modern gallery: cream/charcoal + gold, serif logo |
| Passport | One trivia question per era room (near its exit) earns its stamp. All 3 stamps → shareable passport card image with nickname |
| Extras | Mini-map with tap-to-teleport, photo button (screenshot with Culture Collective frame) |
| Sound | Original ambience made in code (no real songs), muted until turned on |

### Approved text

**Welcome wall**
> Welcome to Culture Collective, a digital museum of Philippine popular culture.
>
> Walk through three eras: 2000–2010, the decade of texting, telefantasyas and reality TV; 2025–2026, the age of feeds, creators and P-pop; and 2030, where we imagine what comes next.
>
> In every room, explore how Filipinos felt, how they saw themselves, and how they performed and were entertained.
>
> Leave your thoughts on each room's Freedom Wall, and collect a stamp in your passport along the way.

**Trivia** (✓ = correct; options are shuffled on screen)
- 2000s: Which 2001 event peacefully removed President Joseph Estrada from office? **EDSA Dos ✓** · The Hello Garci scandal · The Manila Hostage Crisis · Typhoon Ondoy
- Now: Which group represents today's female pop and dance icons, taking over from the TV-centered dance culture of groups like SexBomb? **BINI ✓** · SB19 · Team Payaman · The Dancing Inmates
- 2030: Because fashion moves in cycles, which item does the museum predict will return by 2030? **Skinny jeans ✓** · Butterfly clips · Tube tops · Cargo pants

**Curators** (plaques say "Curator"): Aguinaldo, Debbie · Bautista, Eldrianne Alyanna · Caballa, Dave Paulo · De Guzman, Daniel Ceasar · Giltendez, Danilo · Menzon, Christian Joseph · Sorilla, Briggs

## Floor plan (loop)

Two columns of rooms, walked counter-clockwise:

```
 ┌──────────┬──────────┐
 │   NOW    │   2030   │   row 3
 │ 2025–26  │          │
 ├────↑─────┼────↓─────┤
 │  2000s   │  FINAL   │   row 2
 │2000–2010 │   ROOM   │
 ├────↑─────┼────↓─────┤
 │  LOBBY   ←─corridor │   row 1
 └──────────┴──────────┘
```

Doorways: Lobby→2000s (north), 2000s→Now (north), Now→2030 (east), 2030→Final (south), Final→corridor→Lobby (south, then west). Each era room is entered so that its back wall (Performance) faces the visitor on entry, its exit door sits beside the back wall, and the room's Freedom Wall and trivia stand are next to that exit door.

## Project structure

```
pop culture/
  culture-collective/          ← new app (the old museum/ draft is deleted in Phase 0)
    server.js                  Express: serves public/, posts API, Postgres
    package.json               "start": "node server.js"
    scripts/build-data.py      workbook + image folders → public/data.js + public/assets/
    public/
      index.html  app.js  style.css  data.js
      assets/{past,present,future}/*.jpg
  CULTURE-COLLECTIVE-PLAN.md   ← this file
```

**Posts table** (`posts`): `id serial`, `room text` (past/present/future), `nickname text`, `message text`, `reports int default 0`, `created_at timestamptz default now()`. Hidden when `reports >= 3`.

**API**: `GET /api/posts?room=past` (latest 60 visible) · `POST /api/posts {room, nickname, message}` (filtered, rate-limited by IP) · `POST /api/posts/:id/report`. If `DATABASE_URL` isn't set (local testing), the server uses an in-memory store.

---

## Phase 0 · Setup (≈20 min) ✅ done
Run locally: `cd culture-collective && npm install && npm start` → http://localhost:8123. Rebuild data: `python culture-collective/scripts/build-data.py`.

- Delete the old `museum/` draft (you chose to start fresh).
- Create `culture-collective/` with Express, `package.json` and `.gitignore`.
- `build-data.py`: read Phase 3 rows 9–13 for all 3 eras, split title/year/body, apply short wall titles, copy images from `past/`, `present/` and `future/`, and pull credits (Tacloban: "Photo courtesy RMN Tacloban, via Inquirer.net"; 2030: from `future/SOURCES-AND-CREDITS.md`).
- **Done when:** `data.js` lists 45 exhibits, each with an image, and `npm start` serves a blank page locally.

## Phase 1 · Walkable museum core (≈1.5 h) · must-have ✅ done
- Loop geometry for the 6 spaces (Lobby, 3 era rooms, Final, corridor): walls, floors, ceilings and doorways, with collision.
- Controls: WASD/mouse/pointer lock, plus phone joystick, drag-look and tap.
- All 45 exhibits on their walls (left/right/back), with wall labels and click-to-open cards (prev/next within the room).
- Lobby: start screen (logo + Enter), 3D logo centerpiece, welcome wall and curator plaque row.
- HUD: room name, crosshair and aim hint.
- **Done when:** you can walk the whole loop on a laptop and a phone and open every exhibit.

## Phase 2 · Era vibes (≈2 h) · makes it "feel like the era" ✅ done
- **2000s:** pastel gradient walls, sparkles/bubbles, checkered floor, chunky colorful frames, marquee, Friendster-styled Freedom Wall shell.
- **Now:** white walls, TikTok pink/cyan neon, P-pop stage with LED strips and light sticks, TikTok-comment-styled wall shell.
- **2030:** dark room, neon grid floor, particles, floating holo frames, central hologram. Smart-glasses prompt on entering → **DIWA** greeting + one line per exhibit wall (I draft the script for your approval).
- **Memorial Affect walls** in all era rooms.
- **Time-warp doorways** (flash + era title).
- **Final room:** rising pedestals (Nokia → phone → glasses), floor marker + neon sign, thank-you wall, credits corridor.
- **Done when:** each room is recognizable at a glance. ✅ **This is a submittable museum** (posting still local only).

## Phase 3 · Shared Freedom Walls (≈1 h) ✅ done (Postgres path untested until Railway)
- Server API + Postgres table, bad-word filter, report → hide at 3.
- In-world post form (nickname optional, 200 chars) and per-era rendering: Friendster testimonial boxes, TikTok comment column, hologram bubbles. Click a post to read it or report it.
- **Done when:** a post made in one browser appears in another.

## Phase 4 · Passport, mini-map, photo (≈1 h) ✅ done
- Trivia stand near each era room's exit. Correct (or second try) stamps the passport. A passport chip appears in the HUD.
- Final room check-out desk: asks for a nickname → generates the **passport card PNG** (3 stamps + nickname + Culture Collective branding) for download.
- Mini-map overlay with the current position and tap-to-teleport.
- Photo button: saves the current view with a Culture Collective frame/watermark.
- **Done when:** a full visit ends with a downloadable passport card.

## Phase 5 · Sound (≈30 min) ✅ done
- Web Audio ambience per room, made in code: Nokia-ish chirps + dial-up texture (2000s), soft crowd/beat hum (Now), synth drone (2030), a whoosh on time-warp doorways. A mute toggle, off by default.

## Phase 6 · Deploy to Railway (≈30 min) ✅ deployed
**Live:** https://web-production-563d3.up.railway.app · Railway project `culture-collective` (services `web` + `Postgres`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`). Redeploy after committing: `bash scripts/deploy.sh` (not linked to GitHub auto-deploy).

- Create the Railway project, add **Postgres**, deploy the app (start command `npm start`, `DATABASE_URL` linked), and create the table on boot.
- Test the public URL on a laptop and a phone.
- Put the link in the workbook (Phase 3 tab, cell **A16** "Link to the Digital Museum:"). I'll ask before editing the workbook.
- I'll check whether your Railway connector is available in this session. If not, you deploy from the Railway dashboard and I give you the steps.

## Phase 7 · QA pass (≈30 min)
- [x] Walk the full loop on a laptop (Chrome) and a phone (Android/iOS Safari) — scripted walk + emulated phone OK; real phone still to try
- [x] All 45 exhibits open with the correct image, text, curator and credit
- [x] Posting, filtering and reporting work on the live site; posts survive a redeploy (fixed: rate limit/report-once now use X-Real-IP)
- [x] Trivia ×3 → passport card downloads
- [x] Smart glasses + DIWA appear in 2030 and can be dismissed
- [ ] Frame rate is OK on a mid-range phone (60 fps emulated, pixel ratio capped at 1.25; needs a real phone)
- [ ] The lobby and Affect walls read respectfully (group to review)

## If time runs short: cut in this order
1. Sound (Phase 5)
2. Mini-map and photo button
3. Passport card image (keep stamps only)
4. DIWA lines per exhibit (keep greeting only)
5. Shared walls → fall back to browser-only posting

Phases 0–2 plus a Railway deploy of the static site is the minimum to submit.

## Open items to confirm during the build
- DIWA's script (I'll draft it)
- Reuse rights for news photos (Tacloban and others) are unconfirmed. Credits are shown on every card.
