import React from "react";

export interface TextProps {
  children: React.ReactNode;
  variant?: "heading" | "body" | "caption";
}

export function Text({ children, variant = "body" }: TextProps) {
  if (variant === "heading") return <h1>{children}</h1>;
  if (variant === "caption") return <small>{children}</small>;
  return <p>{children}</p>;
}
