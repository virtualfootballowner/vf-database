import { randomUUID } from "node:crypto";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type GuildMember,
  type GuildTextBasedChannel,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/bot/config";
import {
  DEFAULT_POSTPONE_TIMEZONE,
  formatCaseNumber,
  formatFixtureWhen,
  formatFixtureWhenWithZone,
  isValidPostponeTimezone,
  parseProposedDateTime,
  POSTPONE_TIMEZONE_CHOICES,
  postponeTimezoneLabel,
  renderDenialLog,
} from "@/bot/postpone/format";
import {
  appendDenialReason,
  fetchActiveRequestForMatch,
  fetchManagerDiscordId,
  fetchNextUpcomingMatchForTeam,
  fetchPostponementState,
  fetchRequestById,
  fetchTeamIdBySlug,
  lockOriginalKickoff,
  recordDenial,
  type PostponementRequestRow,
  updateMatchScheduledAt,
} from "@/bot/postpone/queries";
import { notifyRefereesOfMatchPostponement } from "@/bot/referees/postponement/notify";
import {
  buildTeamNameBySlug,
  createBotSupabase,
  resolveManagerTeamSlugForSeason,
} from "@/bot/stats-queries";

export const POSTPONE_BTN_ACCEPT = "vfl:post:acc:";
export const POSTPONE_BTN_DENY = "vfl:post:den:";
export const POSTPONE_BTN_REASON = "vfl:post:rsn:";
export const POSTPONE_BTN_SKIP = "vfl:post:skip:";
export const POSTPONE_BTN_STAFF_APPROVE = "vfl:post:stf:a:";
export const POSTPONE_BTN_STAFF_FORCE = "vfl:post:stf:o:";
export const POSTPONE_BTN_STAFF_TIME = "vfl:post:stf:t:";
export const POSTPONE_MODAL_STAFF_TIME = "vfl:post:stf:m:";
export const POSTPONE_STAFF_TZ_SELECT = "vfl:post:stf:tz:";
export const POSTPONE_MODAL_DENY_REASON = "vfl:post:den:m:";

