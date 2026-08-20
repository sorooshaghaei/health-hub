export const WEEKDAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

function minutesFromTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value ?? "")) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function timeFromMinutes(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function weekdayForDateValue(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue ?? "")) return null;
  const date = new Date(`${dateValue}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const sundayFirst = date.getUTCDay();
  return sundayFirst === 0 ? 6 : sundayFirst - 1;
}

export function workingHoursForDate(workingHours, dateValue) {
  const weekday = weekdayForDateValue(dateValue);
  return workingHours.find((item) => Number(item.weekday) === weekday) ?? null;
}

export function suggestedAppointmentTimes(startTime, endTime) {
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  if (start === null || end === null || start >= end) return [];

  const suggestions = [];
  for (let value = start; value < end; value += 15) {
    suggestions.push(timeFromMinutes(value));
  }
  if (suggestions.at(-1) !== endTime) suggestions.push(endTime);
  return suggestions;
}
