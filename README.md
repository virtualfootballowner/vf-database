This repository now contains:
- The Next.js website (App Router)
- A Discord bot that auto-syncs RoVer-verified users into Supabase

## Getting Started

First, run the website:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Discord Bot Setup

1. Copy `.env.example` to `.env.local` and fill values.
2. Ensure your bot has the `GuildMembers` intent enabled in Discord Developer Portal.
3. Run:

```bash
npm run bot:dev
```

Bot behavior:
- On startup, it backfills existing verified members.
- On member updates, it checks for RoVer verified role.
- It parses nickname as Roblox username, validates with Roblox API, then upserts into `players`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
