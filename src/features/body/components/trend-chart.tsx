import { formatShortDay, type TrendPoint } from "../services/body-log";

interface Props {
  readonly points: readonly TrendPoint[];
  /** Smoothed line drawn over the readings, when there are enough of them. */
  readonly average: readonly TrendPoint[];
  readonly unit: string;
  readonly label: string;
}

const HEIGHT = 160;
const WIDTH = 600;
const PAD = 8;

/**
 * A line, not bars.
 *
 * Bars start at zero and body weight does not: a run from 82 to 78 kg is a
 * five percent change, and drawn as bars it is four identical rectangles. The
 * y-axis here spans only the range actually recorded, which is the whole point
 * — you are looking for the direction, not the magnitude.
 *
 * SVG rather than a charting library, for the same reason `VolumeChart` uses
 * divs: this is a polyline and some text, and Recharts would be the largest
 * dependency in the app.
 *
 * The readings are also rendered as a real table for screen readers, because
 * `role="img"` on a chart announces "chart" and stops.
 */
export function TrendChart({ points, average, unit, label }: Props) {
  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; give it a band so the line sits
  // mid-height instead of collapsing onto an edge.
  const span = max - min || Math.max(max * 0.02, 1);

  const x = (index: number) =>
    points.length === 1
      ? WIDTH / 2
      : PAD + (index / (points.length - 1)) * (WIDTH - PAD * 2);

  const y = (value: number) =>
    HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2);

  const line = points.map((point, index) => `${x(index)},${y(point.value)}`);
  const smooth = average.map((point, index) => `${x(index)},${y(point.value)}`);

  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <svg
        aria-hidden
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-40 w-full overflow-visible"
      >
        {average.length > 1 && (
          <polyline
            points={smooth.join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={6}
            strokeOpacity={0.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        <polyline
          points={line.join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((point, index) => (
          <circle
            key={point.day}
            cx={x(index)}
            cy={y(point.value)}
            r={3}
            fill="var(--accent)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div
        aria-hidden
        className="mt-2 flex justify-between font-mono text-[0.625rem] tabular-nums text-ink-subtle"
      >
        <span>{formatShortDay(points[0]?.day ?? "")}</span>
        <span>
          {min.toLocaleString("pt-BR")}–{max.toLocaleString("pt-BR")} {unit}
        </span>
        <span>{formatShortDay(points.at(-1)?.day ?? "")}</span>
      </div>

      <figcaption className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">{label}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.day}>
                <th scope="row">{formatShortDay(point.day)}</th>
                <td>
                  {point.value.toLocaleString("pt-BR")} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
