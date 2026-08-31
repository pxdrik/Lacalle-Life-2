"use client";

/**
 * Reaproveita o boundary de erro global (`src/app/error.tsx`) em vez de
 * duplicar seu JSX. Um `error.tsx` próprio aqui — mesmo sendo um re-export —
 * é o que faz um erro de render dentro deste grupo continuar dentro do
 * chrome do app: o boundary criado por este arquivo envolve só o que está
 * abaixo dele na árvore (as páginas), nunca o próprio `(app)/layout.tsx` que
 * o define, então um erro em `Sidebar`/`AppNav` ainda sobe até o `error.tsx`
 * global — que é exatamente por que aquele continua existindo na raiz (ver o
 * comentário lá).
 *
 * **A diretiva é obrigatória neste arquivo, não só no original.** A
 * primeira versão disto era um re-export puro sem `"use client"`, e o Next
 * recusou: cada arquivo especial `error.tsx` é checado individualmente pela
 * diretiva no seu próprio topo, não pela cadeia de módulos que ele resolve —
 * a referência re-exportada já ser um Client Component não basta.
 */
export { default } from "@/app/error";
