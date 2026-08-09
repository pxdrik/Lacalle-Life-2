/**
 * What the body log publishes to the rest of the app.
 *
 * One hook. Everything else — the editor, the chart, the repository — is this
 * feature's own business, and the profile needing a single number is not a
 * reason to open the rest of it.
 */
export { useLatestWeighIn, type WeighIn } from "./hooks/use-latest-weigh-in";
