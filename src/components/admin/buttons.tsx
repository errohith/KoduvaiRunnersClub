"use client";
import { useFormStatus } from "react-dom";

/**
 * Submit button for server-action forms. When `name`/`value` are given, the value is written to a
 * hidden input during the click (before the form submits), so the server action always receives
 * which button was pressed — React does not reliably forward the submitter's name/value here.
 */
export function SubmitButton({ children, className = "btn-dark btn-sm", confirm, name, value, disabled, ariaLabel }: { children: React.ReactNode; className?: string; confirm?: string; name?: string; value?: string; disabled?: boolean; ariaLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending || disabled}
      aria-label={ariaLabel}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        const form = e.currentTarget.form;
        if (name && form) {
          let input = form.querySelector<HTMLInputElement>(`input[type="hidden"][data-submitter="${name}"]`);
          if (!input) {
            input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            input.dataset.submitter = name;
            form.appendChild(input);
          }
          input.value = value ?? "";
        }
      }}
    >
      {pending ? "Working…" : children}
    </button>
  );
}
