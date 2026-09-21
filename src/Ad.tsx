import type { FC } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import taps from "../public/shots/taps.json";
import "./fonts";
import { AudioTrack } from "./audio/AudioTrack";
import { DEFAULT_AUDIO_PROFILE, DEFAULT_AUDIO_VERSION, type AudioProfile, type AudioVersion } from "./audio/config";
import { Backdrop, Grain } from "./Backdrop";
import { Fade, Phone, Scroller, Shot, Tap } from "./Phone";
import { Burst, Callout, CtaButton, Flash } from "./Reward";
import { Headline, Lockup, Slam, Words } from "./Text";
import { BEZEL, C, FONT, clamp, ease, easeIn, easeInOut, useLayout } from "./theme";
import { DURATION, FPS, T } from "./timeline";

export { DURATION, FPS };

/** Trocar aqui quando o endereço final de divulgação for outro. */
const CTA_URL = "lacalle-life-2.vercel.app";
/** A palavra que quebra o padrão depois das três linhas do gancho. */
const HOOK_PUNCH = "Chega.";

// Todo o tempo vem de src/timeline.ts (T). Nada de número solto aqui.

// ---------------------------------------------------------------------------
// 1. Gancho: três apps para três coisas, e um "Chega." que quebra o padrão.
// ---------------------------------------------------------------------------
const Hook: FC = () => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const H = T.hook;
  const lines = ["Um app para a dieta.", "Outro para o treino.", "Outro para a evolução."];
  const out = interpolate(frame, [...H.exit], [1, 0], { ...clamp, easing: easeIn });
  // as três linhas escurecem quando o "Chega." cai, e a cena treme por um instante (impacto)
  const dim = interpolate(frame, [H.chega, H.chega + 6], [1, 0.28], clamp);
  const k = frame - H.chega;
  const shake = k >= 0 && k < 9 ? Math.sin(k * 3.4) * 10 * (1 - k / 9) : 0;
  const top = L.portrait ? 560 : 250;
  return (
    <div
      style={{
        position: "absolute",
        left: L.textX,
        top,
        opacity: out,
        transform: `translate(${shake}px, ${(1 - out) * -30}px)`,
      }}
    >
      <div style={{ opacity: dim }}>
        {lines.map((line, i) => (
          <div key={line} style={{ display: "flex", alignItems: "baseline", gap: 28, marginBottom: 40 }}>
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 500,
                fontSize: 30,
                color: C.accent,
                opacity: interpolate(frame, [H.lines[i]!, H.lines[i]! + 6], [0, 1], clamp),
              }}
            >
              0{i + 1}
            </span>
            <Slam text={line} start={H.lines[i]!} size={L.portrait ? 84 : 96} color={i === 2 ? C.ink : "#cfd4da"} />
          </div>
        ))}
      </div>
      <Slam text={HOOK_PUNCH} start={H.chega} size={L.portrait ? 210 : 220} from={1.7} weight={700} color={C.accent} style={{ marginTop: 6 }} />
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
  // cada check dá um "soquinho" no aparelho (recompensa)
  const punch = [...T.diario.states, ...T.treino.states].reduce((s, st) => {
    const k = f - (st - S0);
    return s + (k >= 0 && k < 8 ? 0.022 * (1 - k / 8) ** 2 : 0);
  }, 0);
  const scale = 1 + (f / (T.stage.exitEnd + 4 - S0)) * 0.05 + punch;
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
            <Burst {...taps.diarioCafe} at={d.states[0] - d.cut} screenW={screenW} />
            <Burst {...taps.diarioAlmoco} at={d.states[1] - d.cut} screenW={screenW} />
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
            <Burst {...taps.sessao1} at={t.states[0] - t.cut} screenW={screenW} />
            <Burst {...taps.sessao2} at={t.states[1] - t.cut} screenW={screenW} />
            <Burst {...taps.sessao3} at={t.states[2] - t.cut} screenW={screenW} />
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
// 4. Fechamento: a frase, a marca e um CTA com botão que é "tocado".
// ---------------------------------------------------------------------------
const Close: FC = () => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const c = T.close;
  const dim = interpolate(frame, [...c.dim], [1, 0.32], { ...clamp, easing: ease });
  const after = interpolate(frame, [c.cta[0] - 6, c.cta[0] + 10], [0, 1], { ...clamp, easing: ease });
  const top = L.portrait ? 520 : 150;
  const size = L.portrait ? 60 : 64;
  return (
    <div style={{ position: "absolute", left: L.textX, top, width: L.portrait ? L.textW + 60 : 1500 }}>
      <div style={{ opacity: dim }}>
        <Words text="Monte dietas." start={c.lines[0]} size={size} weight={600} color="#cfd4da" style={{ marginBottom: 6 }} />
        <Words text="Monte treinos." start={c.lines[1]} size={size} weight={600} color="#cfd4da" style={{ marginBottom: 6 }} />
        <Words text="Acompanhe sua evolução." start={c.lines[2]} size={size} weight={600} color="#cfd4da" />
      </div>
      <Words
        text="Tudo em um lugar só."
        start={c.tudo}
        stagger={3}
        size={L.portrait ? 88 : 108}
        weight={700}
        color={C.accent}
        style={{ marginTop: L.portrait ? 44 : 30 }}
      />
      <div style={{ marginTop: L.portrait ? 52 : 34, opacity: after }}>
        <Lockup size={L.portrait ? 54 : 56} />
      </div>
      <div style={{ marginTop: L.portrait ? 34 : 24 }}>
        <CtaButton frame={frame} pop={c.cta[0]} press={c.press} portrait={L.portrait} />
      </div>
      <div style={{ opacity: after, marginTop: L.portrait ? 30 : 22 }}>
        <div style={{ fontFamily: FONT, fontSize: L.portrait ? 42 : 40, fontWeight: 600, color: C.ink }}>Sem criar conta.</div>
        <div style={{ fontFamily: FONT, fontSize: L.portrait ? 34 : 34, fontWeight: 400, color: C.muted, marginTop: 8 }}>{CTA_URL}</div>
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
  /** Acrescenta a trilha (stem "music") por baixo dos efeitos. Por padrão, só efeitos. */
  music?: boolean;
}

