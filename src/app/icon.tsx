import { vfCircleIconResponse } from "@/lib/vf-circle-icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  return vfCircleIconResponse(64);
}
