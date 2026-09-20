// Monta MP4s com o áudio novo SEM mexer no vídeo: copia o stream de vídeo bit a bit do render
// já existente e só troca o áudio. Uso: node scripts/audio/mux.mjs <perfil> <saida-dir>
//   pré-requisito: `npx remotion render Ad out/test/audio-<perfil>.wav --codec=wav --props=<json>`
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const profile = process.argv[2] ?? "cinematic";
const outDir = process.argv[3] ?? "out/test";
mkdirSync(outDir, { recursive: true });
for (const [name, video] of [["9x16", "out/lacalle-life-9x16.mp4"], ["16x9", "out/lacalle-life-16x9.mp4"]]) {
  const out = `${outDir}/lacalle-life-${name}-audio-v2-${profile}.mp4`;
  execSync(`npx remotion ffmpeg -y -loglevel error -i ${video} -i out/test/audio-${profile}.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest ${out}`, { stdio: "inherit" });
  console.log("ok", out);
}
