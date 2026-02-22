import React from "react";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({
  label,
  onPress,
  disabled = false,
  variant = "primary",
}: ButtonProps) {
  return (
    <button onClick={onPress} disabled={disabled} data-variant={variant}>
      {label}
    </button>
  );
}
