import type { CSSProperties, FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { MARK_PATH, MARK_VIEWBOX } from "./brand";
import { C, FONT, clamp, ease, easeIn, easeOutBack, useLayout } from "./theme";

/** Quadros que uma palavra leva para subir, desfocar e assentar. */
const REVEAL = 18;

/** Palavra por palavra: sobe, desfoca e assenta, na curva do Motion System. */
export const Words: FC<{
  text: string;
  start?: number;
  stagger?: number;
  size: number;
  weight?: number;
  color?: string;
  lineHeight?: number;
  style?: CSSProperties;
}> = ({ text, start = 0, stagger = 3, size, weight = 700, color = C.ink, lineHeight = 1.06, style }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: weight,
        lineHeight,
        color,
        letterSpacing: size > 60 ? "-0.02em" : "-0.005em",
        ...style,
      }}
    >
      {text.split(" ").map((word, i) => {
        const p = interpolate(frame, [start + i * stagger, start + i * stagger + REVEAL], [0, 1], {
          ...clamp,
          easing: ease,
        });
        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              marginRight: "0.26em",
              opacity: p,
              transform: `translateY(${(1 - p) * 34}px)`,
              filter: `blur(${(1 - p) * 10}px)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

/** Texto que estoura: entra grande, passa um pouco do tamanho e assenta em ~9 quadros. Para o gancho. */
export const Slam: FC<{
  text: string;
  start: number;
  size: number;
  from?: number;
  weight?: number;
  color?: string;
  style?: CSSProperties;
}> = ({ text, start, size, from = 1.35, weight = 600, color = C.ink, style }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + 9], [0, 1], { ...clamp, easing: easeOutBack });
  const o = interpolate(frame, [start, start + 3], [0, 1], clamp);
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.06,
        letterSpacing: size > 60 ? "-0.02em" : "-0.005em",
        color,
        whiteSpace: "nowrap",
        opacity: o,
        transformOrigin: "left center",
        transform: `scale(${from - (from - 1) * p})`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

/** Símbolo oficial (Proposta 01) + wordmark "LaCalle Life", como no cabeçalho do app. */
export const Lockup: FC<{ size: number; style?: CSSProperties }> = ({ size, style }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.32, ...style }}>
    <svg height={size} viewBox={MARK_VIEWBOX} style={{ display: "block", overflow: "visible" }}>
      <path d={MARK_PATH} fill={C.ink} />
    </svg>
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size * 0.86,
        letterSpacing: "-0.02em",
        color: C.ink,
        lineHeight: 1,
      }}
    >
      LaCalle <span style={{ color: C.accent }}>Life</span>
    </div>
  </div>
);

/** Título + apoio de uma cena, posicionados pelo layout (retrato ou paisagem). */
export const Headline: FC<{ title: string; sub?: string; dur: number }> = ({ title, sub, dur }) => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const out = interpolate(frame, [dur - 12, dur], [1, 0], { ...clamp, easing: easeIn });
  return (
    <div
      style={{
        position: "absolute",
        left: L.textX,
        top: L.textY,
        width: L.textW,
        opacity: out,
        transform: `translateY(${(1 - out) * -24}px)`,
      }}
    >
      <Words text={title} size={L.h1} />
      {sub ? (
        <Words
          text={sub}
          start={10}
          stagger={1.5}
          size={L.body}
          weight={400}
          color={C.muted}
          lineHeight={1.3}
          style={{ marginTop: 26, maxWidth: L.portrait ? 900 : 760 }}
        />
      ) : null}
    </div>
  );
};
