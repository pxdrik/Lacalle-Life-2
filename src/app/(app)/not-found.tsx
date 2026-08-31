/**
 * Reaproveita o 404 global (`src/app/not-found.tsx`) em vez de duplicar seu
 * JSX. Existe como arquivo próprio, e não só como o global sozinho, para que
 * um `notFound()` chamado dentro de uma rota deste grupo — uma dieta ou um
 * treino apagado, por exemplo — caia aqui e continue dentro do chrome do
 * app (`(app)/layout.tsx`), em vez de estourar até a raiz e aparecer sem
 * sidebar. Um endereço totalmente inexistente, que não bate em nenhuma rota
 * deste grupo, continua caindo no `not-found.tsx` global — nenhum arquivo
 * aqui consegue interceptar isso, é a mecânica do App Router.
 *
 * `metadata` precisa do próprio re-export nomeado: o Next lê os exports do
 * arquivo desta rota especificamente, e não segue a cadeia até a definição
 * original sem essa linha.
 */
export { metadata } from "@/app/not-found";
export { default } from "@/app/not-found";
