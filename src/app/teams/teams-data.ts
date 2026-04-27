export type Team = {
  name: string;
  short: string;
  slug: string;
  logo: string | null;
  form: string;
  seasons: number[];
};

export const teams: Team[] = [
  {
    name: "Milton Town FC",
    short: "MTF",
    slug: "milton-town-fc",
    logo: "/MILTOWN TOWN FC.png",
    form: "League squad",
    seasons: [1, 2],
  },
  {
    name: "Newham United",
    short: "NEW",
    slug: "newham-united",
    logo: "/NEWHAM UNITED.png",
    form: "League squad",
    seasons: [1, 2],
  },
  {
    name: "Nottingham Rangers",
    short: "NTR",
    slug: "nottingham-rangers",
    logo: "/Nottingam Rangers FC.png",
    form: "League squad",
    seasons: [1, 2],
  },
  {
    name: "Canterbury FC",
    short: "CFC",
    slug: "canterbury-fc",
    logo: "/canterbury FC.png",
    form: "League squad",
    seasons: [1, 2],
  },
  {
    name: "Andover FC",
    short: "AFC",
    slug: "andover-fc",
    logo: "/Andover FC.png",
    form: "League squad",
    seasons: [1, 2],
  },
  {
    name: "Eltham United",
    short: "ELT",
    slug: "eltham-united",
    logo: "/ELTHAM UNITED.png",
    form: "League squad",
    seasons: [1, 2],
  },
  {
    name: "Newport Wanderers FC",
    short: "NPW",
    slug: "newport-wanderers-fc",
    logo: "/Newport Wanderers FC.png",
    form: "League squad",
    seasons: [1, 2],
  },
  {
    name: "Stanford FC",
    short: "STF",
    slug: "stanford-fc",
    logo: "/Stanford FC.png",
    form: "League squad",
    seasons: [1, 2],
  },
  {
    name: "Deportivo Di Gnoa",
    short: "DDG",
    slug: "deportivo-di-gnoa",
    logo: "/Deportivo Di Gnoa.png",
    form: "League squad",
    seasons: [2],
  },
  {
    name: "AC Casole",
    short: "ACC",
    slug: "ac-casole",
    logo: "/AC Casole.png",
    form: "League squad",
    seasons: [2],
  },
  {
    name: "Tre Torre Libertas FC",
    short: "TTL",
    slug: "tre-torre-libertas-fc",
    logo: "/Tre Torre Libertas FC.png",
    form: "League squad",
    seasons: [2],
  },
  {
    name: "Venezia A.C.",
    short: "VEN",
    slug: "venezia-ac",
    logo: "/Venezia A.C..png",
    form: "League squad",
    seasons: [2],
  },
  {
    name: "Cartigiana FC",
    short: "CAR",
    slug: "cartigiana-fc",
    logo: "/Cartigiana FC.png",
    form: "League squad",
    seasons: [2],
  },
  {
    name: "Viola FC",
    short: "VIO",
    slug: "viola-fc",
    logo: "/Viola FC.png",
    form: "League squad",
    seasons: [2],
  },
  {
    name: "Sassari Calcio",
    short: "SAS",
    slug: "sassari-calcio",
    logo: "/Sassari Calcio.png",
    form: "League squad",
    seasons: [2],
  },
  {
    name: "Ambasciatori Milano",
    short: "AMB",
    slug: "ambasciatori-milano",
    logo: "/Ambasciatori Milano.png",
    form: "League squad",
    seasons: [2],
  },
];

export function getTeamBySlug(slug: string): Team | undefined {
  return teams.find((team) => team.slug === slug);
}
