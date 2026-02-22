/**
 * @meridian/inngest — Shared Inngest configuration
 *
 * Exports the Inngest app ID, typed event schemas, and (in E02) the
 * Inngest client instance used by all background job handlers.
 */

export { INNGEST_APP_ID } from "./client";
export type { MeridianEvents } from "./events";
