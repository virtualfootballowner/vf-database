import { redirect } from "next/navigation";

// Roblox OAuth is pending app review — this step is temporarily disabled.
// Anyone who lands here gets sent straight to the Discord step.
export default function CreatorRobloxStepDisabled() {
  redirect("/content/creators/onboard/discord");
}
