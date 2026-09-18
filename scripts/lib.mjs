import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { buildDemoBackup } from "./demo-data.mjs";

export const BASE = process.env.LIFE_URL ?? "http://localhost:3000";
export const VIEW = { width: 430, height: 932 };

export async function openApp() {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--lang=pt-BR"],
  });
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    acceptDownloads: true,
  });
  // Esconde o indicador de dev do Next e desliga o cursor de texto piscando.
  await ctx.addInitScript(() => {
    const css = document.createElement("style");
    css.textContent =
      "nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}*{caret-color:transparent!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.append(css));
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  return { browser, ctx, page };
}

export async function settle(page, ms = 900) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

export async function importDemo(page) {
  await page.goto(BASE + "/hoje", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000); // semeia o catálogo
  await page.goto(BASE + "/perfil", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.getByText("Dados e segurança").click();
  await page.waitForTimeout(500);

  // O catálogo real vem do próprio app: exporta, acrescenta os dados de demo, reimporta.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Exportar dados/ }).click(),
  ]);
  const path = await download.path();
  const base = JSON.parse(readFileSync(path, "utf8"));
  const demo = buildDemoBackup(base);

  await page.locator('input[type="file"]').setInputFiles({
    name: "demo.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(demo)),
  });
  const confirm = page.getByRole("button", { name: /Importar .* substituir/ });
  await confirm.waitFor();
  await confirm.click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Substituir tudo/ }).click();
  await page.waitForTimeout(2500);
  return demo;
}
