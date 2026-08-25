import { DEFAULT_DENSITY, DENSITY_ATTRIBUTE, DENSITY_STORAGE_KEY } from "./density";

/**
 * Applies the density before the browser paints anything — the same
 * reasoning as `ThemeScript`. Without this, every button would render at
 * `default` height and then resize once React hydrates, which reads as a
 * layout jump rather than a preference taking effect.
 */
const source = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(DENSITY_STORAGE_KEY)});
var d=(s==="compact"||s==="default"||s==="comfortable")?s:${JSON.stringify(DEFAULT_DENSITY)};
document.documentElement.setAttribute(${JSON.stringify(DENSITY_ATTRIBUTE)},d);
}catch(_){}})();`;

/** Exported so the tests can execute the real script rather than a copy. */
export const densityScriptSource = source;

/**
 * `nonce` comes from `RootLayout` — see the matching doc comment on
 * `ThemeScript` for why it is required now that `script-src` is nonce-only.
 */
export function DensityScript({ nonce }: { readonly nonce?: string | undefined }) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: source }} />;
}
