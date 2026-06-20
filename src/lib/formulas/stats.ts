const MS_PER_HOUR = 60 * 60 * 1000;
const MIN_TIMER_HOURS = 1;

/** Timer (hours) = 13 − 1.02517^L where L is the stat level before upgrade. */
export function getUpgradeTimerHours(level: number): number {
  const clamped = Math.min(Math.max(0, level), 100);
  const hours = 13 - Math.pow(1.02517, clamped);
  return Math.max(MIN_TIMER_HOURS, hours);
}

export function getUpgradeTimerMs(level: number): number {
  return Math.round(getUpgradeTimerHours(level) * MS_PER_HOUR);
}
