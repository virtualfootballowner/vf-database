import { teams, type Team } from "../teams/teams-data";

export type MatchRecord = {
  id: string;
  season: 1 | 2 | 3;
  competition: string;
  gameWeek: string;
  date: string;
  homeTeam: string;
  homeSlug: string | null;
  homeScore: number;
  awayTeam: string;
  awaySlug: string | null;
  awayScore: number;
  stage: string;
  fft: "No" | "Yes" | "Partial" | "Mercy";
  referee: string;
  notes: string;
};

const TEAM_NAME_TO_SLUG: Record<string, string | null> = {
  Newport: "newport-wanderers-fc",
  Nottingham: "nottingham-rangers",
  Milton: "milton-town-fc",
  Newham: "newham-united",
  Andover: "andover-fc",
  Eltham: "eltham-united",
  Viola: "viola-fc",
  Cartiginia: "cartigiana-fc",
  Venezia: "venezia-ac",
  Casole: "ac-casole",
  Canterbury: "canterbury-fc",
  Stanford: "stanford-fc",
  Milano: "ambasciatori-milano",
  DDG: "deportivo-di-gnoa",
  Tretorre: "tre-torre-libertas-fc",
  Sassari: "sassari-calcio",
  Stafford: "stafford-wanderers",
  // Season 3 · national teams (fixture / CSV short names → slug)
  France: "france",
  Spain: "spain",
  England: "england",
  Germany: "germany",
  Belgium: "belgium",
  /** Legacy sheet / fixture label — Croatia removed from roster; treat as Canada. */
  Croatia: "canada",
  Netherlands: "netherlands",
  Italy: "italy",
  Portugal: "portugal",
  Brazil: "brazil",
  Argentina: "argentina",
  Canada: "canada",
  USA: "usa",
  Mexico: "mexico",
  Nigeria: "nigeria",
  Morocco: "morocco",
  Japan: "japan",
};

export function slugFor(name: string): string | null {
  return TEAM_NAME_TO_SLUG[name] ?? null;
}

/** Short fixture name as on the site (e.g. `Milton`) → full `Team` record for DB import. */
export function resolveTeamForWebsiteName(websiteName: string): Team {
  return getMatchTeam(slugFor(websiteName), websiteName);
}

export function getMatchTeam(slug: string | null, fallbackName: string): Team {
  if (slug) {
    const found = teams.find((team) => team.slug === slug);
    if (found) return found;
  }
  return {
    name: fallbackName,
    short: fallbackName.slice(0, 3).toUpperCase(),
    slug: "",
    logo: null,
    form: "",
    seasons: [],
  };
}

/** Prefer rows from `catalog` (e.g. Supabase), then built-in `teams`. */
export function getMatchTeamFromList(
  catalog: Team[],
  slug: string | null,
  fallbackName: string,
): Team {
  if (slug) {
    const found = catalog.find((team) => team.slug === slug);
    if (found) return found;
  }
  const byName = catalog.find((t) => t.name === fallbackName);
  if (byName) return byName;
  return getMatchTeam(slug, fallbackName);
}

type RawMatch = [
  id: string,
  season: 1 | 2 | 3,
  competition: string,
  gw: string,
  date: string,
  home: string,
  away: string,
  hs: number,
  as: number,
  stage: string,
  fft: MatchRecord["fft"],
  ref: string,
  notes?: string,
];

