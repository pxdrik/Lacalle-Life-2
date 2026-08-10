/**
 * What the body log publishes to the rest of the app.
 *
 * Two hooks and one card. Everything else — the editor, the chart, the
 * repository — is this feature's own business, and a consumer needing a single
 * number is not a reason to open the rest of it.
 *
 * The two hooks look similar and are not interchangeable: one answers "has the
 * profile's weight gone stale", the other "is the weight going anywhere". They
 * stay separate so neither grows the other's concerns.
 */
export { useLatestWeighIn, type WeighIn } from "./hooks/use-latest-weigh-in";
export {
  useWeightProgress,
  type WeightProgress,
} from "./hooks/use-weight-progress";
export { TodayProgress } from "./components/today-progress";
