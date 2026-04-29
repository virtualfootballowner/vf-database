import { vfCircleIconResponse } from "@/lib/vf-circle-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return vfCircleIconResponse(180);
}
