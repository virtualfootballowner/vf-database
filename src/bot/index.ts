import "dotenv/config";

import {
  Client,
  Events,
  GatewayIntentBits,
  type GuildMember,
} from "discord.js";

import { env } from "@/bot/config";
import { syncMemberIfVerified } from "@/bot/sync";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

async function runBackfill() {
  const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
  const members = await guild.members.fetch();

  for (const member of members.values()) {
    await syncMemberIfVerified(member as GuildMember);
  }

  console.log(`Backfill complete for ${members.size} members.`);
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Discord bot online as ${readyClient.user.tag}`);
  try {
    await runBackfill();
  } catch (error) {
    console.error("Backfill failed:", error);
  }
});

client.on(Events.GuildMemberUpdate, async (_oldMember, newMember) => {
  try {
    await syncMemberIfVerified(newMember as GuildMember);
  } catch (error) {
    console.error("Member sync failed:", error);
  }
});

void client.login(env.DISCORD_BOT_TOKEN);
