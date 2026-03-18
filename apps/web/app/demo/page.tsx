/**
 * /demo — Google OAuth verification demo
 *
 * A fully self-contained demo flow using sample data (no live API calls,
 * no authentication required). Walks through every app feature to satisfy
 * Google's OAuth app verification requirements.
 */
export const metadata = {
  title: "Meridian — App Demo",
  description: "Interactive demo of Meridian features for Google OAuth verification.",
};

import DemoFlow from "./DemoFlow";

export default function DemoPage() {
  return <DemoFlow />;
}
