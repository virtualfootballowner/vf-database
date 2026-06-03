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
  const isMedia = guildId === mediaId;
  const isLeague = guildId === leagueId;

  // Media guild may be the same server as the league — register media cmds first.
  if (isMedia) {
    return [...mediaSlashCommandDefinitions, ...leagueSlashCommandDefinitions];
  }

  if (isLeague) {
    return leagueSlashCommandDefinitions;
  }

  return [];
}
