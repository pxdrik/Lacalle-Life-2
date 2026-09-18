import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp } from "./theme";

/** Fundo do comercial: preto profundo, brilho Verdant que respira e vinheta. */
export const Backdrop: FC<{ glowFrom: number; glowTo: number }> = ({ glowFrom, glowTo }) => {
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [glowFrom, glowTo], [0, 1], clamp);
  const drift = Math.sin(frame / 70) * 40;

  return (
    <AbsoluteFill style={{ background: C.deep }}>
      <AbsoluteFill
        style={{
          opacity: glow,
          background: `radial-gradient(58% 42% at ${50 + drift / 20}% 66%, rgba(79,190,134,0.20), rgba(79,190,134,0.05) 55%, transparent 75%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, transparent 50%, rgba(0,0,0,0.62) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Grão de filme por cima de todo o quadro. */
export const Grain: FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity: 0.18 }}
    >
      <filter id="grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves={2}
          seed={Math.floor(frame / 2)}
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
};
