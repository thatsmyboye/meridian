/** Day marks (days after publication) at which we capture analytics snapshots. */
export const SNAPSHOT_DAY_MARKS = [1, 7, 30] as const;
export type DayMark = (typeof SNAPSHOT_DAY_MARKS)[number];
