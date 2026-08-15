import { ImageResponse } from "next/og";

import {
  ICON_GRADIENT,
  ICON_SYMBOL_RATIO,
  MARK_ICON_PATH,
  MARK_ICON_VIEWBOX,
} from "@/design-system/brand/mark";

/**
 * O ícone da tela de início no iOS.
 *
 * O iOS ignora os ícones do manifesto e lê `apple-touch-icon`, e não aceita
 * SVG. Sem isto, adicionar o app à tela de início produz uma captura da página
 * que estivesse aberta — que é como um PWA anuncia que ninguém testou instalar.
 *
 * Gerado em vez de commitado como binário, e agora **importando o traço** em
 * vez de repeti-lo: um PNG no repositório é uma segunda cópia da arte, e o path
 * escrito à mão aqui era uma terceira. Todas as três agora saem de
 * `design-system/brand/mark`.
 *
 * Sem cantos arredondados, ao contrário de `icon.svg`: o iOS aplica a própria
 * máscara, e cantos assados na imagem aparecem como um quadrado arredondado
 * flutuando dentro do arredondamento do sistema. O enquadramento do símbolo é o
 * mesmo dos outros dois — 46% da largura, pág. 15 — porque "só o fundo muda".
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const SYMBOL = size.width * ICON_SYMBOL_RATIO;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(${String(ICON_GRADIENT.angle)}deg, ${ICON_GRADIENT.from}, ${ICON_GRADIENT.to})`,
        }}
      >
        {/* `width` só, com a altura seguindo o viewBox: a silhueta não é
            quadrada, e fixar as duas a distorceria — o que a pág. 13 lista
            entre os usos proibidos. */}
        <svg width={SYMBOL} viewBox={MARK_ICON_VIEWBOX}>
          <path d={MARK_ICON_PATH} fill="#FFFFFF" />
        </svg>
      </div>
    ),
    size,
  );
}
