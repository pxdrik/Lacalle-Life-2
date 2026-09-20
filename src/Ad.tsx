import type { FC } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import taps from "../public/shots/taps.json";
import "./fonts";
import { AudioTrack } from "./audio/AudioTrack";
import { DEFAULT_AUDIO_PROFILE, DEFAULT_AUDIO_VERSION, type AudioProfile, type AudioVersion } from "./audio/config";
import { Backdrop, Grain } from "./Backdrop";
import { Fade, Phone, Scroller, Shot, Tap } from "./Phone";
import { Headline, Lockup, Words } from "./Text";
import { BEZEL, C, FONT, clamp, ease, easeIn, easeInOut, useLayout } from "./theme";

/** Trocar aqui quando o endereço final de divulgação for outro. */
const CTA_URL = "lacalle-life-2.vercel.app";

/** Tempo extra: a tela Diário fica visível antes do primeiro toque e a tela Hoje ("quanto ainda cabe no dia") segura mais. */
const PRE_TAP = 12;
const HOJE_HOLD = 24;
const X = PRE_TAP + HOJE_HOLD;
export const DURATION = 900 + X;
export const FPS = 30;

// ---------------------------------------------------------------------------
// 1. Gancho: três apps para três coisas.
// ---------------------------------------------------------------------------
const Hook: FC = () => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const lines = ["Um app para a dieta.", "Outro para o treino.", "Outro para a evolução."];
  const out = interpolate(frame, [86, 102], [1, 0], { ...clamp, easing: easeIn });
  const top = L.portrait ? 620 : 300;
  return (
    <div
      style={{
        position: "absolute",
        left: L.textX,
        top,
        opacity: out,
        transform: `translateY(${(1 - out) * -30}px)`,
      }}
    >
      {lines.map((line, i) => (
        <div key={line} style={{ display: "flex", alignItems: "baseline", gap: 28, marginBottom: 46 }}>
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 500,
              fontSize: 30,
              color: C.accent,
              opacity: interpolate(frame, [6 + i * 22, 22 + i * 22], [0, 1], clamp),
            }}
          >
            0{i + 1}
          </span>
          <Words text={line} start={6 + i * 22} size={L.portrait ? 84 : 96} weight={600} color={i === 2 ? C.ink : "#cfd4da"} />
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. Abertura da marca.
// ---------------------------------------------------------------------------
const LogoReveal: FC = () => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const p = interpolate(frame, [0, 26], [0, 1], { ...clamp, easing: ease });
  const out = interpolate(frame, [66, 84], [1, 0], { ...clamp, easing: easeIn });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: out,
        transform: `scale(${1 + (1 - out) * 0.04})`,
      }}
    >
      <div style={{ opacity: p, transform: `scale(${0.9 + p * 0.1})`, filter: `blur(${(1 - p) * 14}px)` }}>
        <Lockup size={L.portrait ? 116 : 150} />
      </div>
      <div style={{ marginTop: 56 }}>
        <Words text="Agora, um só." start={30} size={L.portrait ? 60 : 72} weight={500} color={C.muted} />
      </div>
    </AbsoluteFill>
  );
};

/** Marca pequena no canto, presente durante as cenas do produto. */
const TopLogo: FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const o = interpolate(frame, [0, 16, dur - 16, dur], [0, 1, 1, 0], clamp);
  return <Lockup size={44} style={{ position: "absolute", left: L.logoX, top: L.logoY, opacity: o }} />;
};

