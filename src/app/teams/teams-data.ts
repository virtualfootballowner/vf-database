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
    logo: "/NOTTINGHAM RANGERS.png",
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
    name: "Dover FC",
    short: "DFC",
    slug: "dover-fc",
    logo: "/dover_logo.png",
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
    logo: "/NEWPORT WANDERERS FC.png",
    form: "League squad",
    seasons: [1, 2],
  },
];

export function getTeamBySlug(slug: string): Team | undefined {
  return teams.find((team) => team.slug === slug);
}
