"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";

import { RPE_SCALE, describeRpe, formatRpe } from "../taxonomy/rpe";

interface Props {
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  readonly label: string;
  readonly className?: string;
}

/**
 * A escala é uma **lista de posições**, não um intervalo numérico.
 *
 * Esta é a correção de C2 (auditoria de 25/09/2026). O mapeamento antigo
 * derivava a posição do valor: `(valor - 6) / (10 - 6)`. Como a escala não é
 * uniforme (6, 7, 7,5, 8, 8,5, 9, 9,5, 10), a largura da banda de cada valor
 * ficava proporcional ao intervalo numérico vizinho, e não igual. Medido no
 * retângulo clicável: RPE 7 ficava com 20,0% e RPE 8 com 7,8% — 2,6 vezes
 * mais alvo para um valor que o outro, sem nenhuma razão de produto.
 *
 * Por índice, os sete intervalos entre os oito degraus valem 180/7 = 25,7°
 * cada, iguais. As duas pontas ficam com meia banda no arco mais todo o
 * excedente para fora dele, o que na prática as torna as mais fáceis de
 * acertar — que é o certo, já que são os extremos da escala.
 */
const LAST_INDEX = RPE_SCALE.length - 1;

/**
 * O destino do portal, lido do jeito que este projeto já lê valores que só
 * existem no cliente (ver `hoje/page.tsx` e o comentário sobre o erro #418
 * de hidratação que motivou o padrão lá).
 *
 * O servidor renderiza `null` e a primeira renderização do cliente também,
 * então as duas árvores batem e a hidratação nunca vê uma diferença; o React
 * re-renderiza em seguida com `document.body` e a folha aparece. Um
 * `useEffect` com `setState` faria a mesma coisa, mas é exatamente o que o
 * React Compiler recusa, e com razão.
 */
function getPortalTarget(): HTMLElement {
  return document.body;
}

function getNoPortalTarget(): HTMLElement | null {
  return null;
}

function subscribeToNothing() {
  // `document.body` não muda. A assinatura existe só porque
  // `useSyncExternalStore` pede uma.
  return () => {};
}

function indexOfValue(value: number | null): number | null {
  if (value === null) return null;
  const index = RPE_SCALE.findIndex((step) => step.value === value);

  return index === -1 ? null : index;
}

/** 0 no primeiro degrau, 1 no último. */
function fractionForIndex(index: number): number {
  return index / LAST_INDEX;
}

/** −90 à esquerda, 0 apontando para cima, +90 à direita. A mesma convenção
 * que o `rotate()` do ponteiro usa, então a ida e a volta são a mesma
 * fórmula rodada nos dois sentidos. */
function angleForFraction(fraction: number): number {
  return (fraction - 0.5) * 180;
}

/** O degrau mais próximo de um ângulo qualquer. Ângulo além das pontas
 * (|ângulo| > 90, que é o que um arrasto produz ao passar da borda) prende
 * no extremo daquele lado, em vez de dar a volta. */
function indexForAngle(angleDeg: number): number {
  const fraction = angleDeg / 180 + 0.5;

  return Math.min(LAST_INDEX, Math.max(0, Math.round(fraction * LAST_INDEX)));
}

function arcPath(cx: number, cy: number, r: number): string {
  return `M ${String(cx - r)} ${String(cy)} A ${String(r)} ${String(r)} 0 0 1 ${String(cx + r)} ${String(cy)}`;
}