export const OPPONENT_RESPONSE_MS = 48 * 60 * 60 * 1000;
export const STAFF_PING_MS = 24 * 60 * 60 * 1000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatErr(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Unknown error";
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

function parseStaffTimeModalSuffix(
  suffix: string,
): { requestId: string; timeZone: string } | null {
  const pipe = suffix.indexOf("|");
  if (pipe === -1) return null;
  const requestId = suffix.slice(0, pipe);
  const timeZone = suffix.slice(pipe + 1);
  if (!UUID_RE.test(requestId) || !isValidPostponeTimezone(timeZone)) return null;
  return { requestId, timeZone };
}

function buildStaffTimeModal(requestId: string, timeZone: string): ModalBuilder {
  const tzLabel = postponeTimezoneLabel(timeZone);
  const modal = new ModalBuilder()
    .setCustomId(`${POSTPONE_MODAL_STAFF_TIME}${requestId}|${timeZone}`)
    .setTitle("Set new kickoff time");

  const dateInput = new TextInputBuilder()
    .setCustomId("date")
    .setLabel("Date (YYYY-MM-DD)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("2026-07-06");

  const timeInput = new TextInputBuilder()
    .setCustomId("time")
    .setLabel(`Time (${tzLabel})`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("5:00 PM");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
  );
  return modal;
}

function staffTimezoneSelectRow(requestId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${POSTPONE_STAFF_TZ_SELECT}${requestId}`)
      .setPlaceholder("Pick a timezone for the new kickoff")
      .addOptions(
        POSTPONE_TIMEZONE_CHOICES.map((c) => ({
          label: c.name.slice(0, 100),
          value: c.value,
        })),
      ),
  );
}

export async function handlePostponeStaffTimezoneSelect(
  interaction: StringSelectMenuInteraction,
  requestId: string,
): Promise<void> {
  if (!ensureStaff(interaction)) return;

  if (!UUID_RE.test(requestId)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Invalid request.",
    });
    return;
  }

  const timeZone = interaction.values[0];
  if (!timeZone || !isValidPostponeTimezone(timeZone)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Pick a valid timezone.",
    });
    return;
  }

  const supabase = createBotSupabase();
  const row = await fetchRequestById(supabase, requestId);
  if (!row || row.status !== "escalated") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This escalation is no longer active.",
    });
    return;
  }

  await interaction.showModal(buildStaffTimeModal(requestId, timeZone));
}

function ensureStaff(
  interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction,
): boolean {
  const hasPerm = interaction.memberPermissions?.has(
    PermissionFlagsBits.ManageRoles,
  );
  if (!hasPerm) {
    void interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need **Manage Roles** (staff) to resolve postponement escalations.",
    });
    return false;
  }
  return true;
}

async function notifyStaffPostponementAccepted(
  client: Client,
  row: PostponementRequestRow,
  acceptedByDiscordId: string,
): Promise<void> {
  try {
    const guild = await client.guilds.fetch(row.guild_id);
    const fetched = await guild.channels.fetch(env.DISCORD_STAFF_REVIEW_CHANNEL_ID);
    if (!fetched?.isTextBased() || !fetched.isSendable()) {
      console.error("[postpone] staff accept notify: channel missing");
      return;
    }

    const supabase = createBotSupabase();
    const teamNames = await buildTeamNameBySlug(supabase);
    const fixture = fixtureLabel(
      teamNames,
      row.requester_team_slug,
      row.opponent_team_slug,
    );

    const embed = new EmbedBuilder()
      .setColor(0x16a34a)
      .setTitle(`✅ Fixture moved — Case #${formatCaseNumber(row.case_number)}`)
      .setDescription(
        "Both managers agreed on a new kickoff. **No staff action required.**",
      )
      .addFields(
        { name: "Fixture", value: fixture, inline: false },
        {
          name: "Was",
          value: formatFixtureWhen(row.original_scheduled_at),
          inline: true,
        },
        {
          name: "Now",
          value: formatFixtureWhen(row.proposed_scheduled_at),
          inline: true,
        },
        {
          name: "Requested by",
          value: `<@${row.requester_discord_id}>`,
          inline: true,
        },
        {
          name: "Accepted by",
          value: `<@${acceptedByDiscordId}>`,
          inline: true,
        },
        {
          name: "Reason",
          value: row.reason.length > 1000 ? `${row.reason.slice(0, 997)}…` : `"${row.reason}"`,
          inline: false,
        },
      )
      .setFooter({ text: "Manager-approved postponement · logged for staff" })
      .setTimestamp(new Date());

    await fetched.send({ embeds: [embed] });
  } catch (e) {
    console.error("[postpone] staff accept notify:", e);
  }
}

function opponentActionRow(requestId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${POSTPONE_BTN_ACCEPT}${requestId}`)
      .setLabel("Accept")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${POSTPONE_BTN_DENY}${requestId}`)
      .setLabel("Deny")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger),
  );
}

