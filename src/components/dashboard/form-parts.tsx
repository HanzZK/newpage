"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/dashboard/action-state";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children = "შენახვა",
  variant = "default",
  size = "default",
  className,
}: {
  children?: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      className={className}
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

export function FormStatus({ state }: { state: ActionState }) {
  if (!state.message) return null;

  return (
    <p
      role="status"
      className={cn(
        "text-sm",
        state.ok ? "text-muted-foreground" : "text-destructive",
      )}
    >
      {state.message}
    </p>
  );
}

type BaseFieldProps = {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

export function Field({
  name,
  label,
  hint,
  defaultValue,
  placeholder,
  required,
  className,
  type = "text",
}: BaseFieldProps & { type?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextField({
  name,
  label,
  hint,
  defaultValue,
  placeholder,
  required,
  rows = 4,
  className,
}: BaseFieldProps & { rows?: number }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      <Textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
