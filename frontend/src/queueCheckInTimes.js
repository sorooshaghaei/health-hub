export function checkInMinuteKey(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor(timestamp / 60000);
}

export function sharedCheckInMinuteKeys(queue) {
  const counts = new Map();
  for (const item of queue) {
    const key = checkInMinuteKey(item.checked_in_at);
    if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}
