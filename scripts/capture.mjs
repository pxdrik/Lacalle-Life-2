// Captura as telas reais do Life (dados de demonstração) em public/shots/.
// Uso: com o Life rodando em http://localhost:3000, `npm run capture`.
import { mkdirSync, writeFileSync } from "node:fs";
import { openApp, importDemo, settle, BASE, VIEW } from "./lib.mjs";

const OUT = "public/shots";
mkdirSync(OUT, { recursive: true });

const { browser, page } = await openApp();
await importDemo(page);

// Centro relativo (0..1) de cada botão tocado, para animar o toque no vídeo.
const taps = {};
const rel = async (locator) => {
  const b = await locator.boundingBox();
  return { x: +((b.x + b.width / 2) / VIEW.width).toFixed(4), y: +((b.y + b.height / 2) / VIEW.height).toFixed(4) };
};

const go = async (path, ms = 1600) => {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await settle(page, ms);
};
const shot = async (name) => {
  await settle(page, 700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
};

// Elementos fixos/sticky (cabeçalho e barra de baixo) medidos no DOM real.
const chrome = async () =>
  page.evaluate(() => {
    const out = { top: null, bottom: null };
    for (const el of document.querySelectorAll("*")) {
      const pos = getComputedStyle(el).position;
      if (pos !== "fixed" && pos !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (r.width < innerWidth * 0.9) continue;
      if (r.top <= 1 && r.height < 120) out.top = { tag: el.tagName, h: Math.round(r.height), el: null };
      if (r.bottom >= innerHeight - 1 && r.height < 160) out.bottom = { tag: el.tagName, h: Math.round(r.height) };
    }
    return out;
  });

// Quadro alto: esconde cabeçalho/barra (ficam como camadas separadas no vídeo).
async function tall(name, { maxCssHeight, stopAtText } = {}) {
  await page.addStyleTag({
    content: "nav{visibility:hidden!important}",
  });
  await settle(page, 500);
  let height = await page.evaluate(() => document.documentElement.scrollHeight);
  if (stopAtText) {
    const y = await page.evaluate((txt) => {
      const el = [...document.querySelectorAll("h1,h2,h3")].find((n) => n.textContent?.trim() === txt);
      return el ? Math.round(el.getBoundingClientRect().top + scrollY) - 24 : null;
    }, stopAtText);
    if (y) height = y;
  }
  if (maxCssHeight) height = Math.min(height, maxCssHeight);
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x: 0, y: 0, width: VIEW.width, height },
    fullPage: true,
  });
  console.log("tall", name, height, "css px");
  await page.reload({ waitUntil: "networkidle" });
  await settle(page, 1200);
}

// --- Hoje (antes) -----------------------------------------------------------
await go("/hoje");
await shot("hoje-0");
console.log("chrome:", JSON.stringify(await chrome()));

// --- Diário: marca refeições ------------------------------------------------
await go("/diario");
await shot("diario-0");
const meals = page.locator("button:has(svg.lucide-check)");
console.log("checks no diário:", await meals.count());
taps.diarioCafe = await rel(meals.nth(0));
await meals.nth(0).click();
await page.waitForTimeout(900);
await shot("diario-1");
taps.diarioAlmoco = await rel(meals.nth(0));
await meals.nth(0).click(); // a lista reordena: o próximo pendente vira o primeiro
await page.waitForTimeout(900);
await shot("diario-2");
await page.screenshot({ path: `${OUT}/nav-diario.png`, clip: { x: 0, y: VIEW.height - 64, width: VIEW.width, height: 64 } });

// --- Hoje (depois) ----------------------------------------------------------
await go("/hoje");
await shot("hoje-2");

// --- Dieta ------------------------------------------------------------------
await go("/dietas");
const dietHref = await page.locator('a[href^="/dietas/"]').first().getAttribute("href");
await go(dietHref);
await shot("dieta");
await page.screenshot({ path: `${OUT}/nav-mais.png`, clip: { x: 0, y: VIEW.height - 64, width: VIEW.width, height: 64 } });
await tall("dieta-tall");

// --- Treino: sessão em andamento --------------------------------------------
await go("/treinos");
await page.getByText("Treino A").first().click();
await settle(page, 1500);
await shot("treino");
await page.getByRole("button", { name: /Iniciar treino/ }).click();
await settle(page, 1800);
await shot("sessao-0");
const checks = page.locator('button:has(svg.lucide-check)');
console.log("botões de check na sessão:", await checks.count());
taps.sessao1 = await rel(checks.nth(0));
await checks.nth(0).click();
await page.waitForTimeout(1100);
await shot("sessao-1");
taps.sessao2 = await rel(checks.nth(1));
await checks.nth(1).click();
await page.waitForTimeout(1100);
await shot("sessao-2");
taps.sessao3 = await rel(checks.nth(2));
await checks.nth(2).click();
await page.waitForTimeout(1100);
await shot("sessao-3");
await page.screenshot({ path: `${OUT}/nav-treinos.png`, clip: { x: 0, y: VIEW.height - 64, width: VIEW.width, height: 64 } });

// --- Evolução ---------------------------------------------------------------
await go("/evolucao", 2200);
await shot("evolucao");
await page.screenshot({ path: `${OUT}/nav-evolucao.png`, clip: { x: 0, y: VIEW.height - 64, width: VIEW.width, height: 64 } });
await tall("evolucao-tall", { stopAtText: "Histórico" });

writeFileSync(`${OUT}/taps.json`, JSON.stringify(taps, null, 2));
console.log("taps", JSON.stringify(taps));
await browser.close();
console.log("pronto");
