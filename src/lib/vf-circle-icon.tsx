import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

const VF_BLUE = "#083696";
const LOGO_FILE = join(process.cwd(), "public", "vf logo.png");

async function logoDataUrl(): Promise<string> {
  const buf = await readFile(LOGO_FILE);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export async function vfCircleIconResponse(sizePx: number): Promise<ImageResponse> {
  const src = await logoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          /*
           * Circular emblem: background fills a rounded full-bleed square so the
           * portrait logo crops cleanly inside the circle.
           */
          width: sizePx,
          height: sizePx,
          borderRadius: sizePx / 2,
          backgroundColor: VF_BLUE,
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "50% 30%",
          backgroundRepeat: "no-repeat",
        }}
      />
    ),
    { width: sizePx, height: sizePx },
  );
}