export const Ad: FC<AdProps> = ({ audio = DEFAULT_AUDIO_VERSION, profile = DEFAULT_AUDIO_PROFILE, music = false }) => {
  const frame = useCurrentFrame();
  const vol = interpolate(frame, [0, 24, DURATION - 40, DURATION], [0, 1, 1, 0], clamp);
  const topLogoStart = T.stage.enter - 10;
  const topLogoDur = T.stage.exitStart - topLogoStart;
  // instantes de recompensa: o fundo dá um brilho verde em cada um
  const rewardFrames = [T.hook.chega, ...T.diario.states, ...T.treino.states, ...T.callouts.map((c) => c.at), T.close.start + T.close.press];
  return (
    <AbsoluteFill style={{ background: C.deep }}>
      <Backdrop glowFrom={T.logo.start - 2} glowTo={T.logo.start + 62} />
      <Flash frames={rewardFrames} />

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

      {/* recompensas: um número em destaque por ganho, por cima do aparelho */}
      {T.callouts.map((c) => (
        <Sequence key={c.at} from={c.at} durationInFrames={c.dur}>
          <Callout value={c.value} label={c.label} dur={c.dur} />
        </Sequence>
      ))}

      <Sequence from={T.close.start} durationInFrames={T.close.dur}>
        <Close />
      </Sequence>

      <Grain />
      {audio === "v2" ? <AudioTrack profile={profile} music={music} /> : <Audio src={staticFile("audio/score.wav")} volume={vol} />}
    </AbsoluteFill>
  );
};
