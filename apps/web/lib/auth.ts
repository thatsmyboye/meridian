/**
 * Validates that a redirect path is safe (relative, no protocol-relative or open-redirect).
 */
export function isSafeRedirectPath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/\\") &&
    !path.includes("@")
  );
}
