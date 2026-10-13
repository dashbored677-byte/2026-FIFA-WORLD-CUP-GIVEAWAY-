# Enable real cross-device Town Square chat

The chat panel is already part of the website and stays available on every game section. To let different people chat with one another over the internet, connect a Supabase backend.

## Setup checklist

1. Create a project at https://supabase.com/.
2. In Supabase Dashboard → Authentication → Sign In / Providers, enable **Anonymous Sign-Ins**.
3. In SQL Editor, run all of `supabase-chat-setup.sql`.
4. Copy the project's **Project URL** and **publishable key** (or legacy anon key) from the API settings into `chat-config.js`.
5. Deploy the website over HTTPS. Test it from two separate devices or browser profiles.

Do not use a `service_role` key in `chat-config.js`. It bypasses Row Level Security and must remain server-side.

## What the integration does

- Creates an anonymous Supabase user for each visitor.
- Saves a display name tied to that user's auth ID.
- Loads recent messages from the shared `chat_messages` table.
- Subscribes to Supabase Realtime inserts so messages appear without refreshing.
- Enforces message length and sender identity in the database, with a basic rate limit.

## Before a public release

This is a starting point, not a fully moderated community platform. Add reporting, blocking, moderator/admin tools, abuse response procedures, privacy/retention rules, and suitable age/safety measures before opening chat to a large public audience. A single shared public room is implemented; private DMs are not included.
