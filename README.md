# Life in Akwa Ibom — game prototype with global chat

A responsive browser-based life-simulation game prototype built with HTML, CSS, and vanilla JavaScript. Includes a global Town Square chat widget that stays available while a player moves between game sections.

## Run the prototype

1. Download and extract the project folder.
2. From this folder, start a local web server (recommended because the chat uses JavaScript modules):

   ```bash
   python -m http.server 8000
   ```

3. Open `http://localhost:8000` in your browser.
4. Create your character and play. The chat widget is fixed at the bottom-right on desktop and mobile; the Community chat item in the sidebar opens it too.

## Included game features

- Character name and avatar selection
- Virtual wallet, energy, happiness, reputation, XP and levels
- Job shifts with energy costs and virtual payments
- City exploration with first-visit rewards
- Businesses that can be purchased and manually collect game income
- Virtual housing progression
- Daily missions and reward claiming
- Local browser save, character editing and JSON save export
- Responsive desktop and mobile layouts

## Chat: demo mode vs real live chat

The Town Square panel is global within the website UI, so it remains available while players navigate Overview, City, Jobs, Businesses, Housing, and Missions.

**Demo mode (default):** the chat works as a UI prototype and stores messages in the current browser. Other tabs in the same browser may see updates, but this is NOT real internet chat and does not share messages between different players or devices.

**Real live chat:** the project includes a Supabase integration. To enable it:

1. Create a Supabase project at https://supabase.com/.
2. In Supabase Authentication settings, enable **Anonymous Sign-Ins**. Add your deployed website URL to the allowed site/redirect URL settings as required by your project.
3. Open the Supabase SQL Editor and run `supabase-chat-setup.sql`.
4. Open `chat-config.js` and replace `https://YOUR-PROJECT.supabase.co` and `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` with your project's URL and publishable/anon key. The publishable/anon key is intended for browser use when Row Level Security is correctly configured. **Never place a service-role key in frontend code.**
5. Deploy the complete project to HTTPS hosting and open the site on two separate browsers/devices to test the same Town Square.

When configured, the app signs visitors in with Supabase anonymous auth, stores a display name per anonymous account, loads recent public messages, and subscribes to new messages in realtime. Chat is one shared public room; it is not private messaging. The SQL adds row-level security, database-side display-name enforcement, message length limits, and a basic per-user send rate limit.

If live chat cannot connect, inspect the browser console and confirm the Supabase URL/key, anonymous sign-in setting, SQL setup, and Realtime publication. The UI will fall back to demo mode rather than pretending that messages are live.

## Important limitations before public launch

- User accounts are anonymous in this chat integration; production identity, account recovery, and linked game saves are not implemented.
- The global chat needs real-world testing and stronger moderation tools (report, block, admin review, spam/abuse handling, retention rules) before a public launch.
- Progress is stored locally in the current browser/device; there are no cloud game saves.
- There is no game multiplayer, real-money economy, or server-side validation of game progression.
- The locations and economy are fictionalized game representations, not official government services, real property listings, or real job offers.
- The city illustration uses CSS shapes and emoji; custom artwork and a true navigable map can be added later.
- Supabase's JavaScript client is loaded from `esm.sh` only when live chat is configured; an internet connection is required for that mode.

## Suggested production steps

1. Configure Supabase and test live chat across devices.
2. Add moderation, reporting, blocking, and a privacy/terms flow before public launch.
3. Build account linking and cloud saves for the actual game state.
4. Add server-side game validation before competitive play.
5. Create original character art, animations, sound design, and richer map environments.
6. Test accessibility, mobile performance, backups, analytics consent, privacy policy, and terms of service.
