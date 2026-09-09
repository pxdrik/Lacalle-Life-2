"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Já chegou à tela" — uma vez, nunca repete ao rolar de volta.
 *
 * A verificação de `prefers-reduced-motion` decide antes de qualquer
 * `IntersectionObserver` ser criado: com a preferência ligada, o elemento já
 * nasce revelado. Não é a mesma tela sem CSS — é o conteúdo aparecendo direto,
 * a mesma regra que os três testes de identidade do Brandbook (pág. 52) já
 * provam para o resto do produto, agora estendida à Landing Page.
 *
 * `threshold: 0.2` em vez de qualquer valor: um card só conta como "chegou"
 * quando um quinto dele já está visível, não no primeiro pixel — evita
 * revelar tudo de uma vez num scroll rápido, onde tudo cruza a borda da tela
 * junto.
 */
/**
 * Sempre `false` na primeira renderização, no servidor e no cliente por
 * igual — nunca `typeof window` decidindo o estado inicial. Era exatamente
 * essa a divergência que produzia o aviso de hidratação do React: o
 * servidor não tem `window` e nascia revelado, o cliente tem e nascia
 * escondido, e o HTML enviado nunca batia com o que o React esperava
 * encontrar. `revealed` só muda dentro do callback do observer — nunca
 * direto no corpo do efeito — porque `setState` síncrono ali é a regra que
 * o próprio ESLint deste projeto bloqueia (`react-hooks/set-state-in-effect`).
 *
 * `prefers-reduced-motion` não decide se revela, só decide a transição —
 * essa parte é inteiramente CSS (`motion-reduce:transition-none` em quem usa
 * o hook), a mesma divisão de responsabilidade que `--animate-pop
 * motion-reduce:animate-none` já usa em todo outro lugar do app. Continua
 * verdade que nenhuma informação depende de movimento: o que muda é só
 * quando a transição some, nunca se o conteúdo aparece.
 */
export function useReveal<T extends Element>() {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting === true) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, revealed };
}
