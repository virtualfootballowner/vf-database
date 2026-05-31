import {
  ActionRowBuilder,
  GuildMember,
  MessageFlags,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";

import { env } from "@/bot/config";
import {
  createBotSupabase,
  findPlayerByDiscordId,
  type PlayerProfileRow,
} from "@/bot/stats-queries";

export const EQUIP_HONOR_SELECT_ID = "equip-honor-select";

export type HonorEquipKey =
  | "ballon_dor"
  | "golden_glove"
  | "golden_boot"
  | "golden_shield"
  | "euroleague"
  | "euroblox";

type HonorJson = { title?: string; season?: number; team?: string };

type HonorEquipDef = {
  key: HonorEquipKey;
  label: string;
  roleId: string;
  owns: (accolades: HonorJson[], trophies: HonorJson[]) => boolean;
};

const HONOR_DEFS: HonorEquipDef[] = [
  {
    key: "ballon_dor",
    label: "Ballon d'Or",
    roleId: "1510488149565112410",
    owns: (accolades) =>
      accolades.some((a) => /ball?on\s*d['']?\s*or/i.test(a.title ?? "")),
  },
  {
    key: "golden_glove",
    label: "Golden Glove",
    roleId: "1510488380553695312",
    owns: (accolades) =>
      accolades.some((a) => /golden\s*glove/i.test(a.title ?? "")),
  },
  {
    key: "golden_boot",
    label: "Golden Boot",
    roleId: "1510488453857542204",
    owns: (accolades) =>
      accolades.some((a) => /golden\s*boot/i.test(a.title ?? "")),
  },
  {
    key: "golden_shield",
    label: "Golden Shield",
    roleId: "1510488551630966844",
    owns: (accolades) =>
      accolades.some((a) => /golden\s*shield/i.test(a.title ?? "")),
  },
  {
    key: "euroleague",
    label: "EuroLeague",
    roleId: "1510488630160789627",
    owns: (_accolades, trophies) =>
      trophies.some((t) => {
        const title = (t.title ?? "").trim();
        if (/euro\s*blox|euroblox/i.test(title)) return false;
        return /euro\s*league|euroleague/i.test(title);
      }),
  },
  {
    key: "euroblox",
    label: "Euroblox",
    roleId: "1510488695940190228",
    owns: (_accolades, trophies) =>
      trophies.some((t) => /euro\s*blox|euroblox/i.test(t.title ?? "")),
  },
];

function parseHonorList(raw: unknown): HonorJson[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object") as HonorJson[];
}

export function allHonorRoleIds(): string[] {
  return HONOR_DEFS.map((d) => d.roleId);
}

export function honorDefByKey(key: string): HonorEquipDef | undefined {
  return HONOR_DEFS.find((d) => d.key === key);
}

export function ownedHonorOptions(profile: PlayerProfileRow): HonorEquipDef[] {
  const accolades = parseHonorList(profile.accolades);
  const trophies = parseHonorList(profile.trophies);
  return HONOR_DEFS.filter((d) => d.owns(accolades, trophies));
}

function guildOnly(interaction: ChatInputCommandInteraction): boolean {
  if (interaction.guildId !== env.DISCORD_GUILD_ID) {
    void interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Run `/equip` in the main VF League server.",
    });
    return false;
  }
  return true;
}

function buildHonorSelectRow(options: HonorEquipDef[]) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(EQUIP_HONOR_SELECT_ID)
    .setPlaceholder("Choose an honor to display")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      options.map((o) => ({
        label: o.label,
        value: o.key,
        description: "Equip this Discord role",
      })),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export async function handleEquipCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!guildOnly(interaction)) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supabase = createBotSupabase();
  const profile = await findPlayerByDiscordId(supabase, interaction.user.id);

  if (!profile) {
    await interaction.editReply({
      content:
        "No VF player profile is linked to your Discord yet. Complete verification on the website first.",
    });
    return;
  }

  const owned = ownedHonorOptions(profile);
  if (owned.length === 0) {
    await interaction.editReply({
      content:
        "You don't have any honors or trophies on your profile yet — nothing to equip.",
    });
    return;
  }

  await interaction.editReply({
    content:
      "Pick **one** honor role to wear. Equipping a new one removes any other honor role you had on.",
    components: [buildHonorSelectRow(owned)],
  });
}

async function applyHonorRole(
  member: GuildMember,
  def: HonorEquipDef,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const me = member.guild.members.me;
  if (!me?.permissions.has("ManageRoles")) {
    return { ok: false, reason: "Bot is missing **Manage Roles** permission." };
  }

  const targetRole = member.guild.roles.cache.get(def.roleId);
  if (!targetRole) {
    return {
      ok: false,
      reason: `Role for **${def.label}** is not set up on this server.`,
    };
  }

  if (targetRole.position >= me.roles.highest.position) {
    return {
      ok: false,
      reason:
        "Bot role is too low in the hierarchy to assign that honor role.",
    };
  }

  const stripIds = allHonorRoleIds().filter((id) => id !== def.roleId);
  const toRemove = stripIds.filter((id) => member.roles.cache.has(id));
  if (toRemove.length > 0) {
    await member.roles.remove(toRemove, "VF /equip — swap honor role");
  }

  if (!member.roles.cache.has(def.roleId)) {
    await member.roles.add(def.roleId, "VF /equip — honor role");
  }

  return { ok: true };
}

export async function handleEquipHonorSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (interaction.customId !== EQUIP_HONOR_SELECT_ID) return;

  await interaction.deferUpdate();

  const key = interaction.values[0];
  const def = honorDefByKey(key);
  if (!def) {
    await interaction.editReply({
      content: "Unknown honor selection.",
      components: [],
    });
    return;
  }

  const supabase = createBotSupabase();
  const profile = await findPlayerByDiscordId(supabase, interaction.user.id);
  if (!profile) {
    await interaction.editReply({
      content: "Your profile is no longer linked.",
      components: [],
    });
    return;
  }

  const owned = ownedHonorOptions(profile);
  if (!owned.some((o) => o.key === def.key)) {
    await interaction.editReply({
      content: `You don't have **${def.label}** on your VF profile — that honor can't be equipped.`,
      components: [],
    });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({
      content: "This only works inside the VF League server.",
      components: [],
    });
    return;
  }

  try {
    const guildMember =
      interaction.member instanceof GuildMember
        ? interaction.member
        : await guild.members.fetch(interaction.user.id);

    const result = await applyHonorRole(guildMember, def);
    if (!result.ok) {
      await interaction.editReply({
        content: result.reason,
        components: [],
      });
      return;
    }

    await interaction.editReply({
      content: `Equipped **${def.label}**. Only one honor role is worn at a time.`,
      components: [],
    });
  } catch (err) {
    console.error("[equip] role apply failed:", err);
    await interaction.editReply({
      content:
        "Couldn't update your roles. Ask staff to check bot permissions and role order.",
      components: [],
    });
  }
}

export function isEquipHonorSelect(customId: string): boolean {
  return customId === EQUIP_HONOR_SELECT_ID;
}
