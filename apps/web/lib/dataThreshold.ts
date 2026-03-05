/**
 * Utility functions for checking data thresholds and calculating insights readiness.
 */

export interface ContentItem {
  publishedAt: string;
}

export interface DataThresholdInfo {
  daysSinceFirstContent: number;
  hasMinimumData: boolean; // true if >= 30 days
  estimatedDaysUntilInsights: number; // estimated days remaining until 30 days
  averagePostsPerDay: number;
}

/**
 * Calculates data threshold information based on content publish dates.
 * Returns insights about whether the creator has enough data for pattern generation.
 */
export function calculateDataThreshold(
  content: ContentItem[],
): DataThresholdInfo {
  const MINIMUM_DAYS = 30;

  if (content.length === 0) {
    return {
      daysSinceFirstContent: 0,
      hasMinimumData: false,
      estimatedDaysUntilInsights: MINIMUM_DAYS,
      averagePostsPerDay: 0,
    };
  }

  // Find the oldest content
  const publishedDates = content.map((c) => new Date(c.publishedAt).getTime());
  const oldestTime = Math.min(...publishedDates);
  const newestTime = Math.max(...publishedDates);
  const now = Date.now();

  // Calculate days since first content
  const daysSinceFirstContent = Math.floor(
    (now - oldestTime) / (24 * 60 * 60 * 1000),
  );

  const hasMinimumData = daysSinceFirstContent >= MINIMUM_DAYS;

  // Calculate average posts per day (from oldest to newest content)
  const daysBetweenFirstAndLast = Math.max(
    1,
    Math.floor((newestTime - oldestTime) / (24 * 60 * 60 * 1000)),
  );
  const averagePostsPerDay = content.length / (daysBetweenFirstAndLast + 1);

  // Estimate days until insights (30 days total)
  const estimatedDaysUntilInsights = hasMinimumData
    ? 0
    : Math.ceil((MINIMUM_DAYS - daysSinceFirstContent) / averagePostsPerDay);

  return {
    daysSinceFirstContent,
    hasMinimumData,
    estimatedDaysUntilInsights,
    averagePostsPerDay,
  };
}

/**
 * Returns a human-readable estimate of when insights will be available.
 */
export function getInsightsReadinessMessage(info: DataThresholdInfo): string {
  if (info.hasMinimumData) {
    return "Your pattern insights are ready!";
  }

  const daysRemaining = info.estimatedDaysUntilInsights;

  if (daysRemaining === 0) {
    return "Pattern insights coming soon!";
  }

  if (daysRemaining <= 1) {
    return "Insights arriving tomorrow!";
  }

  return `Insights in ~${daysRemaining} days`;
}
