# Roblox Open Cloud OAuth app — review submission copy

Use your **production** domain in URLs (replace if different).

## Privacy Policy URL

```
https://myvirtualfootball.com/privacy
```

## Terms of Service URL

```
https://myvirtualfootball.com/terms
```

## Entry Link (start URL for users)

```
https://myvirtualfootball.com/verify
```

## Description (paste into Roblox form)

Pick one that fits the character limit. All versions describe the same integration.

### Recommended (balanced — good for most review forms)

```
Virtual Football League (VFL) runs competitive Roblox football seasons and publishes stats, rosters, and team pages on our official website. We use Roblox OAuth solely for account linking: after a user signs in with Discord and Roblox on our site, we read basic profile information (per approved scopes) to confirm their Roblox username and user ID, sync their Discord server nickname to match Roblox, and grant league access after staff review. We do not control experiences, scripts, inventory, or economy — only identity verification for our community and database. Legal: https://myvirtualfootball.com/privacy · https://myvirtualfootball.com/terms
```

### Short (tight character limits ~280–400)

```
VFL — official Roblox football league site. OAuth links a member’s Roblox account to Discord for verification only (nickname + ID match, staff approval). No gameplay or universe APIs. Privacy & Terms: myvirtualfootball.com/privacy and /terms.
```

### Ultra-short (~150 chars) — use only if required

```
VFL league website: Roblox sign-in proves who you are to link Discord; identity only. Policies at myvirtualfootball.com/privacy and /terms.
```

### Detailed (longer forms / “tell us more”)

```
Virtual Football League (VF League / VFL) is an organized Roblox football competition. Our website (myvirtualfootball.com) displays public league data: matches, standings, player and team profiles, and season rosters.

This OAuth application exists for one purpose: verified account linking. New members open our “Verify” page, authenticate with Discord (their server account) and then with Roblox. With the user’s consent under the requested OAuth scopes, we retrieve Roblox profile identifiers needed to confirm they own the Roblox account they claim. We then update the member’s nickname in our official Discord guild to match their Roblox username and assign internal roles so staff can complete whitelist review. Match statistics on the site are associated with verified Roblox user IDs provided by league operations.

We do not use this OAuth integration to join experiences on the user’s behalf, modify places, access inventory, spend Robux, or call game servers. It is not embedded inside a Roblox experience; it is a standalone web flow on our domain. Full privacy practices and terms of service are published at https://myvirtualfootball.com/privacy and https://myvirtualfootball.com/terms respectively.
```
