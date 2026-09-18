import { loadFont } from "@remotion/fonts";
import { continueRender, delayRender, staticFile } from "remotion";

const handle = delayRender("IBM Plex Sans");

Promise.all(
  (["400", "500", "600", "700"] as const).map((weight) =>
    loadFont({
      family: "IBM Plex Sans",
      url: staticFile(`fonts/ibm-plex-sans-latin-${weight}-normal.woff2`),
      weight,
    }),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    throw err;
  });
