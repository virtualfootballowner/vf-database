import { redirect } from "next/navigation";

export default function WorldCupTournamentRedirect() {
  redirect("/stats/tournaments");
}
