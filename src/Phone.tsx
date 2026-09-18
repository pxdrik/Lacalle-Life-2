import type { CSSProperties, FC, ReactNode } from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BEZEL, C, PHONE_ASPECT, clamp, ease } from "./theme";

/** Moldura do aparelho. A tela recebe as capturas reais do app, sem retoque. */
export const Phone: FC<{ screenW: number; children: ReactNode; style?: CSSProperties }> = ({
  screenW,
  children,
  style,
}) => {
  const screenH = screenW * PHONE_ASPECT;
  return (
    <div
      style={{
        position: "absolute",
        width: screenW + BEZEL * 2,
        height: screenH + BEZEL * 2,
        borderRadius: screenW * 0.118,
        background: "#000",
        border: "2px solid #2b3138",
        boxShadow:
          "0 0 0 1px #07090a, 0 70px 140px rgba(0,0,0,0.65), 0 0 180px rgba(79,190,134,0.10)",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: BEZEL,
          borderRadius: screenW * 0.098,
          overflow: "hidden",
          background: C.canvas,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const shot = (name: string) => staticFile(`shots/${name}.png`);

/** Faz o filho aparecer com fade a partir de `at` (frame local); `fade` 0 = já visível. */
export const Fade: FC<{ at?: number; fade?: number; children: ReactNode }> = ({ at = 0, fade = 8, children }) => {
  const frame = useCurrentFrame();
  const opacity = fade === 0 ? 1 : interpolate(frame, [at, at + fade], [0, 1], clamp);
  return <div style={{ position: "absolute", inset: 0, opacity }}>{children}</div>;
};

/** Uma captura de tela inteira, com fade de entrada opcional. */
export const Shot: FC<{ name: string; at?: number; fade?: number }> = ({ name, at = 0, fade = 8 }) => (
  <Fade at={at} fade={fade}>
    <Img src={shot(name)} style={{ width: "100%", height: "100%", display: "block" }} />
  </Fade>
);

/** Captura alta que rola dentro da tela; `scroll` em px CSS do viewport de 430. */
export const Scroller: FC<{ name: string; nav: string; scroll: number; screenW: number }> = ({
  name,
  nav,
  scroll,
  screenW,
}) => (
  <>
    <Img
      src={shot(name)}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        transform: `translateY(${-scroll * (screenW / 430)}px)`,
      }}
    />
    <Img
      src={shot(nav)}
      style={{ position: "absolute", left: 0, bottom: 0, width: "100%" }}
    />
  </>
);

/** Toque: anel que abre e some, com um ponto de pressão. Posição relativa à tela (0..1). */
export const Tap: FC<{ x: number; y: number; at: number; screenW: number }> = ({ x, y, at, screenW }) => {
  const frame = useCurrentFrame();
  const screenH = screenW * PHONE_ASPECT;
  const t = frame - at;
  if (t < -6 || t > 22) return null;
  const press = interpolate(t, [-6, 0, 12], [0, 1, 0], { ...clamp, easing: ease });
  const ring = interpolate(t, [0, 20], [0, 1], { ...clamp, easing: ease });
  const r = screenW * 0.05;
  return (
    <div style={{ position: "absolute", left: x * screenW, top: y * screenH, width: 0, height: 0 }}>
      <div
        style={{
          position: "absolute",
          width: r * 1.5,
          height: r * 1.5,
          left: -r * 0.75,
          top: -r * 0.75,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.30)",
          transform: `scale(${0.7 + press * 0.3})`,
          opacity: press,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: r * 2.4,
          height: r * 2.4,
          left: -r * 1.2,
          top: -r * 1.2,
          borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.65)",
          transform: `scale(${0.5 + ring * 1.1})`,
          opacity: (1 - ring) * 0.9,
        }}
      />
    </div>
  );
};
