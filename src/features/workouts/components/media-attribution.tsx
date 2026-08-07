import { MEDIA_SOURCES } from "../taxonomy/media-sources";

/**
 * The credit line CC-BY-SA obliges us to show wherever the photos are.
 *
 * Rendered from `MEDIA_SOURCES`, so adding a source adds its attribution and
 * there is no second place to keep in sync. Quiet by design — a licence is a
 * duty to the author, not a banner for the user.
 */
export function MediaAttribution() {
  return (
    <p className="px-3 py-4 text-xs text-ink-subtle">
      Fotos dos exercícios por{" "}
      {Object.values(MEDIA_SOURCES).map((source, index) => (
        <span key={source.sourceUrl}>
          {index > 0 && ", "}
          <a
            href={source.authorUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-ink"
          >
            {source.author}
          </a>
          {", via "}
          <a
            href={source.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-ink"
          >
            {source.repository}
          </a>
          {", sob "}
          <a
            href={source.licenseUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-ink"
          >
            {source.license}
          </a>
        </span>
      ))}
      .
    </p>
  );
}
