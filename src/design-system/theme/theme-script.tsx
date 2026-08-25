import { DEFAULT_THEME, THEME_ATTRIBUTE, THEME_STORAGE_KEY } from "./theme";

/**
 * Applies the theme before the browser paints anything.
 *
 * React cannot do this: the server has no way to know a preference that lives
 * in the visitor's storage, so any React-driven solution renders the wrong
 * theme first and corrects it — the white flash every dark-mode app has.
 *
 * The `try` is not defensive noise. `localStorage` throws outright when a
 * browser is configured to block storage, and an exception here would abort
 * the script and leave the page unthemed.
 */
const source = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var p=(s==="light"||s==="dark"||s==="system")?s:${JSON.stringify(DEFAULT_THEME)};
var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
var t=d?"dark":"light";
var e=document.documentElement;
e.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},t);
e.style.colorScheme=t;
}catch(_){}})();`;

/** Exported so the tests can execute the real script rather than a copy. */
export const themeScriptSource = source;

/**
 * `dangerouslySetInnerHTML` is the only way to emit an inline script, and it
 * is safe here by construction: `source` is a module-level constant whose
 * only interpolations are two compile-time constants passed through
 * `JSON.stringify`. No value reaches it at runtime, from storage or anywhere
 * else — the script *reads* storage, it is never *built* from it.
 *
 * `nonce` comes from `RootLayout`, which reads it off the `x-nonce` request
 * header `middleware.ts` sets alongside the same value in the
 * `Content-Security-Policy` response header. Without it, `script-src`'s
 * nonce-only policy would block this exact script — the one legitimate
 * inline script in the app has to carry the same token the policy expects.
 */
export function ThemeScript({ nonce }: { readonly nonce?: string | undefined }) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: source }} />;
}
