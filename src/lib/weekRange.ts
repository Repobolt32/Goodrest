export function getCurrentWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const indiaTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const dayOfWeek = indiaTime.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(indiaTime);
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
}