/**
 * RPE read at a glance as a dial, chosen by dragging one.
 *
 * **The dial (17/09/2026, Pedro: "um meio círculo e um ponteiro").** The
 * trigger used to just print the number in a bordered box — plain, but also
 * the one field in the row that reads as "an amount" rather than "an amount
 * against a target", the way reps and weight both do with the planned value
 * printed underneath. A semicircle already exists in this app for exactly
 * this shape of information (`TodayEnergy`'s `CalorieRing`, same instrument
 * framing the brandbook prefers over a full ring), reused here with a needle
 * added: the needle is the read Pedro asked for, the number stays printed
 * under the arc because a value with no digits anywhere in the row is the
 * same complaint he had about the diet card's macro bar hiding numbers
 * behind a shape.
 *
 * **The picker is the same dial, grown up and draggable (second round,
 * 17/09/2026: "quero arrastar a barrinha pra selecionar, não aquela
 * tabela").** The grid of eight buttons is gone — dragging a finger along
 * the arc updates the value live. "Sem RPE" cannot live *on* the arc — the
 * scale has no natural "blank" angle — so it stays a plain button beside
 * it, same as it sat first in the grid it replaced. Keyboard reaches the
 * same picker through `role="slider"` and the arrow keys, one scale step at
 * a time.
 *
 * **Releasing the drag used to close the sheet on its own — third round,
 * same day: "deixe um botão para confirmar o RPE."** A release-to-close
 * gesture does not leave room to see the number land, reconsider, and drag
 * again before the sheet is gone; a live preview that only *some* releases
 * happen to commit is worse than one that always waits for an explicit
 * "Confirmar". Dragging still updates `value` (and everything reading it)
 * live, same as before — only the close moved from the pointer's own
 * `pointerup` to this button.
 *
 * **A folha sai da árvore do consumidor por portal (Fase 3, 26/09/2026).**
 * Sem isso este componente devolve **dois** nós irmãos — o gatilho e o
 * `<dialog>` — onde quem o usa razoavelmente espera um. O `<dialog>` fechado
 * é `display: none` e nunca chegou a ocupar faixa de grade nenhuma (medido:
 * ele não vira item de grade), mas a forma do DOM vazava assim mesmo:
 * `planned-set-row` carregava um wrapper só por causa disso e o teste de
 * geometria precisava filtrar `dialog:not([open])` para não medir um
 * elemento fora da tela. Com o portal, o consumidor recebe um nó e nada
 * mais.
 *
 * O alvo do portal entra por `useSyncExternalStore` em vez de
 * `document.body` direto: o componente renderiza no servidor, onde
 * `document` não existe, e servidor e primeira renderização do cliente
 * precisam produzir a mesma árvore. O `Dialog` segue **montado o tempo
 * todo** com `open` alternando, e não montado sob demanda, porque a folha
 * tem transição de saída de 200ms (`allow-discrete` em `globals.css`) que
 * desmontar cortaria.
 */
export function RpeSelect({ value, onChange, label, className }: Props) {
  const [open, setOpen] = useState(false);
  const portalTarget = useSyncExternalStore(
    subscribeToNothing,
    getPortalTarget,
    getNoPortalTarget,
  );

  const sheet = (
    <Dialog
      open={open}
      title={label}
      onClose={() => {
        setOpen(false);
      }}
      placement="sheet-bottom"
    >
      <RpeDialPicker value={value} label={label} onChange={onChange} />

      {/* Sprint 4, Parte F. "Sem RPE" era um `<button>` à mão com `h-11`
          fixo, ao lado de um `Button size="lg"` que lê `--control-h-lg`.
          Dois botões irmãos, mesma linha, mesmo peso de decisão, alturas
          diferentes — e a diferença **crescia com a densidade**, que é o
          sinal de que um lê o token e o outro não: 44 contra 48 em Compacto,
          51 contra 64 em Padrão, 57 contra 83 em Confortável (medido).

          Agora é o mesmo componente e o mesmo tamanho. O estado "é este o
          valor atual" fica por conta das duas classes de acento, que o `cn`
          resolve por cima do `secondary` — mesma técnica de qualquer
          consumidor que precisa marcar seleção sem inventar uma variante. */}
      <div className="mt-4 flex gap-2">
        <Button
          variant="secondary"
          size="lg"
          className={cn(
            "flex-1",
            value === null && "border-accent bg-accent/10",
          )}
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          Sem RPE
        </Button>
        <Button
          size="lg"
          className="flex-1"
          onClick={() => {
            setOpen(false);
          }}
        >
          Confirmar
        </Button>
      </div>
    </Dialog>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        aria-label={label}
        title={value === null ? "Sem RPE" : (describeRpe(value) ?? undefined)}
        className={cn(
          "flex flex-col items-center justify-center rounded-md border border-line-strong bg-surface transition-colors duration-150 ease-out",
          "hover:border-ink-subtle focus:border-accent",
          className,
        )}
      >
        <RpeDial value={value} cx={28} cy={24} r={18} />
      </button>

      {portalTarget !== null && createPortal(sheet, portalTarget)}
    </>
  );
}

/** The picker's own geometry — bigger than the trigger's, sized for a
 * thumb rather than a glance. */
const VIEWBOX_W = 280;
const VIEWBOX_H = 150;
const PICKER_CX = 140;
const PICKER_CY = 128;
const PICKER_R = 110;
const PICKER_NEEDLE_LEN = PICKER_R - 16;

