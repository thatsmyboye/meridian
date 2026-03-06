import React from "react";
import { Text as RNText } from "react-native";

export interface TextProps {
  children: React.ReactNode;
  variant?: "heading" | "body" | "caption";
}

export function Text({ children, variant = "body" }: TextProps) {
  const className = {
    heading: "text-2xl font-bold text-gray-900",
    body: "text-base text-gray-700",
    caption: "text-sm text-gray-500",
  }[variant];

  return <RNText className={className}>{children}</RNText>;
}
