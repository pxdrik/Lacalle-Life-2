import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { BEZEL, C, FONT, PHONE_ASPECT, clamp, ease, easeOutBack, useLayout } from "./theme";

/**
 * Recompensa: uma pílula com um número em destaque que "pinga" sobre o cabeçalho do aparelho,
 * segura e sai. Tem que ser montada dentro de uma Sequence (usa o quadro local).
 */
export const Callout: FC<{ value: string; label: string; dur: number }> = ({ value, label, dur }) => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const pop = interpolate(frame, [0, 10], [0.55, 1], { ...clamp, easing: easeOutBack });
  const o = interpolate(frame, [0, 4, dur - 8, dur], [0, 1, 1, 0], clamp);
  const s = pop * (1 - 0.1 * interpolate(frame, [dur - 8, dur], [0, 1], clamp));
  const cx = L.phoneX + (L.screenW + BEZEL * 2) / 2;
  const top = L.portrait ? L.phoneY + 6 : L.phoneY + 26;
  const big = L.portrait ? 62 : 44;
  const small = L.portrait ? 36 : 26;
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top,
        opacity: o,
        transform: `translateX(-50%) scale(${s})`,
        transformOrigin: "50% 50%",
        display: "flex",
        alignItems: "baseline",
        gap: L.portrait ? 18 : 12,
        whiteSpace: "nowrap",
        padding: L.portrait ? "20px 44px" : "14px 30px",
        borderRadius: 999,
        background: "rgba(11,13,15,0.94)",
        border: `2px solid ${C.accent}`,
        boxShadow: "0 0 70px rgba(79,190,134,0.38), 0 18px 50px rgba(0,0,0,0.55)",
        fontFamily: FONT,
      }}
    >
      <span style={{ fontSize: big, fontWeight: 700, color: C.accent, letterSpacing: "-0.02em" }}>{value}</span>
      <span style={{ fontSize: small, fontWeight: 500, color: C.ink }}>{label}</span>
    </div>
  );
};

/** Estouro de um check: anel que abre e oito pontos que saem do botão. Dentro da tela do aparelho. */
export const Burst: FC<{ x: number; y: number; at: number; screenW: number }> = ({ x, y, at, screenW }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 20) return null;
  const screenH = screenW * PHONE_ASPECT;
  const p = interpolate(t, [0, 18], [0, 1], { ...clamp, easing: ease });
  const r = screenW * 0.05;
  return (
    <div style={{ position: "absolute", left: x * screenW, top: y * screenH, width: 0, height: 0 }}>
      <div
        style={{
          position: "absolute",
          width: r * 2,
          height: r * 2,
          left: -r,
          top: -r,
          borderRadius: "50%",
          border: `4px solid ${C.accent}`,
          transform: `scale(${0.4 + p * 2.1})`,
          opacity: (1 - p) * 0.95,
        }}
      />
      {Array.from({ length: 8 }, (_, k) => {
        const a = (k * Math.PI) / 4 + 0.2;
        const d = r * (1.1 + p * 2.2);
        const s = r * 0.32 * (1 - p * 0.8);
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              width: s * 2,
              height: s * 2,
              left: Math.cos(a) * d - s,
              top: Math.sin(a) * d - s,
              borderRadius: "50%",
              background: C.accent,
              opacity: 1 - p,
            }}
          />
        );
      })}
    </div>
  );
};

/** Brilho verde no fundo, que estoura e some a cada recompensa. Usa o quadro global. */
export const Flash: FC<{ frames: readonly number[] }> = ({ frames }) => {
  const frame = useCurrentFrame();
  const o = Math.min(0.34, frames.reduce((s, f) => s + (frame >= f ? 0.2 * Math.exp(-(frame - f) / 6) : 0), 0));
  if (o < 0.005) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: o,
        background: "radial-gradient(62% 44% at 50% 62%, rgba(79,190,134,0.55), rgba(79,190,134,0.12) 55%, transparent 76%)",
      }}
    />
  );
};

/**
 * Botão do CTA: aparece com "pop", pulsa chamando o toque, e é "tocado" (afunda e solta uma
 * onda). `frame` é o quadro local da cena de fechamento.
 */
export const CtaButton: FC<{ frame: number; pop: number; press: number; portrait: boolean }> = ({ frame, pop, press, portrait }) => {
  const w = portrait ? 800 : 700;
  const h = portrait ? 124 : 112;
  const appear = interpolate(frame, [pop, pop + 14], [0.6, 1], { ...clamp, easing: easeOutBack });
  const o = interpolate(frame, [pop, pop + 6], [0, 1], clamp);
  const dip = interpolate(frame, [press, press + 4, press + 12], [1, 0.94, 1], clamp);
  // pulso: um anel que abre a cada 34 quadros, até o toque
  const pt = (frame - pop - 14) % 34;
  const pulse = frame > pop + 14 && frame < press ? pt / 34 : -1;
  const rip = interpolate(frame, [press, press + 16], [0, 1], clamp);
  return (
    <div style={{ position: "relative", width: w, height: h, opacity: o, transform: `scale(${appear * dip})`, transformOrigin: "left center" }}>
      {pulse >= 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            border: `3px solid ${C.accent}`,
            opacity: (1 - pulse) * 0.6,
            transform: `scale(${1 + pulse * 0.22})`,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: C.accent,
          boxShadow: "0 0 80px rgba(79,190,134,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: portrait ? 50 : 44,
          letterSpacing: "-0.01em",
          color: "#0b0d0f",
          overflow: "hidden",
        }}
      >
        Experimentar agora
        <svg width={portrait ? 44 : 38} height={portrait ? 44 : 38} viewBox="0 0 24 24" fill="none" stroke="#0b0d0f" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ transform: `translateX(${(1 - o) * -10 + Math.sin(frame / 5) * 3}px)` }}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        {frame >= press && frame <= press + 16 ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: h * 1.4,
              height: h * 1.4,
              marginLeft: -h * 0.7,
              marginTop: -h * 0.7,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.55)",
              transform: `scale(${rip * 3.2})`,
              opacity: (1 - rip) * 0.55,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
