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
import { DURATION, FPS, T } from "./timeline";

export { DURATION, FPS };

/** Trocar aqui quando o endereço final de divulgação for outro. */
const CTA_URL = "lacalle-life-2.vercel.app";

// Todo o tempo vem de src/timeline.ts (T). Nada de número solto aqui.

// ---------------------------------------------------------------------------
// 1. Gancho: três apps para três coisas.
// ---------------------------------------------------------------------------
const Hook: FC = () => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const lines = ["Um app para a dieta.", "Outro para o treino.", "Outro para a evolução."];
  const out = interpolate(frame, [...T.hook.exit], [1, 0], { ...clamp, easing: easeIn });
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
              opacity: interpolate(frame, [T.hook.lines[i]!, T.hook.lines[i]! + 16], [0, 1], clamp),
            }}
          >
            0{i + 1}
          </span>
          <Words text={line} start={T.hook.lines[i]!} size={L.portrait ? 84 : 96} weight={600} color={i === 2 ? C.ink : "#cfd4da"} />
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
  const p = interpolate(frame, [0, T.logo.mark], [0, 1], { ...clamp, easing: ease });
  const out = interpolate(frame, [...T.logo.exit], [1, 0], { ...clamp, easing: easeIn });
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
        <Words text="Agora, um só." start={T.logo.words} size={L.portrait ? 60 : 72} weight={500} color={C.muted} />
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
  const S0 = T.stage.enter;

  const enter = interpolate(f, [0, T.stage.settle], [0, 1], { ...clamp, easing: ease });
  const exit = interpolate(f, [T.stage.exitStart - S0, T.stage.exitEnd - S0], [0, 1], { ...clamp, easing: easeIn });
  const y = (1 - enter) * 640 + exit * 820;
  const tilt = (1 - enter) * 16;
  const scale = 1 + (f / (T.stage.exitEnd + 4 - S0)) * 0.05;
  const yaw = Math.sin(f / 110) * 2.4 * enter;
  const o = interpolate(f, [0, 14], [0, 1], clamp) * (1 - exit);

  const dietScroll = interpolate(f, [T.dieta.scroll[0] - S0, T.dieta.scroll[1] - S0], [0, 880], { ...clamp, easing: easeInOut });
  const evo = T.evolucao;
  const evoScroll = interpolate(
    f - (evo.cut - S0),
    [evo.scroll[0][0] - evo.cut, evo.scroll[0][1] - evo.cut, evo.scroll[1][0] - evo.cut, evo.scroll[1][1] - evo.cut],
    [0, 1400, 1400, 2150],
    { ...clamp, easing: easeInOut },
  );
  const d = T.diario;
  const t = T.treino;

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
          <Sequence from={0} durationInFrames={d.cut - S0 + 10}>
            <Scroller name="dieta-tall" nav="nav-mais" scroll={dietScroll} screenW={screenW} />
          </Sequence>

          {/* diário: marca café e almoço; depois o Hoje mostra o que resta */}
          <Sequence from={d.cut - S0} durationInFrames={t.cut - d.cut + 8}>
            <Shot name="diario-0" />
            <Shot name="diario-1" at={d.states[0] - d.cut} fade={4} />
            <Shot name="diario-2" at={d.states[1] - d.cut} fade={4} />
            <Shot name="hoje-2" at={d.hoje[0] - d.cut} fade={d.hoje[1] - d.hoje[0]} />
            <Tap {...taps.diarioCafe} at={d.taps[0] - d.cut} screenW={screenW} />
            <Tap {...taps.diarioAlmoco} at={d.taps[1] - d.cut} screenW={screenW} />
          </Sequence>

          {/* treino: três séries marcadas, descanso correndo */}
          <Sequence from={t.cut - S0} durationInFrames={evo.cut - t.cut + 8}>
            <Shot name="sessao-0" />
            <Shot name="sessao-1" at={t.states[0] - t.cut} fade={4} />
            <Shot name="sessao-2" at={t.states[1] - t.cut} fade={4} />
            <Shot name="sessao-3" at={t.states[2] - t.cut} fade={4} />
            <Tap {...taps.sessao1} at={t.taps[0] - t.cut} screenW={screenW} />
            <Tap {...taps.sessao2} at={t.taps[1] - t.cut} screenW={screenW} />
            <Tap {...taps.sessao3} at={t.taps[2] - t.cut} screenW={screenW} />
          </Sequence>

          {/* evolução: gráfico, volume semanal, recordes */}
          <Sequence from={evo.cut - S0} durationInFrames={T.stage.exitEnd - evo.cut - 8}>
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
  const c = T.close;
  const dim = interpolate(frame, [...c.dim], [1, 0.32], { ...clamp, easing: ease });
  const cta = interpolate(frame, [...c.cta], [0, 1], { ...clamp, easing: ease });
  const top = L.portrait ? 520 : 140;
  const size = L.portrait ? 64 : 76;
  return (
    <div style={{ position: "absolute", left: L.textX, top, width: L.portrait ? L.textW + 60 : 1500 }}>
      <div style={{ opacity: dim }}>
        <Words text="Monte dietas." start={c.lines[0]} size={size} weight={600} color="#cfd4da" style={{ marginBottom: 8 }} />
        <Words text="Monte treinos." start={c.lines[1]} size={size} weight={600} color="#cfd4da" style={{ marginBottom: 8 }} />
        <Words text="Acompanhe sua evolução." start={c.lines[2]} size={size} weight={600} color="#cfd4da" />
      </div>
      <Words
        text="Tudo em um lugar só."
        start={c.tudo}
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
// Linha do tempo (30 fps; a duração vem de src/timeline.ts)
// ---------------------------------------------------------------------------
export interface AdProps {
  /** "v1" = trilha provisória; "v2" = efeitos novos (src/audio). Só o áudio muda. */
  audio?: AudioVersion;
  profile?: AudioProfile;
}

export const Ad: FC<AdProps> = ({ audio = DEFAULT_AUDIO_VERSION, profile = DEFAULT_AUDIO_PROFILE }) => {
  const frame = useCurrentFrame();
  const vol = interpolate(frame, [0, 24, DURATION - 40, DURATION], [0, 1, 1, 0], clamp);
  const topLogoStart = T.stage.enter - 10;
  const topLogoDur = T.stage.exitStart - topLogoStart;
  return (
    <AbsoluteFill style={{ background: C.deep }}>
      <Backdrop glowFrom={T.logo.start - 2} glowTo={T.logo.start + 62} />

      <Sequence from={0} durationInFrames={T.hook.dur}>
        <Hook />
      </Sequence>
      <Sequence from={T.logo.start} durationInFrames={T.logo.dur}>
        <LogoReveal />
      </Sequence>

      <Sequence from={topLogoStart} durationInFrames={topLogoDur}>
        <TopLogo dur={topLogoDur} />
      </Sequence>
      <Sequence from={T.stage.enter} durationInFrames={T.stage.exitEnd + 4 - T.stage.enter}>
        <Stage />
      </Sequence>

      <Sequence from={T.dieta.title} durationInFrames={T.diario.cut + 4 - T.dieta.title}>
        <Headline title="Monte sua dieta." sub="Refeições e totais contra a sua meta." dur={T.diario.cut + 4 - T.dieta.title} />
      </Sequence>
      <Sequence from={T.diario.cut} durationInFrames={T.treino.cut + 4 - T.diario.cut}>
        <Headline title="Marque o que comeu." sub="E veja quanto ainda cabe no dia." dur={T.treino.cut + 4 - T.diario.cut} />
      </Sequence>
      <Sequence from={T.treino.cut} durationInFrames={T.evolucao.cut + 4 - T.treino.cut}>
        <Headline title="Monte seu treino." sub="Cada série, com a carga da última vez." dur={T.evolucao.cut + 4 - T.treino.cut} />
      </Sequence>
      <Sequence from={T.evolucao.cut} durationInFrames={T.close.start + 2 - T.evolucao.cut}>
        <Headline title="Acompanhe sua evolução." sub="Peso, volume e recordes ao longo do tempo." dur={T.close.start + 2 - T.evolucao.cut} />
      </Sequence>

      <Sequence from={T.close.start} durationInFrames={T.close.dur}>
        <Close />
      </Sequence>

      <Grain />
      {audio === "v2" ? <AudioTrack profile={profile} /> : <Audio src={staticFile("audio/score.wav")} volume={vol} />}
    </AbsoluteFill>
  );
};