// ---------------------------------------------------------------------------
// 3. O aparelho: um só, com as telas reais trocando dentro dele.
// ---------------------------------------------------------------------------
const Stage: FC = () => {
  const f = useCurrentFrame();
  const L = useLayout();
  const { screenW } = L;

  const enter = interpolate(f, [0, 44], [0, 1], { ...clamp, easing: ease });
  const exit = interpolate(f, [610 + X, 636 + X], [0, 1], { ...clamp, easing: easeIn });
  const y = (1 - enter) * 640 + exit * 820;
  const tilt = (1 - enter) * 16;
  const scale = 1 + (f / (640 + X)) * 0.05;
  const yaw = Math.sin(f / 110) * 2.4 * enter;
  const o = interpolate(f, [0, 14], [0, 1], clamp) * (1 - exit);

  const dietScroll = interpolate(f, [34, 122], [0, 880], { ...clamp, easing: easeInOut });
  const evoScroll = interpolate(f - (414 + X), [40, 100, 116, 182], [0, 1400, 1400, 2150], { ...clamp, easing: easeInOut });

  return (
    <AbsoluteFill style={{ perspective: 2600 }}>
      <div
        style={{
          position: "absolute",
          left: L.phoneX,
          top: L.phoneY,
          width: screenW + BEZEL * 2,
          height: L.screenH + BEZEL * 2,
          opacity: o,
          transformOrigin: "50% 40%",
          transform: `translateY(${y}px) rotateX(${tilt}deg) rotateY(${yaw}deg) scale(${scale})`,
        }}
      >
        <Phone screenW={screenW} style={{ left: 0, top: 0 }}>
          {/* dieta: rola pelas refeições */}
          <Sequence from={0} durationInFrames={134}>
            <Scroller name="dieta-tall" nav="nav-mais" scroll={dietScroll} screenW={screenW} />
          </Sequence>

          {/* diário: marca café e almoço; depois o Hoje mostra o que resta */}
          <Sequence from={124} durationInFrames={118 + X}>
            <Shot name="diario-0" />
            <Shot name="diario-1" at={34 + PRE_TAP} fade={4} />
            <Shot name="diario-2" at={64 + PRE_TAP} fade={4} />
            <Shot name="hoje-2" at={94 + PRE_TAP} fade={12} />
            <Tap {...taps.diarioCafe} at={30 + PRE_TAP} screenW={screenW} />
            <Tap {...taps.diarioAlmoco} at={60 + PRE_TAP} screenW={screenW} />
          </Sequence>

          {/* treino: três séries marcadas, descanso correndo */}
          <Sequence from={234 + X} durationInFrames={188}>
            <Shot name="sessao-0" />
            <Shot name="sessao-1" at={46} fade={4} />
            <Shot name="sessao-2" at={86} fade={4} />
            <Shot name="sessao-3" at={126} fade={4} />
            <Tap {...taps.sessao1} at={40} screenW={screenW} />
            <Tap {...taps.sessao2} at={80} screenW={screenW} />
            <Tap {...taps.sessao3} at={120} screenW={screenW} />
          </Sequence>

          {/* evolução: gráfico, volume semanal, recordes */}
          <Sequence from={414 + X} durationInFrames={214}>
            <Fade at={0} fade={10}>
              <Scroller name="evolucao-tall" nav="nav-evolucao" scroll={evoScroll} screenW={screenW} />
            </Fade>
          </Sequence>
        </Phone>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 4. Fechamento.
// ---------------------------------------------------------------------------
const Close: FC = () => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const dim = interpolate(frame, [48, 62], [1, 0.32], { ...clamp, easing: ease });
  const cta = interpolate(frame, [88, 108], [0, 1], { ...clamp, easing: ease });
  const top = L.portrait ? 520 : 140;
  const size = L.portrait ? 64 : 76;
  return (
    <div style={{ position: "absolute", left: L.textX, top, width: L.portrait ? L.textW + 60 : 1500 }}>
      <div style={{ opacity: dim }}>
        <Words text="Monte dietas." start={2} size={size} weight={600} color="#cfd4da" style={{ marginBottom: 8 }} />
        <Words text="Monte treinos." start={12} size={size} weight={600} color="#cfd4da" style={{ marginBottom: 8 }} />
        <Words text="Acompanhe sua evolução." start={22} size={size} weight={600} color="#cfd4da" />
      </div>
      <Words
        text="Tudo em um lugar só."
        start={54}
        stagger={3}
        size={L.portrait ? 88 : 124}
        weight={700}
        color={C.accent}
        style={{ marginTop: L.portrait ? 64 : 48 }}
      />
      <div
        style={{
          marginTop: L.portrait ? 96 : 64,
          opacity: cta,
          transform: `translateY(${(1 - cta) * 26}px)`,
        }}
      >
        <Lockup size={L.portrait ? 64 : 76} />
        <div style={{ fontFamily: FONT, fontSize: L.portrait ? 40 : 46, fontWeight: 500, color: C.ink, marginTop: 30 }}>
          Comece sem criar conta.
        </div>
        <div style={{ fontFamily: FONT, fontSize: L.portrait ? 32 : 36, fontWeight: 400, color: C.muted, marginTop: 12 }}>
          {CTA_URL}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Linha do tempo (30 fps, 900 frames = 30 s)
// ---------------------------------------------------------------------------
export interface AdProps {
  /** "v1" = trilha provisória; "v2" = stems novos (src/audio). Só o áudio muda. */
  audio?: AudioVersion;
  profile?: AudioProfile;
}

export const Ad: FC<AdProps> = ({ audio = DEFAULT_AUDIO_VERSION, profile = DEFAULT_AUDIO_PROFILE }) => {
  const frame = useCurrentFrame();
  const vol = interpolate(frame, [0, 24, 860 + X, 900 + X], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: C.deep }}>
      <Backdrop glowFrom={96} glowTo={160} />

      <Sequence from={0} durationInFrames={104}>
        <Hook />
      </Sequence>
      <Sequence from={98} durationInFrames={84}>
        <LogoReveal />
      </Sequence>

      <Sequence from={158} durationInFrames={620 + X}>
        <TopLogo dur={620 + X} />
      </Sequence>
      <Sequence from={168} durationInFrames={640 + X}>
        <Stage />
      </Sequence>

      <Sequence from={176} durationInFrames={120}>
        <Headline title="Monte sua dieta." sub="Refeições e totais contra a sua meta." dur={120} />
      </Sequence>
      <Sequence from={292} durationInFrames={114 + X}>
        <Headline title="Marque o que comeu." sub="E veja quanto ainda cabe no dia." dur={114 + X} />
      </Sequence>
      <Sequence from={402 + X} durationInFrames={184}>
        <Headline title="Monte seu treino." sub="Cada série, com a carga da última vez." dur={184} />
      </Sequence>
      <Sequence from={582 + X} durationInFrames={192}>
        <Headline title="Acompanhe sua evolução." sub="Peso, volume e recordes ao longo do tempo." dur={192} />
      </Sequence>

      <Sequence from={772 + X} durationInFrames={128}>
        <Close />
      </Sequence>

      <Grain />
      {audio === "v2" ? <AudioTrack profile={profile} /> : <Audio src={staticFile("audio/score.wav")} volume={vol} />}
    </AbsoluteFill>
  );
};
