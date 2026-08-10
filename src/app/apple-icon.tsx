import { ImageResponse } from "next/og";

/**
 * The home screen icon on iOS.
 *
 * iOS ignores the manifest's icons and reads `apple-touch-icon`, and it will
 * not take an SVG. Without this, adding the app to a home screen produces a
 * screenshot of whatever page happened to be open — which is how a PWA
 * announces that nobody tested installing it.
 *
 * Generated rather than committed as a binary: the mark is nine characters of
 * path data, and a PNG in the repository is a second copy of the artwork that
 * drifts from `icon.svg` the first time either changes.
 *
 * No rounded corners here, unlike `icon.svg`. iOS applies its own mask, and
 * corners baked into the image show up as a rounded square floating inside
 * the system's own rounding.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 32 32">
          <path d="M11 7h4.6v13.4H22V25H11z" fill="#ffffff" />
        </svg>
      </div>
    ),
    size,
  );
}
