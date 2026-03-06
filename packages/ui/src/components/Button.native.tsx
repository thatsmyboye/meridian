import React from "react";
import { Pressable, Text } from "react-native";

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
  const containerClass = [
    "px-4 py-3 rounded-lg items-center justify-center",
    variant === "primary" && "bg-blue-600",
    variant === "secondary" && "bg-gray-200",
    variant === "ghost" && "bg-transparent border border-blue-600",
    disabled && "opacity-50",
  ]
    .filter(Boolean)
    .join(" ");

  const labelClass = [
    "text-sm font-semibold",
    variant === "primary" && "text-white",
    variant === "secondary" && "text-gray-800",
    variant === "ghost" && "text-blue-600",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={containerClass}
      accessibilityRole="button"
    >
      <Text className={labelClass}>{label}</Text>
    </Pressable>
  );
}
