import { creditsFor, type ExerciseMedia } from "../taxonomy/media-sources";

/**
 * The credit CC-BY-SA obliges us to show wherever the photos are.
 *
 * Takes the photos actually on screen rather than listing every source we have
 * ever used: crediting an author whose work is not being shown is noise, and
 * failing to credit one whose work *is* being shown is a licence breach. The
 * list is derived, so a new photo brings its own credit with it and there is
 * no second place to keep in sync.
 *
 * Renders nothing when nothing on screen needs crediting.
 */
export function MediaAttribution({
  media,
}: {
  readonly media: readonly (ExerciseMedia | null)[];
}) {
  const credits = creditsFor(media);
  if (credits.length === 0) return null;

  return (
    <p className="px-3 py-4 text-xs text-ink-subtle">
      Fotos dos exercícios por{" "}
      {credits.map((credit, index) => (
        <span key={`${credit.author}|${credit.license}`}>
          {index > 0 && (index === credits.length - 1 ? " e " : ", ")}
          {credit.author}
          {" ("}
          <Link href={credit.licenseUrl}>{credit.license}</Link>
          {", via "}
          <Link href={credit.sourceUrl}>{credit.repository}</Link>
          {")"}
        </span>
      ))}
      .
    </p>
  );
}

function Link({
  href,
  children,
}: {
  readonly href: string;
  readonly children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="underline underline-offset-2 hover:text-ink"
    >
      {children}
    </a>
  );
}