function staffActionRow(requestId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${POSTPONE_BTN_STAFF_APPROVE}${requestId}`)
      .setLabel("Approve")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${POSTPONE_BTN_STAFF_FORCE}${requestId}`)
      .setLabel("Force Original")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${POSTPONE_BTN_STAFF_TIME}${requestId}`)
      .setLabel("Set New Time")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Primary),
  );
}

async function applyRescheduledKickoff(
  client: Client,
  supabase: SupabaseClient,
  matchId: string,
  scheduledAt: string,
): Promise<void> {
  await updateMatchScheduledAt(supabase, matchId, scheduledAt);
  void notifyRefereesOfMatchPostponement(client, matchId, scheduledAt).catch(
    (e) => console.error("[referee-postpone] notify after reschedule:", e),
  );
}

async function dmUser(
  client: Client,
  discordId: string | null | undefined,
  payload: { content?: string; embeds?: EmbedBuilder[]; components?: ActionRowBuilder<ButtonBuilder>[] },
): Promise<string | null> {
  if (!discordId?.trim()) return null;
  try {
    const user = await client.users.fetch(discordId);
    const msg = await user.send(payload);
    return msg.id;
  } catch (e) {
    console.error(`[postpone] DM failed for ${discordId}:`, e);
    return null;
  }
}

async function disableOpponentDmMessage(
  client: Client,
  opponentDiscordId: string | null | undefined,
  messageId: string | null | undefined,
): Promise<void> {
  if (!opponentDiscordId?.trim() || !messageId) return;
  try {
    const user = await client.users.fetch(opponentDiscordId);
    const dm = await user.createDM();
    const msg = await dm.messages.fetch(messageId);
    await msg.edit({ components: [] });
  } catch {
    /* DM may be deleted or inaccessible */
  }
}

function fixtureLabel(
  teamNames: Map<string, string>,
  homeSlug: string,
  awaySlug: string,
): string {
  const home = teamNames.get(homeSlug) ?? homeSlug;
  const away = teamNames.get(awaySlug) ?? awaySlug;
  return `${home} vs ${away}`;
}

export async function handlePostponeCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this command inside the server.",
    });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member.roles.cache.has(env.DISCORD_TEAM_MANAGER_ROLE_ID)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the **club manager** role to request a fixture postponement.",
    });
    return;
  }

  const dateRaw = interaction.options.getString("date", true);
  const timeRaw = interaction.options.getString("time", true);
  const timeZone =
    interaction.options.getString("timezone", true) ?? DEFAULT_POSTPONE_TIMEZONE;
  const reasonRaw = interaction.options.getString("reason", true).trim();
  if (!reasonRaw) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Provide a **reason** for the postponement request.",
    });
    return;
  }
  const reason = reasonRaw.slice(0, 500);

  const parsed = parseProposedDateTime(dateRaw, timeRaw, timeZone);
  if (!parsed.ok) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: parsed.message,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const activeSeason = env.VF_ACTIVE_ROSTER_SEASON;
  const supabase = createBotSupabase();

  try {
    const managerTeam = await resolveManagerTeamSlugForSeason(
      supabase,
      interaction.user.id,
      activeSeason,
    );
    if (!managerTeam.ok) {
      await interaction.editReply({
        content:
          "You're not listed as a **S" +
          activeSeason +
          "** club manager, so you can't request fixture changes.",
      });
      return;
    }

    const requesterSlug = managerTeam.teamSlug;
    const teamId = await fetchTeamIdBySlug(supabase, requesterSlug);
    if (!teamId) {
      await interaction.editReply({
        content: "Could not resolve your club in the database.",
      });
      return;
    }

    const match = await fetchNextUpcomingMatchForTeam(supabase, teamId);
    if (!match) {
      await interaction.editReply({
        content:
          "You don't have an **upcoming scheduled fixture** assigned to your club. Nothing to postpone.",
      });
      return;
    }

    const state = await fetchPostponementState(supabase, match.id);
    if (state?.original_locked) {
      await interaction.editReply({
        content:
          "The **original kickoff** for your next fixture is locked by staff. You can't request further changes.",
      });
      return;
    }

    const active = await fetchActiveRequestForMatch(supabase, match.id);
    if (active) {
      await interaction.editReply({
        content:
          "A **postponement request is already pending** on your upcoming fixture. Wait for a response or staff resolution before trying again.",
      });
      return;
    }

    const isHome = match.home_slug === requesterSlug;
    const opponentSlug = isHome ? match.away_slug : match.home_slug;
    const opponentDiscordId = await fetchManagerDiscordId(
      supabase,
      opponentSlug,
      match.season ?? activeSeason,
    );
    if (!opponentDiscordId) {
      await interaction.editReply({
        content:
          "Your opponent doesn't have a **manager Discord account** on file for this season. Ask staff to update manager assignments.",
      });
      return;
    }

    const teamNames = await buildTeamNameBySlug(supabase);
    const requesterName = teamNames.get(requesterSlug) ?? requesterSlug;
    const opponentName = teamNames.get(opponentSlug) ?? opponentSlug;
    const expiresAt = new Date(Date.now() + OPPONENT_RESPONSE_MS).toISOString();

    const requestId = randomUUID();
    const { data: inserted, error: insErr } = await supabase
      .from("match_postponement_requests")
      .insert({
        id: requestId,
        match_id: match.id,
        guild_id: interaction.guild.id,
        requester_discord_id: interaction.user.id,
        opponent_discord_id: opponentDiscordId,
        requester_team_slug: requesterSlug,
        opponent_team_slug: opponentSlug,
        original_scheduled_at: match.scheduled_at,
        proposed_scheduled_at: parsed.iso,
        reason,
        status: "pending_opponent",
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (insErr) {
      if (isUniqueViolation(insErr)) {
        await interaction.editReply({
          content:
            "Another postponement request was just submitted for this fixture. Try again in a moment.",
        });
        return;
      }
      throw insErr;
    }

    const row = inserted as PostponementRequestRow;
    const client = interaction.client;

    const opponentEmbed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("⏱️ Postponement Request")
      .setDescription(
        [
          `**${requesterName}** wants to move your upcoming fixture`,
          "",
          `📅 **Original:** ${formatFixtureWhen(match.scheduled_at)} (UK)`,
          `📅 **Proposed:** ${formatFixtureWhenWithZone(parsed.iso, timeZone)}`,
          `🌐 **Timezone:** ${postponeTimezoneLabel(timeZone)}`,
          `💬 **Reason:** "${reason}"`,
        ].join("\n"),
      )
      .setFooter({ text: "Buttons expire after 48 hours" })
      .setTimestamp(new Date());

    const opponentMsgId = await dmUser(client, opponentDiscordId, {
      embeds: [opponentEmbed],
      components: [opponentActionRow(requestId)],
    });

    const requesterMsgId = await dmUser(client, interaction.user.id, {
      content: `Your postponement request has been sent. Awaiting response from **${opponentName}**.`,
    });

    await supabase
      .from("match_postponement_requests")
      .update({
        opponent_dm_message_id: opponentMsgId,
        requester_dm_message_id: requesterMsgId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (!opponentMsgId) {
      await interaction.editReply({
        content:
          "Request was saved but the bot **could not DM your opponent** (they may have DMs closed). Ask them to enable DMs from server members.",
      });
      return;
    }

    await interaction.editReply({
      content: `Postponement request sent to **${opponentName}**. You'll get a DM when they respond.`,
    });

    console.log(
      `[postpone] Case #${formatCaseNumber(row.case_number)} created by ${interaction.user.id} for match ${match.id}`,
    );
  } catch (err) {
    console.error("/postpone failed:", err);
    await interaction.editReply({
      content: `Could not create postponement request: ${formatErr(err)}`,
    });
  }
}

