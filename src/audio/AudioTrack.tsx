import type { FC } from "react";
import { Html5Audio, Sequence, staticFile } from "remotion";
import { MIX, STEMS, stemGain, type AudioProfile, type StemName } from "./config";

const StemPlayer: FC<{ stem: StemName; profile: AudioProfile }> = ({ stem, profile }) => {
  const offset = MIX[profile].stems[stem].offsetFrames;
  return (
    <Sequence from={offset} layout="none" name={`áudio: ${stem}`}>
      <Html5Audio
        src={staticFile(`audio/v2/${profile}/${stem}.wav`)}
        // `f` conta a partir do início do stem; stemGain quer o quadro da composição.
        volume={(f) => stemGain(profile, stem, f + offset)}
      />
    </Sequence>
  );
};

/**
 * Áudio v2: quatro stems (music, impacts, ui, closing), cada um com o próprio volume, janela de
 * entrada/saída e fades vindos de `config.ts`. Ajustar a config muda o Studio e o render na hora,
 * sem regerar nada. Os stems são gerados por `npm run audio`.
 */
export const AudioTrack: FC<{ profile: AudioProfile }> = ({ profile }) => (
  <>
    {STEMS.map((stem) => (
      <StemPlayer key={stem} stem={stem} profile={profile} />
    ))}
  </>
);
