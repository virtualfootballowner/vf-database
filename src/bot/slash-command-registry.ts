import { leagueSlashCommandDefinitions } from "@/bot/commands";
import { mediaSlashCommandDefinitions } from "@/bot/media/commands";
import { refereeSlashCommandDefinitions } from "@/bot/referees/commands";
import {
  isRefereeGuild,
  leagueGuildId,
  mediaGuildId,
} from "@/bot/referees/config";

export function getSlashCommandsForGuild(guildId: string) {
  if (isRefereeGuild(guildId)) {
    return refereeSlashCommandDefinitions;
  }

  const leagueId = leagueGuildId();
  const mediaId = mediaGuildId();

  if (guildId === leagueId) {
    return leagueSlashCommandDefinitions;
  }

  if (mediaId && guildId === mediaId) {
    return [...mediaSlashCommandDefinitions, ...leagueSlashCommandDefinitions];
  }

  return [];
}