async function loadPendingRequest(
  supabase: SupabaseClient,
  requestId: string,
): Promise<PostponementRequestRow | null> {
  if (!UUID_RE.test(requestId)) return null;
  const row = await fetchRequestById(supabase, requestId);
  if (!row || row.status !== "pending_opponent") return null;
  return row;
}

export async function handlePostponeAcceptButton(
  interaction: ButtonInteraction,
  requestId: string,
): Promise<void> {
  await interaction.deferUpdate();
  const supabase = createBotSupabase();

  try {
    const row = await loadPendingRequest(supabase, requestId);
    if (!row) {
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: "This postponement request is no longer active.",
      });
      return;
    }

    if (interaction.user.id !== row.opponent_discord_id) {
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: "Only the **opponent manager** can accept this request.",
      });
      return;
    }

    const { data: won, error: upErr } = await supabase
      .from("match_postponement_requests")
      .update({
        status: "accepted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "pending_opponent")
      .select("id")
      .maybeSingle();

    if (upErr) throw upErr;
    if (!won) {
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: "This request was already handled.",
      });
      return;
    }

    await applyRescheduledKickoff(
      interaction.client,
      supabase,
      row.match_id,
      row.proposed_scheduled_at,
    );

    const teamNames = await buildTeamNameBySlug(supabase);
    const fixture = fixtureLabel(
      teamNames,
      row.requester_team_slug,
      row.opponent_team_slug,
    );
    const when = formatFixtureWhen(row.proposed_scheduled_at);

    const confirm =
      `✅ **Fixture updated**\n\n**${fixture}** is now scheduled for **${when}**. Assigned referees have been DMed to confirm availability.`;

    await dmUser(interaction.client, row.requester_discord_id, { content: confirm });
    await dmUser(interaction.client, row.opponent_discord_id, { content: confirm });

    await notifyStaffPostponementAccepted(
      interaction.client,
      row,
      interaction.user.id,
    );

    await interaction.message.edit({ components: [] }).catch(() => {});

    console.log(
      `[postpone] Case #${formatCaseNumber(row.case_number)} accepted — match ${row.match_id} → ${row.proposed_scheduled_at}`,
    );
  } catch (err) {
    console.error("[postpone] accept:", err);
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: `Could not accept: ${formatErr(err)}`,
    });
  }
}

