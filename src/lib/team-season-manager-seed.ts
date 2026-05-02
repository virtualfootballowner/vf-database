/**
 * Seed for `team_season_managers.manager_display_name` (mirrors migration
 * `20260509130000_team_season_managers_populate_s1_s2.sql`).
 *
 * Re-apply after edits: `npm run db:seed:managers`
 *
 * Season 3 nationals — vacant until appointed (null).
 */

export const TEAM_SEASON_MANAGER_SEED: Record<
  string,
  Partial<Record<1 | 2 | 3, string | null>>
> = {
  "andover-fc": { 1: "booskioo", 2: "johnhasflight" },
  "milton-town-fc": { 1: "sc_16x", 2: "sc_16x" },
  "newport-wanderers-fc": { 1: "MajinCrew", 2: "Mateiryan" },
  "viola-fc": { 1: "Lxv34ngel", 2: "Lxv34ngel" },
  "stafford-wanderers": { 1: "guzuwan" },
  "eltham-united": { 1: "Togzema", 2: "Togzema" },
  "newham-united": { 1: "Tomiezi", 2: "Jamesinho_0" },
  "ac-casole": { 2: "Bogkaku" },
  "tre-torre-libertas-fc": { 2: "RememberPastGlory" },
  "venezia-ac": { 2: "Specticaal" },
  "cartigiana-fc": { 2: "BloxBurgPOS" },
  "sassari-calcio": { 2: "Zazaryx" },
  "ambasciatori-milano": { 2: "Wiinaido" },
  "deportivo-di-gnoa": { 2: "Antiacti0n" },
  "nottingham-rangers": { 1: "CapV7", 2: "CapV7" },
  "canterbury-fc": { 2: "SpeedyPvP_DBZ" },
  "stanford-fc": { 2: "JustJqqudahh" },
};
