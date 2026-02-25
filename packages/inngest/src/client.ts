import { EventSchemas, Inngest } from "inngest";
import type { MeridianEvents } from "./events";

export const INNGEST_APP_ID = "meridian" as const;

/**
 * Typed Inngest client shared across all Meridian background functions.
 *
 * Event schemas are registered via EventSchemas.fromRecord() so that every
 * send() and createFunction() call is fully type-safe.
 */
export const inngest = new Inngest({
  id: INNGEST_APP_ID,
  schemas: new EventSchemas().fromRecord<MeridianEvents>(),
});
