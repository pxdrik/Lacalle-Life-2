import type { FC } from "react";
import { Composition } from "remotion";
import { Ad, DURATION, FPS } from "./Ad";

export const Root: FC = () => (
  <>
    <Composition id="Ad" component={Ad} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
    <Composition id="AdWide" component={Ad} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
  </>
);