export async function handlePostponeDenyButton(
  interaction: ButtonInteraction,
  requestId: string,
): Promise<void> {
  await interaction.deferUpdate();
  const supabase = createBotSupabase();

  try {
    const row = await loadPendingRequest(supabase, requestId);
    if (!row) {
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: "This postponement request is no longer active.",
      });
      return;
    }

    if (interaction.user.id !== row.opponent_discord_id) {
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: "Only the **opponent manager** can deny this request.",
      });
      return;
    }

    const deniedAt = new Date().toISOString();

    const { data: won, error: upErr } = await supabase
      .from("match_postponement_requests")
      .update({
        status: "denied",
        updated_at: deniedAt,
      })
      .eq("id", requestId)
      .eq("status", "pending_opponent")
      .select("*")
      .maybeSingle();

    if (upErr) throw upErr;
    if (!won) {
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: "This request was already handled.",
      });
      return;
    }

    const { denialCount } = await recordDenial(supabase, row.match_id, {
      denied_at: deniedAt,
      reason: null,
      denied_by_discord_id: interaction.user.id,
    });

    const teamNames = await buildTeamNameBySlug(supabase);
    const opponentName = teamNames.get(row.opponent_team_slug) ?? row.opponent_team_slug;

    await dmUser(interaction.client, row.requester_discord_id, {
      content: `❌ **${opponentName}** denied your postponement request. You may run **\`/postpone\`** again with a different time.`,
    });

    await interaction.message.edit({ components: [] }).catch(() => {});

    const reasonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${POSTPONE_BTN_REASON}${requestId}`)
        .setLabel("Add Reason")
        .setEmoji("✏️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${POSTPONE_BTN_SKIP}${requestId}`)
        .setLabel("Skip")
        .setStyle(ButtonStyle.Secondary),
    );

    await dmUser(interaction.client, row.opponent_discord_id, {
      content: "Would you like to provide a reason for your denial? (optional)",
      components: [reasonRow],
    });

    if (denialCount >= 3) {
      await escalatePostponement(interaction.client, supabase, {
        ...row,
        status: "denied",
      });
    }

    console.log(
      `[postpone] Case #${formatCaseNumber(row.case_number)} denied (${denialCount}/3)`,
    );
  } catch (err) {
    console.error("[postpone] deny:", err);
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: `Could not deny: ${formatErr(err)}`,
    });
  }
}

