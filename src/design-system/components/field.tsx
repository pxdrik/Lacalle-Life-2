interface Props {
  /**
   * Node rather than string so a label can carry a mark beside its words —
   * the macro fields put the nutrient's colour dot here, which is the only way
   * the app's macro coding reaches the one screen where those three numbers
   * are typed rather than read.
   */
  readonly label: React.ReactNode;
  readonly id: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  /** Dims the label alongside the control it names. */
  readonly disabled?: boolean;
  readonly children: (control: {
    readonly id: string;
    readonly describedBy: string | undefined;
    readonly invalid: boolean;
  }) => React.ReactNode;
}

/**
 * Label, control, and the one message below it.
 *
 * An error replaces the hint rather than stacking under it: two lines of
 * guidance, one a correction and one advice, read as noise exactly when the
 * user is already stuck.
 *
 * `children` is a function so the message can actually be wired to the control
 * through `aria-describedby`. Taking a plain `ReactNode` would mean the
 * message is visible but unannounced — the field would look accessible while
 * a screen reader reads the label and stops.
 */
export function Field({ label, id, error, hint, disabled, children }: Props) {
  const message = error ?? hint;
  const messageId = `${id}-message`;

  return (
    <div
      className={disabled === true ? "space-y-1.5 opacity-45" : "space-y-1.5"}
    >
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-sm font-medium text-ink"
      >
        {label}
      </label>

      {children({
        id,
        describedBy: message === undefined ? undefined : messageId,
        invalid: error !== undefined,
      })}

      {message !== undefined && (
        <p
          id={messageId}
          className={
            error === undefined
              ? "text-xs text-ink-subtle"
              : "text-xs text-danger"
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}
