"use client";

import { useFormStatus } from "react-dom";

export type FormSubmitButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  pendingLabel?: string;
  pendingClassName?: string;
};

export function FormSubmitButton({
  children,
  pendingLabel = "Обработка…",
  className,
  pendingClassName = "cursor-wait opacity-70 motion-safe:animate-pulse",
  disabled,
  ...rest
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  const mergedClass = [className, pending ? pendingClassName : null].filter(Boolean).join(" ");
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={mergedClass || undefined}
      {...rest}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