/**
 * Onde o ponteiro **começa** — e por que ele deixou de começar no pivô.
 *
 * Achado da Sprint 4, medido por interseção do segmento com o glifo (caixa
 * delimitadora superestima uma diagonal): o ponteiro cruzava a descrição em
 * **seis dos oito valores**, ocupando de 18% a 39% do próprio comprimento
 * dentro dela, e atravessava o próprio número em RPE 8,5, com 43%.
 *
 * A causa é geométrica e não tem nada de sutil: a leitura mora dentro do
 * raio que o ponteiro varre. O número fica em raio 38 a 59 do pivô (linha de
 * base em `CY - 38`, corpo 30) e a descrição em 11 a 23 (base em `CY - 14`,
 * corpo 12); o ponteiro ia de 0 a 94. Qualquer mão de comprimento inteiro
 * num mostrador com leitura centrada cruza essa leitura — é a composição que
 * está em conflito, não o ângulo.
 *
 * A saída preserva tudo que se pode perceber do controle: o pivô continua
 * desenhado, o arco continua o mesmo, o ângulo é o mesmo, e a matemática de
 * `indexForAngle`/`angleForFraction` não foi tocada. Só a **representação**
 * do ponteiro saiu da região textual, virando um indicador radial junto ao
 * arco — que é o que um instrumento de verdade faz quando o mostrador
 * digital fica no meio.
 *
 * 72 é medido, não arredondado — e a primeira tentativa foi 64, que falhou
 * no teste por um fio. O erro foi calcular a folga contra a **altura do
 * glifo** em vez da caixa que o navegador devolve: `getBoundingClientRect`
 * num `<text>` de corpo 30 cobre a caixa em inteira, do topo do ascendente
 * ao fundo do descendente, e não o desenho do "8". Isso põe o topo do número
 * em `CY - 62`, três unidades acima de onde a conta no papel o colocava, e a
 * ponta interna do indicador a 64 raspava nele em ±12,9° — RPE 8 e 8,5,
 * justamente os dois valores mais usados.
 *
 * A 72, os dois casos apertados ficam: em ±12,9° a ponta cai em `CY - 70,2`,
 * oito acima do topo do número; em ±64,3° cai em `CY - 31,2`, oito acima do
 * topo da descrição. Os outros ângulos saem pela largura, não pela altura —
 * o número tem ±22 de meia largura e a ponta já está além disso.
 *
 * A lição vale além deste arquivo: **quando a régua é o navegador, a conta
 * também tem que ser.** O teste que pegou isso amostra o segmento e pergunta
 * quantos pontos caem dentro do glifo, em vez de comparar retângulos — caixa
 * delimitadora em volta de uma diagonal acusa colisão onde não há, e teria
 * escondido a de verdade atrás de seis falsos positivos.
 */
const PICKER_NEEDLE_START = 72;
const PICKER_PATH = arcPath(PICKER_CX, PICKER_CY, PICKER_R);
const PICKER_ARC_LENGTH = Math.PI * PICKER_R;

/**
 * Até onde, para fora do arco, um toque ainda conta como "no mostrador".
 *
 * O traço do arco tem 14 de largura, então esta folga é generosa de
 * propósito: o alvo tem que ser fácil. O que ela exclui são os cantos
 * superiores da caixa do SVG, que estão visualmente desligados do
 * instrumento — tocar lá não deve escolher RPE nenhum só porque o ângulo
 * daquele ponto é calculável.
 */
const PICKER_R_OUTER = PICKER_R + 22;

/**
 * O que o ponteiro está apontando, em coordenadas de tela.
 *
 * **Sem `svg.viewBox.baseVal`.** A versão anterior lia o viewBox do elemento
 * para converter cliente → unidades do SVG, e o jsdom não implementa essa
 * propriedade — foi por isso que o teste antigo precisava falsificar
 * `getBoundingClientRect` **e** `viewBox`, e a partir dali ele media o
 * próprio fixture. Aqui a escala sai do retângulo e das constantes do
 * desenho, que é a mesma conta, funciona em qualquer tamanho, e é medível
 * num navegador de verdade.
 *
 * `xMidYMid meet` (o padrão) escala uniformemente e centra o conteúdo na
 * caixa, então o centro do mostrador é derivável mesmo quando sobra faixa
 * preta de um dos lados.
 *
 * `onDial` é a correção de C1. O mostrador é um **semicírculo**: só o
 * semiplano acima do centro tem ângulo com significado. Abaixo dele,
 * `atan2` devolve módulo maior que 90, e a versão anterior **truncava** esse
 * resultado em ±90 — o que dobrava a metade de baixo inteira sobre as duas
 * pontas da escala, dividida pela vertical do meio. Medido: 14,3% do
 * retângulo clicável só produzia 6 ou 10, e `(140, 127)` dava 8 enquanto
 * `(140, 129)` dava 10. Dois pixels entre o meio da escala e o máximo.
 */
