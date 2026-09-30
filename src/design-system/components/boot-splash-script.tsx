/**
 * A transição de entrada só na abertura do app, não em todo recarregamento
 * (roadmap 8.12, 30/09/2026).
 *
 * O Pedro via a transição "ao abrir uma aba". No app a troca de aba nunca
 * recarrega a página (toda navegação interna é `Link`), mas o iPhone tira o
 * app instalado da memória em segundo plano e, na volta, recarrega a página
 * do zero — para o código, idêntico a abrir o app. A marca em
 * `sessionStorage` separa os dois: a sessão dura até fechar o app de verdade,
 * e sobrevive a esse recarregamento do sistema. O Finance já faz o mesmo
 * ("no máximo uma vez por sessão").
 *
 * Roda antes da hidratação, como `ThemeScript`: decidir em React deixaria a
 * transição, que já vem no HTML do servidor, aparecer por um quadro. Aqui ela
 * é escondida por CSS antes do primeiro paint (`globals.css`,
 * `[data-splash="skip"]`).
 *
 * O `try` cobre armazenamento bloqueado: sem ele o script abortaria, e sem
 * marca a transição aparece normalmente, que é o comportamento seguro.
 */
export const SPLASH_SESSION_KEY = "lacalle-life.splash-shown";
export const SPLASH_ATTRIBUTE = "data-splash";

const source = `(function(){try{
var k=${JSON.stringify(SPLASH_SESSION_KEY)};
if(sessionStorage.getItem(k)){document.documentElement.setAttribute(${JSON.stringify(SPLASH_ATTRIBUTE)},"skip");}
else{sessionStorage.setItem(k,"1");}
}catch(_){}})();`;

/** Exportado para os testes executarem o script real, não uma cópia. */
export const bootSplashScriptSource = source;

/**
 * Mesmo raciocínio de segurança de `ThemeScript`: `source` é uma constante do
 * módulo, e as únicas interpolações são duas constantes de compilação passadas
 * por `JSON.stringify`. O `nonce` é o mesmo que a CSP espera.
 */
export function BootSplashScript({
  nonce,
}: {
  readonly nonce?: string | undefined;
}) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: source }} />;
}