export async function handlePostponeReasonButton(
  interaction: ButtonInteraction,
  requestId: string,
): Promise<void> {
  if (!UUID_RE.test(requestId)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Invalid request.",
    });
    return;
  }

  const supabase = createBotSupabase();
  const row = await fetchRequestById(supabase, requestId);
  if (!row || interaction.user.id !== row.opponent_discord_id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You can't add a reason to this denial.",
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${POSTPONE_MODAL_DENY_REASON}${requestId}`)
    .setTitle("Denial reason (optional)");

  const input = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("Why did you deny?")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(input),
  );
  await interaction.showModal(modal);
}

export async function handlePostponeSkipReasonButton(
  interaction: ButtonInteraction,
  requestId: string,
): Promise<void> {
  await interaction.update({
    content: "Denial recorded.",
    components: [],
  });
  void requestId;
}

export async function handlePostponeDenyReasonModal(
  interaction: ModalSubmitInteraction,
  requestId: string,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!UUID_RE.test(requestId)) {
    await interaction.editReply({ content: "Invalid request." });
    return;
  }

  const reason = interaction.fields.getTextInputValue("reason").trim().slice(0, 500);
  const supabase = createBotSupabase();
  const row = await fetchRequestById(supabase, requestId);
  if (!row || interaction.user.id !== row.opponent_discord_id) {
    await interaction.editReply({ content: "You can't update this denial." });
    return;
  }

  const state = await fetchPostponementState(supabase, row.match_id);
  const latest = state?.denial_log.filter(
    (e) => e.denied_by_discord_id === interaction.user.id,
  ).at(-1);

  if (latest && reason) {
    await appendDenialReason(supabase, row.match_id, latest.denied_at, reason);
  }

  await interaction.editReply({
    content: reason ? "Reason saved." : "Denial recorded without a reason.",
  });
}

export async function escalatePostponement(
  client: Client,
  supabase: SupabaseClient,
  row: PostponementRequestRow,
): Promise<boolean> {
  const existing = await fetchActiveRequestForMatch(supabase, row.match_id);
  if (existing?.status === "escalated") return false;

  const staffPingDue = new Date(Date.now() + STAFF_PING_MS).toISOString();
  const now = new Date().toISOString();

  const { data: won, error: upErr } = await supabase
    .from("match_postponement_requests")
    .update({
      status: "escalated",
      staff_ping_due_at: staffPingDue,
      updated_at: now,
    })
    .eq("id", row.id)
    .in("status", ["pending_opponent", "denied"])
    .select("*")
    .maybeSingle();

  if (upErr) {
    console.error("[postpone] escalate update:", upErr);
    return false;
  }
  if (!won) return false;

  const escalated = won as PostponementRequestRow;
  const teamNames = await buildTeamNameBySlug(supabase);
  const state = await fetchPostponementState(supabase, row.match_id);
  const denialLog = renderDenialLog(state?.denial_log ?? []);

  const guild = await client.guilds.fetch(escalated.guild_id).catch(() => null);
  if (!guild) {
    console.error("[postpone] escalate: guild not found");
    return false;
  }

  let channel: GuildTextBasedChannel;
  try {
    const fetched = await guild.channels.fetch(env.DISCORD_STAFF_REVIEW_CHANNEL_ID);
    if (!fetched?.isTextBased() || !fetched.isSendable()) {
      console.error("[postpone] staff channel missing");
      return false;
    }
    channel = fetched as GuildTextBasedChannel;
  } catch (e) {
    console.error("[postpone] staff channel fetch:", e);
    return false;
  }

  const fixture = fixtureLabel(
    teamNames,
    escalated.requester_team_slug,
    escalated.opponent_team_slug,
  );

  const embed = new EmbedBuilder()
    .setColor(0xdc2626)
    .setTitle(`🚨 Postponement Escalation — Case #${formatCaseNumber(escalated.case_number)}`)
    .setDescription(
      [
        `**Fixture:** ${fixture}`,
        `📅 **Original Time:** ${formatFixtureWhen(escalated.original_scheduled_at)}`,
        `**Requested by:** <@${escalated.requester_discord_id}>`,
        `**Opponent:** <@${escalated.opponent_discord_id ?? "unknown"}>`,
        "",
        "**Denial Log:**",
        denialLog,
      ].join("\n"),
    )
    .setFooter({ text: "Manage Roles to resolve · Approve uses last proposed time" })
    .setTimestamp(new Date());

  const msg = await channel.send({
    embeds: [embed],
    components: [staffActionRow(escalated.id)],
  });

  await supabase
    .from("match_postponement_requests")
    .update({
      escalation_channel_id: channel.id,
      escalation_message_id: msg.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", escalated.id);

  const dmText =
    "Your postponement dispute has been escalated to staff. A decision will be made on your behalf.";

  await dmUser(client, escalated.requester_discord_id, { content: dmText });
  await dmUser(client, escalated.opponent_discord_id, { content: dmText });

  await disableOpponentDmMessage(
    client,
    escalated.opponent_discord_id,
    escalated.opponent_dm_message_id,
  );

  console.log(
    `[postpone] Case #${formatCaseNumber(escalated.case_number)} escalated to staff`,
  );
  return true;
}

export async function handlePostponeStaffButton(
  interaction: ButtonInteraction,
  action: "approve" | "force" | "time",
  requestId: string,
): Promise<void> {
  if (!ensureStaff(interaction)) return;

  if (action === "time") {
    if (!UUID_RE.test(requestId)) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "Invalid request.",
      });
      return;
    }

    const supabase = createBotSupabase();
    const row = await fetchRequestById(supabase, requestId);
    if (!row || row.status !== "escalated") {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "This escalation is no longer active.",
      });
      return;
    }

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Pick a **timezone**, then enter the new date and time.",
      components: [staffTimezoneSelectRow(requestId)],
    });
    return;
  }

  await interaction.deferUpdate();
  const supabase = createBotSupabase();

  try {
    const row = await fetchRequestById(supabase, requestId);
    if (!row || row.status !== "escalated") {
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: "This escalation is no longer active.",
      });
      return;
    }

    const now = new Date().toISOString();
    let newStatus: string;
    let scheduledAt: string | null = null;
    let notify: string;

    if (action === "approve") {
      newStatus = "staff_approved";
      scheduledAt = row.proposed_scheduled_at;
      notify = `✅ Staff **approved** the postponement. Your fixture is now **${formatFixtureWhen(scheduledAt)}**.`;
    } else {
      newStatus = "staff_force_original";
      scheduledAt = null;
      await lockOriginalKickoff(supabase, row.match_id);
      notify = `❌ Staff **kept the original kickoff**: **${formatFixtureWhen(row.original_scheduled_at)}**. No further postponement requests are allowed on this fixture.`;
    }

    const { data: won, error: upErr } = await supabase
      .from("match_postponement_requests")
      .update({
        status: newStatus,
        staff_discord_id: interaction.user.id,
        staff_resolved_at: now,
        staff_ping_due_at: null,
        updated_at: now,
      })
      .eq("id", requestId)
      .eq("status", "escalated")
      .select("id")
      .maybeSingle();

    if (upErr) throw upErr;
    if (!won) {
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: "This case was already resolved.",
      });
      return;
    }

    if (scheduledAt) {
      await applyRescheduledKickoff(
        interaction.client,
        supabase,
        row.match_id,
        scheduledAt,
      );
    }

    await dmUser(interaction.client, row.requester_discord_id, { content: notify });
    await dmUser(interaction.client, row.opponent_discord_id, { content: notify });

    await interaction.message.edit({ components: [] }).catch(() => {});

    console.log(
      `[postpone] Case #${formatCaseNumber(row.case_number)} staff ${action} by ${interaction.user.id}`,
    );
  } catch (err) {
    console.error("[postpone] staff button:", err);
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: `Could not resolve: ${formatErr(err)}`,
    });
  }
}

