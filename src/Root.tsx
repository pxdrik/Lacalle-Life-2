import type { FC } from "react";
import { Composition } from "remotion";
import { Ad, DURATION, FPS } from "./Ad";
import { DEFAULT_AUDIO_PROFILE, DEFAULT_AUDIO_VERSION } from "./audio/config";

const defaultProps = { audio: DEFAULT_AUDIO_VERSION, profile: DEFAULT_AUDIO_PROFILE };

export const Root: FC = () => (
  <>
    <Composition id="Ad" component={Ad} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={defaultProps} />
    <Composition id="AdWide" component={Ad} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={defaultProps} />
  </>
);
