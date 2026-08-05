import { DataError, type DataErrorCode } from "@/core/domain/data-error";

/**
 * Translates what the browser's storage APIs throw into the domain's closed
 * set of failure codes, so that callers branch on a known set instead of
 * sniffing `DOMException` names.
 */
const DOM_EXCEPTION_CODES: Readonly<Record<string, DataErrorCode>> = {
  QuotaExceededError: "QUOTA_EXCEEDED",
  InvalidStateError: "UNAVAILABLE",
  SecurityError: "UNAVAILABLE",
  NotSupportedError: "UNAVAILABLE",
  VersionError: "BLOCKED",
};

/**
 * Already-normalised errors pass through untouched, so wrapping nested calls
 * never double-wraps.
 */
export function toDataError(cause: unknown): DataError {
  if (cause instanceof DataError) return cause;

  if (cause instanceof DOMException) {
    const code = DOM_EXCEPTION_CODES[cause.name] ?? "FAILED";
    return new DataError(code, cause.message || cause.name, { cause });
  }

  const message = cause instanceof Error ? cause.message : String(cause);
  return new DataError("FAILED", message, { cause });
}
