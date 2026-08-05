interface Props {
  readonly label: string;
  readonly id: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
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
 *
 * Lives in the feature rather than the design system: it has one consumer. It
 * moves to `design-system/` the day a second form needs it.
 */
export function Field({ label, id, error, hint, children }: Props) {
  const message = error ?? hint;
  const messageId = `${id}-message`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
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
            error === undefined ? "text-xs text-ink-subtle" : "text-xs text-danger"
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}