const RAW: RawMatch[] = [
  ["EL1-GW1-01", 1, "EuroLeague", "GW1", "2023-07-22", "Newport", "Nottingham", 3, 5, "Group", "No", "YJGD"],
  ["EL1-NTS-01", 1, "EuroLeague", "GW7", "2023-08-13", "Nottingham", "Stafford", 1, 1, "Group", "No", "YJGD", "Euro League sheet"],
  ["EL1-GW1-02", 1, "EuroLeague", "GW1", "2023-07-22", "Milton", "Newham", 1, 6, "Group", "No", "YJGD"],
  ["EL1-GW1-03", 1, "EuroLeague", "GW1", "2023-07-23", "Stafford", "Viola", 3, 2, "Group", "No", "YJGD"],
  ["EL1-GW1-04", 1, "EuroLeague", "GW1", "2023-07-23", "Andover", "Eltham", 9, 1, "Group", "No", "YJGD"],
  ["EL1-GW2-01", 1, "EuroLeague", "GW2", "2023-07-25", "Newport", "Newham", 1, 3, "Group", "No", "Koolicxcte"],
  ["EL1-GW2-02", 1, "EuroLeague", "GW2", "2023-07-26", "Eltham", "Milton", 2, 3, "Group", "No", "YJGD"],
  ["EL1-GW2-03", 1, "EuroLeague", "GW2", "2023-07-27", "Andover", "Stafford", 10, 0, "Group", "No", "Koolicxcte"],
  ["EL1-GW2-04", 1, "EuroLeague", "GW2", "2023-07-28", "Viola", "Nottingham", 2, 8, "Group", "No", "ahmed", "Score dispute noted"],
  ["EL1-GW3-01", 1, "EuroLeague", "GW3", "2023-07-29", "Viola", "Newport", 2, 4, "Group", "No", "ahmed"],
  ["EL1-GW3-02", 1, "EuroLeague", "GW3", "2023-07-29", "Newham", "Eltham", 4, 4, "Group", "No", "Koolicxcte", "OG by kuya scout (Newham)"],
  ["EL1-GW3-03", 1, "EuroLeague", "GW3", "2023-07-30", "Nottingham", "Andover", 1, 3, "Group", "No", "sam"],
  ["EL1-GW3-04", 1, "EuroLeague", "GW3", "2023-07-30", "Milton", "Stafford", 6, 1, "Group", "No", "YJGD / Deleted User", "Ref changed at 45'"],
  ["EL1-GW4-01", 1, "EuroLeague", "GW4", "2023-08-01", "Eltham", "Newport", 2, 2, "Group", "No", "Koolicxcte"],
  ["EL1-GW4-02", 1, "EuroLeague", "GW4", "2023-08-03", "Milton", "Nottingham", 0, 3, "Group", "No", "ahmed"],
  ["EL1-GW4-03", 1, "EuroLeague", "GW4", "2023-08-02", "Andover", "Viola", 8, 0, "Group", "No", "Koolicxcte"],
  ["EL1-GW4-04", 1, "EuroLeague", "GW4", "2023-08-02", "Stafford", "Newham", 0, 3, "Group", "Yes", "—", "FFT"],
  ["EL1-GW5-01", 1, "EuroLeague", "GW5", "2023-08-05", "Newport", "Andover", 0, 5, "Group", "No", "Koolicxcte"],
  ["EL1-GW5-02", 1, "EuroLeague", "GW5", "2023-08-06", "Viola", "Milton", 2, 4, "Group", "No", "wiz"],
  ["EL1-GW5-03", 1, "EuroLeague", "GW5", "2023-08-05", "Eltham", "Stafford", 4, 0, "Group", "No", "Koolicxcte", "Stafford 0. OG zhanedem (credited to Eltham)."],
  ["EL1-GW5-04", 1, "EuroLeague", "GW5", "2023-08-06", "Newham", "Nottingham", 0, 2, "Group", "No", "Koolicxcte"],
  ["EL1-GW6-01", 1, "EuroLeague", "GW6", "2023-08-08", "Milton", "Andover", 2, 8, "Group", "No", "Deleted User"],
  ["EL1-GW6-02", 1, "EuroLeague", "GW6", "2023-08-09", "Nottingham", "Eltham", 3, 0, "Group", "No", "sam"],
  ["EL1-GW6-03", 1, "EuroLeague", "GW6", "2023-08-10", "Viola", "Newham", 6, 1, "Group", "No", "ahmed"],
  ["EL1-GW6-04", 1, "EuroLeague", "GW6", "2023-08-10", "Stafford", "Newport", 3, 0, "Group", "Yes", "—", "FFT"],
  ["EL1-GW7-01", 1, "EuroLeague", "GW7", "2023-08-13", "Andover", "Newham", 9, 0, "Group", "Partial", "wiz", "+3 FFT goals added to score"],
  ["EL1-GW7-02", 1, "EuroLeague", "GW7", "2023-08-13", "Newport", "Milton", 0, 3, "Group", "Yes", "YJGD", "FFT"],
  ["EL1-GW7-03", 1, "EuroLeague", "GW7", "2023-08-13", "Viola", "Eltham", 1, 3, "Group", "No", "sam"],
  ["EP1-QF-01", 1, "EuroBlox Playoffs", "QF", "2023-08-17", "Andover", "Viola", 7, 1, "Quarter-Final", "No", "Koolicxcte"],
  ["EP1-QF-02", 1, "EuroBlox Playoffs", "QF", "2023-08-17", "Eltham", "Newham", 4, 0, "Quarter-Final", "No", "—", "Date approximate"],
  ["EP1-QF-03", 1, "EuroBlox Playoffs", "QF", "2023-08-17", "Milton", "Stafford", 5, 1, "Quarter-Final", "No", "—", "Date approximate"],
  ["EP1-QF-04", 1, "EuroBlox Playoffs", "QF", "2023-08-17", "Nottingham", "Newport", 3, 0, "Quarter-Final", "Yes", "—", "FFT - Date approximate"],
  ["EP1-SF-01", 1, "EuroBlox Playoffs", "SF", "2023-08-24", "Andover", "Milton", 0, 7, "Semi-Final", "No", "—", "Date approximate"],
  ["EP1-SF-02", 1, "EuroBlox Playoffs", "SF", "2023-08-24", "Eltham", "Nottingham", 0, 4, "Semi-Final", "No", "—", "Date approximate"],
  ["EP1-F-01", 1, "EuroBlox Playoffs", "F", "2023-08-31", "Milton", "Nottingham", 3, 2, "Final", "No", "—", "S1 Champions: Milton · Date approximate"],

  ["EL2-GW1-01", 2, "Serie Italia", "GW1", "2024-11-09", "Cartiginia", "Venezia", 3, 2, "Group", "No", "Deleted User"],
  ["EL2-GW1-02", 2, "British Premier", "GW1", "2024-11-09", "Nottingham", "Newham", 3, 4, "Group", "No", "Koolicxcte"],
  ["EL2-GW1-03", 2, "Serie Italia", "GW1", "2024-11-09", "Casole", "Viola", 4, 0, "Group", "Yes", "LogisticsEnthusiast", "FFT"],
  ["EL2-GW1-04", 2, "British Premier", "GW1", "2024-11-10", "Andover", "Canterbury", 3, 7, "Group", "No", "Koolicxcte"],
  ["BP2-GW1-01", 2, "British Premier", "GW1", "2024-11-10", "Milton", "Eltham", 2, 3, "Group", "No", "Deleted User"],
  ["BP2-MNH-01", 2, "British Premier", "GW1", "2024-11-14", "Milton", "Newham", 0, 0, "Group", "No", "—", "0-0 vs Newham (pair split from BP2-MN-01 Milton–Newport 3-3). Date approximate"],
  ["BP2-MN-01", 2, "British Premier", "GW1", "2024-11-15", "Milton", "Newport", 3, 3, "Group", "No", "—", "Milton v Newport. GW1 slot; rescheduled / date approximate"],
  ["SI2-GW1-01", 2, "Serie Italia", "GW1", "2024-11-10", "Milano", "DDG", 6, 0, "Group", "Yes", "LogisticsEnthusiast", "FFT"],
  ["EL2-GW1-05", 2, "British Premier", "GW1", "2024-11-12", "Newport", "Stanford", 7, 1, "Group", "Yes", "VoidLDN", "FFT after mercy"],
  ["SI2-GW1-02", 2, "Serie Italia", "GW1", "2024-11-13", "Tretorre", "Sassari", 0, 3, "Group", "Yes", "wiz", "FFT"],
  ["EL2-GW2-01", 2, "British Premier", "GW2", "2024-11-18", "Newham", "Andover", 4, 0, "Group", "No", "Koolicxcte"],
  ["EL2-GW2-02", 2, "British Premier", "GW2", "2024-11-19", "Nottingham", "Canterbury", 6, 4, "Group", "No", "Deleted User"],
  ["EL2-GW2-03", 2, "British Premier", "GW2", "2024-11-19", "Milton", "Stanford", 7, 4, "Group", "No", "semihgnys"],
  ["EL2-GW2-04", 2, "Serie Italia", "GW2", "2024-11-19", "Cartiginia", "DDG", 6, 0, "Group", "Mercy", "Deleted User", "Mercy rule"],
  ["EL2-GW2-05", 2, "British Premier", "GW2", "2024-11-19", "Newport", "Eltham", 2, 5, "Group", "No", "wiz"],
  ["SI2-GW1-03", 2, "Serie Italia", "GW1", "2024-11-21", "Sassari", "Venezia", 0, 3, "Group", "Yes", "wiz", "FFT"],
  ["SI2-GW2-01", 2, "Serie Italia", "GW2", "2024-11-21", "Milano", "Casole", 4, 2, "Group", "No", "Koolicxcte"],
  ["SI2-GW2-02", 2, "Serie Italia", "GW2", "2024-11-23", "Viola", "Tretorre", 0, 0, "Group", "Yes", "wiz", "FFT - 0-0"],
  ["SI2-GW3-01", 2, "Serie Italia", "GW3", "2024-11-23", "Casole", "Cartiginia", 6, 0, "Group", "Mercy", "LogisticsEnthusiast", "FFT after mercy"],
  ["EL2-GW3-01", 2, "British Premier", "GW3", "2024-11-23", "Newham", "Stanford", 9, 3, "Group", "No", "Koolicxcte", "Includes 1 OG by EdinDzeko1983"],
  ["SI2-GW2-03", 2, "Serie Italia", "GW2", "2024-11-24", "Sassari", "Viola", 3, 0, "Group", "Yes", "wiz", "FFT"],
  ["EL2-GW3-02", 2, "British Premier", "GW3", "2024-11-24", "Newport", "Canterbury", 6, 0, "Group", "Mercy", "TheMightyLion132", "Mercy rule"],
  ["EL2-GW3-03", 2, "British Premier", "GW3", "2024-11-24", "Andover", "Eltham", 0, 6, "Group", "Mercy", "Koolicxcte", "Mercy rule"],
  ["EL2-GW3-04", 2, "British Premier", "GW3", "2024-11-24", "Milton", "Nottingham", 4, 3, "Group", "No", "ahmed"],
  ["SI2-GW3-02", 2, "Serie Italia", "GW3", "2024-11-30", "Milano", "Venezia", 4, 5, "Group", "No", "Koolicxcte", "Started from 1-0 (carried over)"],
  ["BP2-GW4-01", 2, "British Premier", "GW4", "2024-12-01", "Nottingham", "Andover", 0, 6, "Group", "No", "BloxBurgPOS"],
  ["SI2-GW4-01", 2, "Serie Italia", "GW4", "2024-12-01", "Casole", "Venezia", 5, 1, "Group", "No", "BloxBurgPOS"],
  ["SI2-GW4-02", 2, "Serie Italia", "GW4", "2024-12-01", "Tretorre", "Cartiginia", 2, 5, "Group", "No", "Koolicxcte"],
  ["SI2-GW4-03", 2, "Serie Italia", "GW4", "2024-12-01", "Sassari", "Milano", 3, 0, "Group", "Yes", "wiz", "FFT"],
  ["BP2-GW4-02", 2, "British Premier", "GW4", "2024-12-04", "Newport", "Newham", 0, 0, "Group", "No", "—", "No detailed stats provided"],
  ["BP2-GW5-01", 2, "British Premier", "GW5", "2024-12-07", "Canterbury", "Newham", 0, 3, "Group", "Yes", "—", "FFT"],
  ["SI2-GW5-01", 2, "Serie Italia", "GW5", "2024-12-07", "Tretorre", "Casole", 2, 6, "Group", "No", "BloxBurgPOS"],
  ["GW5-NPA", 2, "—", "GW5", "2024-12-14", "Newport", "Andover", 3, 0, "Group", "Yes", "—", "FFT"],

  ["BP2-NTF-09", 2, "British Premier", "GW4", "2024-11-30", "Eltham", "Nottingham", 3, 0, "Group", "Yes", "—", "FFT - Nottingham disbanded late November 2024"],
  ["BP2-NTF-14", 2, "British Premier", "GW4", "2024-11-30", "Newport", "Nottingham", 3, 0, "Group", "Yes", "—", "FFT - Nottingham disbanded late November 2024"],
  ["BP2-NTF-22", 2, "British Premier", "GW4", "2024-11-30", "Nottingham", "Stanford", 0, 3, "Group", "Yes", "—", "FFT - Nottingham disbanded late November 2024"],

  ["BP2-MA-01", 2, "British Premier", "GW5", "2024-12-10", "Milton", "Andover", 3, 0, "Group", "Yes", "—", "FFT - Date approximate"],
  ["BP2-MC-01", 2, "British Premier", "GW5", "2024-12-10", "Milton", "Canterbury", 5, 5, "Group", "No", "—", "Date approximate — events estimated from other S2 squad lists (no sheet)"],
  ["BP2-EN-01", 2, "British Premier", "GW5", "2024-12-10", "Eltham", "Newham", 0, 0, "Group", "No", "—", "Game never played - recorded as 0-0"],
  ["BP2-EC-01", 2, "British Premier", "GW5", "2024-12-10", "Eltham", "Canterbury", 3, 0, "Group", "Yes", "—", "FFT - Date approximate"],
  ["BP2-ES-01", 2, "British Premier", "GW5", "2024-12-10", "Eltham", "Stanford", 3, 0, "Group", "Yes", "—", "FFT - Date approximate"],
  ["BP2-AS-01", 2, "British Premier", "GW5", "2024-12-10", "Andover", "Stanford", 0, 0, "Group", "No", "—", "Date approximate"],
  ["BP2-CS-01", 2, "British Premier", "GW5", "2024-12-10", "Canterbury", "Stanford", 5, 0, "Group", "No", "—", "Date approximate — events estimated from other S2 squad lists (no sheet)"],

  ["SI2-MT-01", 2, "Serie Italia", "GW5", "2024-12-12", "Milano", "Tretorre", 4, 0, "Group", "No", "—", "Date approximate — events estimated from other S2 Serie Italia rosters"],
  ["SI2-MV-01", 2, "Serie Italia", "GW5", "2024-12-12", "Milano", "Viola", 3, 0, "Group", "Yes", "—", "FFT - Date approximate"],
  ["SI2-MCA-01", 2, "Serie Italia", "GW5", "2024-12-12", "Milano", "Cartiginia", 1, 3, "Group", "No", "—", "Date approximate — events estimated from other S2 Serie Italia rosters"],
  ["SI2-DT-01", 2, "Serie Italia", "GW5", "2024-12-12", "DDG", "Tretorre", 0, 3, "Group", "Yes", "—", "FFT - DDG forfeited - Date approximate"],
  ["SI2-DS-01", 2, "Serie Italia", "GW5", "2024-12-12", "DDG", "Sassari", 0, 0, "Group", "No", "—", "Date approximate — 0-0; no lineups in sheet (No Stats row only)"],
  ["SI2-DC-01", 2, "Serie Italia", "GW5", "2024-12-12", "DDG", "Casole", 0, 3, "Group", "Yes", "—", "FFT - DDG forfeited - Date approximate"],
  ["SI2-DV-01", 2, "Serie Italia", "GW5", "2024-12-12", "DDG", "Viola", 0, 3, "Group", "Yes", "—", "FFT - DDG forfeited - Date approximate"],
  ["SI2-DVE-01", 2, "Serie Italia", "GW5", "2024-12-12", "DDG", "Venezia", 0, 3, "Group", "Yes", "—", "FFT - DDG forfeited - Date approximate"],
  ["SI2-TVE-01", 2, "Serie Italia", "GW5", "2024-12-12", "Tretorre", "Venezia", 1, 5, "Group", "No", "—", "Date approximate — events estimated from other S2 Serie Italia rosters"],
  ["SI2-SC-01", 2, "Serie Italia", "GW5", "2024-12-12", "Sassari", "Casole", 0, 3, "Group", "Yes", "—", "FFT - Date approximate"],
  ["SI2-SCA-01", 2, "Serie Italia", "GW5", "2024-12-12", "Sassari", "Cartiginia", 0, 3, "Group", "Yes", "—", "FFT - Date approximate"],
  ["SI2-VCA-01", 2, "Serie Italia", "GW5", "2024-12-12", "Viola", "Cartiginia", 0, 3, "Group", "No", "—", "Date approximate — events estimated from other S2 Serie Italia rosters"],
  ["SI2-VVE-01", 2, "Serie Italia", "GW5", "2024-12-12", "Viola", "Venezia", 0, 6, "Group", "No", "—", "Date approximate — events estimated from other S2 Serie Italia rosters"],
];

export const matches: MatchRecord[] = RAW.map(
  ([id, season, competition, gw, date, home, away, hs, as_, stage, fft, ref, notes]) => ({
    id,
    season,
    competition,
    gameWeek: gw,
    date,
    homeTeam: home,
    homeSlug: slugFor(home),
    homeScore: hs,
    awayTeam: away,
    awaySlug: slugFor(away),
    awayScore: as_,
    stage,
    fft,
    referee: ref,
    notes: notes ?? "",
  }),
).sort((a, b) =>
  a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date),
);