export async function handlePostponeStaffTimeModal(
  interaction: ModalSubmitInteraction,
  modalSuffix: string,
): Promise<void> {
  if (!ensureStaff(interaction)) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const parsedIds = parseStaffTimeModalSuffix(modalSuffix);
  if (!parsedIds) {
    await interaction.editReply({ content: "Invalid request." });
    return;
  }
  const { requestId, timeZone } = parsedIds;

  const dateRaw = interaction.fields.getTextInputValue("date");
  const timeRaw = interaction.fields.getTextInputValue("time");
  const parsed = parseProposedDateTime(dateRaw, timeRaw, timeZone);
  if (!parsed.ok) {
    await interaction.editReply({ content: parsed.message });
    return;
  }

  const supabase = createBotSupabase();
  const row = await fetchRequestById(supabase, requestId);
  if (!row || row.status !== "escalated") {
    await interaction.editReply({ content: "This escalation is no longer active." });
    return;
  }

  const now = new Date().toISOString();
  const { data: won, error: upErr } = await supabase
    .from("match_postponement_requests")
    .update({
      status: "staff_set_time",
      staff_discord_id: interaction.user.id,
      staff_resolved_at: now,
      staff_set_scheduled_at: parsed.iso,
      staff_ping_due_at: null,
      updated_at: now,
    })
    .eq("id", requestId)
    .eq("status", "escalated")
    .select("id")
    .maybeSingle();

  if (upErr) throw upErr;
  if (!won) {
    await interaction.editReply({ content: "This case was already resolved." });
    return;
  }

  await applyRescheduledKickoff(
    interaction.client,
    supabase,
    row.match_id,
    parsed.iso,
  );

  const notify = `🔄 Staff set a new kickoff: **${formatFixtureWhenWithZone(parsed.iso, timeZone)}**. Assigned referees have been DMed.`;
  await dmUser(interaction.client, row.requester_discord_id, { content: notify });
  await dmUser(interaction.client, row.opponent_discord_id, { content: notify });

  if (row.escalation_channel_id && row.escalation_message_id) {
    try {
      const channel = await interaction.client.channels.fetch(row.escalation_channel_id);
      if (channel?.isTextBased()) {
        const msg = await channel.messages.fetch(row.escalation_message_id);
        await msg.edit({ components: [] });
      }
    } catch {
      /* ignore */
    }
  }

  await interaction.editReply({ content: "Fixture updated and managers notified." });

  console.log(
    `[postpone] Case #${formatCaseNumber(row.case_number)} staff set time ${parsed.iso}`,
  );
}

