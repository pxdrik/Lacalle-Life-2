/**
 * Storage failures the application is expected to handle differently.
 *
 * Everything a browser can throw at us collapses into one of these, so that
 * callers branch on a closed set instead of sniffing `DOMException` names.
 */
export type StorageErrorCode =
  /** IndexedDB is missing or refused — private browsing, disabled storage. */
  | "UNAVAILABLE"
  /** Another tab holds an older connection open and blocks the upgrade. */
  | "BLOCKED"
  /** The origin's storage quota is full. Only writes produce this. */
  | "QUOTA_EXCEEDED"
  /** The transaction aborted for any other reason. */
  | "TRANSACTION_FAILED";

export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageError";
    this.code = code;
  }
}

const DOM_EXCEPTION_CODES: Readonly<Record<string, StorageErrorCode>> = {
  QuotaExceededError: "QUOTA_EXCEEDED",
  InvalidStateError: "UNAVAILABLE",
  SecurityError: "UNAVAILABLE",
  NotSupportedError: "UNAVAILABLE",
  VersionError: "BLOCKED",
};

/**
 * Normalises anything thrown by the IndexedDB layer into a `StorageError`.
 * Already-normalised errors pass through untouched so that wrapping nested
 * calls never double-wraps.
 */
export function toStorageError(cause: unknown): StorageError {
  if (cause instanceof StorageError) return cause;

  if (cause instanceof DOMException) {
    const code = DOM_EXCEPTION_CODES[cause.name] ?? "TRANSACTION_FAILED";
    return new StorageError(code, cause.message || cause.name, { cause });
  }

  const message = cause instanceof Error ? cause.message : String(cause);
  return new StorageError("TRANSACTION_FAILED", message, { cause });
}