function readPointer(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { readonly angle: number; readonly onDial: boolean } | null {
  const rect = svg.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const scale = Math.min(rect.width / VIEWBOX_W, rect.height / VIEWBOX_H);
  const cx =
    rect.left + (rect.width - VIEWBOX_W * scale) / 2 + PICKER_CX * scale;
  const cy =
    rect.top + (rect.height - VIEWBOX_H * scale) / 2 + PICKER_CY * scale;

  const dx = clientX - cx;
  const dy = clientY - cy;

  return {
    angle: Math.atan2(dx, -dy) * (180 / Math.PI),
    onDial: dy <= 0 && Math.hypot(dx, dy) <= PICKER_R_OUTER * scale,
  };
}

function RpeDialPicker({
  value,
  label,
  onChange,
}: {
  readonly value: number | null;
  readonly label: string;
  readonly onChange: (value: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const index = indexOfValue(value);
  const angle = index === null ? null : angleForFraction(fractionForIndex(index));

  function pick(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (svg === null) return;

    const pointer = readPointer(svg, clientX, clientY);
    if (pointer === null) return;

    onChange(RPE_SCALE[indexForAngle(pointer.angle)]!.value);
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${String(VIEWBOX_W)} ${String(VIEWBOX_H)}`}
      role="slider"
      aria-label={label}
      // Por índice, porque é isso que o controle percorre. O valor real do
      // RPE vai em `aria-valuetext`, que é o padrão para escala não linear —
      // anunciar "7,5 de 6 a 10" descreveria uma escala contínua que não
      // existe. Sem valor, `aria-valuenow` é omitido em vez de mentir um 6.
      aria-valuemin={0}
      aria-valuemax={LAST_INDEX}
      aria-valuenow={index ?? undefined}
      aria-valuetext={value === null ? "Sem RPE" : formatRpe(value)}
      tabIndex={0}
      className="mx-auto block w-full max-w-72 touch-none select-none outline-none focus-visible:[&>circle]:stroke-accent"
      onPointerDown={(event) => {
        const svg = svgRef.current;
        if (svg === null) return;

        // Um toque fora do mostrador não escolhe nada. É o que impede o bug
        // relatado de voltar: antes, qualquer ponto do retângulo escolhia um
        // valor, e a faixa de baixo escolhia sempre um dos extremos.
        const pointer = readPointer(svg, event.clientX, event.clientY);
        if (pointer === null || !pointer.onDial) return;

        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        onChange(RPE_SCALE[indexForAngle(pointer.angle)]!.value);
      }}
      onPointerMove={(event) => {
        // Só continua um arrasto que começou sobre o mostrador. Daí em
        // diante o dedo pode sair dele à vontade: passar da ponta prende no
        // extremo daquele lado, que é o que se espera de um deslizador.
        if (!draggingRef.current) return;
        pick(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={(event) => {
        const step = ARROW_STEP[event.key];
        if (step === undefined) return;
        event.preventDefault();

        if (step === "first") {
          onChange(RPE_SCALE[0]!.value);
          return;
        }
        if (step === "last") {
          onChange(RPE_SCALE[LAST_INDEX]!.value);
          return;
        }

        // Regra explícita para "Sem RPE", em vez do −1 que `findIndex`
        // devolvia e que fazia as duas setas caírem no primeiro degrau por
        // acidente aritmético. O resultado observável é o mesmo de antes: a
        // primeira seta estabelece uma posição, e ela é o começo da escala.
        if (index === null) {
          onChange(RPE_SCALE[0]!.value);
          return;
        }

        const next = Math.min(LAST_INDEX, Math.max(0, index + step));
        onChange(RPE_SCALE[next]!.value);
      }}
    >
      <path
        d={PICKER_PATH}
        fill="none"
        strokeWidth="14"
        strokeLinecap="round"
        className="stroke-muted"
      />
      {index !== null && (
        <path
          d={PICKER_PATH}
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={PICKER_ARC_LENGTH}
          strokeDashoffset={PICKER_ARC_LENGTH * (1 - fractionForIndex(index))}
          className="stroke-accent"
        />
      )}
      {/* Marcas de escala — as mesmas oito paradas que a grade de botões
          mostrava, agora equidistantes de verdade, porque a posição vem do
          índice e não do valor. Antes elas se amontoavam no meio do arco,
          que é o desenho do defeito C2.

          **Sprint 4, achado D1.** Elas eram `stroke-canvas`, que é a cor do
          fundo da página — a ideia era "entalhe no trilho", e funciona
          enquanto o trilho está preenchido. Sobre a parte vazia não: medido
          no navegador, `canvas` sobre `muted` dá **1,05:1 no tema claro**
          (#f8fafc sobre #f3f4f6) e 1,29:1 no escuro. Invisível. É por isso
          que o sintoma era "os marcadores somem conforme o RPE cai" e não
          "o seletor está quebrado": sobre o arco preenchido elas medem
          3,77:1 e 8,38:1, e ali sempre apareceram.

          `line-strong` é o token que o brandbook já reserva para separação
          forte, e é o único da paleta neutra que tem contraste contra
          `muted` nos **dois** temas sem virar texto. Não engrossei o traço
          nem inventei cor: a marca continua secundária ao arco e mais
          discreta que o ponteiro, que é `ink`. */}
      {RPE_SCALE.map((step, tickIndex) => {
        const tickAngle = angleForFraction(fractionForIndex(tickIndex));
        return (
          <line
            key={step.value}
            x1={PICKER_CX}
            y1={PICKER_CY - PICKER_R + 20}
            x2={PICKER_CX}
            y2={PICKER_CY - PICKER_R + 28}
            strokeWidth="2"
            className="stroke-ink-subtle"
            transform={`rotate(${String(tickAngle)} ${String(PICKER_CX)} ${String(PICKER_CY)})`}
          />
        );
      })}
      {angle !== null && (
        <line
          x1={PICKER_CX}
          y1={PICKER_CY - PICKER_NEEDLE_START}
          x2={PICKER_CX}
          y2={PICKER_CY - PICKER_NEEDLE_LEN}
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-ink"
          transform={`rotate(${String(angle)} ${String(PICKER_CX)} ${String(PICKER_CY)})`}
        />
      )}
      <circle
        cx={PICKER_CX}
        cy={PICKER_CY}
        r="6"
        strokeWidth="2"
        className="fill-surface stroke-ink transition-colors duration-150 ease-out"
      />
      <text
        x={PICKER_CX}
        y={PICKER_CY - 38}
        textAnchor="middle"
        fontSize="30"
        className="fill-ink font-semibold tabular-nums"
      >
        {value === null ? "—" : formatRpe(value)}
      </text>
      {value !== null && (
        <text
          x={PICKER_CX}
          y={PICKER_CY - 14}
          textAnchor="middle"
          fontSize="12"
          className="fill-ink-subtle"
        >
          {describeRpe(value)}
        </text>
      )}
    </svg>
  );
}

/** As teclas que movem o controle, e o quanto cada uma move. Uma tabela em
 * vez de uma escada de `if`, para "qual tecla faz o quê" ser legível de uma
 * vez e para qualquer outra tecla passar direto sem `preventDefault`. */
const ARROW_STEP: Record<string, number | "first" | "last" | undefined> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  Home: "first",
  End: "last",
};

/**
 * O mostrador pequeno — mesma fórmula de arco e mesma técnica de
 * `stroke-dasharray`/`-offset` que o `CalorieRing` de `TodayEnergy` já usa
 * (π·r para o arco de um semicírculo), na escala que o chamador pedir.
 *
 * A posição vem do **índice** na escala, igual à do seletor grande. Se os
 * dois usassem fórmulas diferentes, o ponteiro do gatilho apontaria para um
 * lugar e o da folha para outro, com o mesmo valor — que é a divergência que
 * a Fase 2 passou a impedir nas colunas e não haveria motivo para reabrir
 * aqui.
 */
function RpeDial({
  value,
  cx,
  cy,
  r,
}: {
  readonly value: number | null;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}) {
  const index = indexOfValue(value);
  const fraction = index === null ? null : fractionForIndex(index);
  const angle = fraction === null ? null : angleForFraction(fraction);
  const path = arcPath(cx, cy, r);
  const arcLength = Math.PI * r;
  const needleLen = r - 5;

  return (
    <svg viewBox="0 0 56 40" aria-hidden className="h-full w-full">
      <path
        d={path}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-muted"
      />
      {fraction !== null && (
        <path
          d={path}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={arcLength * (1 - fraction)}
          className="stroke-accent transition-[stroke-dashoffset] duration-(--duration-micro) ease-out"
        />
      )}
      {angle !== null && (
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy - needleLen}
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-ink transition-transform duration-(--duration-micro) ease-out"
          transform={`rotate(${String(angle)} ${String(cx)} ${String(cy)})`}
        />
      )}
      <circle cx={cx} cy={cy} r="2.5" className="fill-ink" />
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fontSize="12"
        className={cn(
          "font-semibold tabular-nums",
          value === null ? "fill-ink-subtle" : "fill-ink",
        )}
      >
        {value === null ? "—" : formatRpe(value)}
      </text>
    </svg>
  );
}
