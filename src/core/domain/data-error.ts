/**
 * The ways reading or writing user data can fail.
 *
 * This lives in the domain, not next to the IndexedDB adapter, because it is
 * part of every repository's contract: a remote implementation can be
 * `UNAVAILABLE` or `BLOCKED` just as a local one can. Features branch on these
 * codes to explain themselves to the user, which they could not do if the type
 * belonged to one particular storage technology.
 *
 * Mapping a specific failure onto a code is the adapter's job — see
 * `core/storage/errors.ts`.
 */
export type DataErrorCode =
  /** Storage is missing or refused — private browsing, blocked storage. */
  | "UNAVAILABLE"
  /** Another client holds an older connection and blocks an upgrade. */
  | "BLOCKED"
  /** No room left. Only writes produce this. */
  | "QUOTA_EXCEEDED"
  /**
   * A versioned write's expected version no longer matches what is stored —
   * someone else wrote this record since it was read. The write did not
   * happen; nothing was overwritten.
   */
  | "CONFLICT"
  /** Anything else that went wrong mid-operation. */
  | "FAILED";

export class DataError extends Error {
  readonly code: DataErrorCode;

  constructor(code: DataErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DataError";
    this.code = code;
  }
}