export async function processExpiredPostponementRequest(
  client: Client,
  row: PostponementRequestRow,
): Promise<void> {
  const supabase = createBotSupabase();
  const current = await fetchRequestById(supabase, row.id);
  if (!current || current.status !== "pending_opponent") return;
  if (new Date(current.expires_at).getTime() > Date.now()) return;

  await disableOpponentDmMessage(
    client,
    row.opponent_discord_id,
    row.opponent_dm_message_id,
  );

  await escalatePostponement(client, supabase, row);
}

export async function processStaffPostponementPing(
  client: Client,
  row: PostponementRequestRow,
): Promise<void> {
  if (!row.escalation_channel_id || !row.escalation_message_id) return;

  const supabase = createBotSupabase();
  const nextPing = new Date(Date.now() + STAFF_PING_MS).toISOString();
  const now = new Date().toISOString();

  const { data: won, error } = await supabase
    .from("match_postponement_requests")
    .update({
      staff_last_ping_at: now,
      staff_ping_due_at: nextPing,
      updated_at: now,
    })
    .eq("id", row.id)
    .eq("status", "escalated")
    .select("id")
    .maybeSingle();

  if (error || !won) return;

  try {
    const channel = await client.channels.fetch(row.escalation_channel_id);
    if (!channel?.isTextBased() || !channel.isSendable()) return;
    await channel.send({
      content: `@here ⏰ **Reminder** — Postponement **Case #${formatCaseNumber(row.case_number)}** still needs staff action.`,
      reply: { messageReference: row.escalation_message_id, failIfNotExists: false },
    });
  } catch (e) {
    console.error(`[postpone-ping] case ${row.case_number}:`, e);
  }
}
