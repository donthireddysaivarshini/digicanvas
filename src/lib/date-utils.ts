/**
 * Timezone-aware date & time manipulation utilities for DigiCanvas.
 * Ensures all user-entered dates/times in client organization timezones
 * are accurately converted to/from UTC database timestamps without drift.
 */

/**
 * Calculates the UTC offset in minutes for a specific date in a specific IANA timezone.
 */
function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      partMap[part.type] = parseInt(part.value, 10);
    }
  }

  const localTimeInTz = new Date(
    Date.UTC(
      partMap.year,
      partMap.month - 1,
      partMap.day,
      partMap.hour % 24,
      partMap.minute,
      partMap.second
    )
  );

  return (localTimeInTz.getTime() - date.getTime()) / (60 * 1000);
}

/**
 * Combines a local date string (YYYY-MM-DD) and local time string (HH:mm)
 * within an organization's IANA timezone into an exact UTC Date object.
 */
export function combineDateAndTimeInTimezone(
  dateStr: string,
  timeStr: string,
  timezone: string = "Asia/Kolkata"
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = (timeStr || "12:00").split(":").map(Number);

  // Initial estimate assuming UTC
  const estimateUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  
  // Refine using calculated timezone offset
  const offsetMinutes = getTimezoneOffsetMinutes(estimateUtc, timezone);
  const finalUtcTimestamp = estimateUtc.getTime() - offsetMinutes * 60 * 1000;
  
  return new Date(finalUtcTimestamp);
}

/**
 * Returns UTC boundaries (start of day 00:00:00 and end of day 23:59:59.999)
 * for a date range in the given organization timezone.
 */
export function getTimezoneRangeBoundaries(
  startDateStr: string,
  endDateStr: string,
  timezone: string = "Asia/Kolkata"
): { startUtc: Date; endUtc: Date } {
  const startUtc = combineDateAndTimeInTimezone(startDateStr, "00:00", timezone);
  
  // End of day is 23:59:59.999
  const [year, month, day] = endDateStr.split("-").map(Number);
  const estimateUtc = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  const offsetMinutes = getTimezoneOffsetMinutes(estimateUtc, timezone);
  const endUtc = new Date(estimateUtc.getTime() - offsetMinutes * 60 * 1000);

  return { startUtc, endUtc };
}

/**
 * Formats a UTC Date to a readable date in the target timezone (e.g., "Sep 24, 2026").
 */
export function formatDateInTimezone(
  date: Date | string,
  timezone: string = "Asia/Kolkata",
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(d);
}

/**
 * Formats a UTC Date to a local time string in the target timezone (e.g., "7:00 PM").
 */
export function formatTimeInTimezone(
  date: Date | string,
  timezone: string = "Asia/Kolkata"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Returns ISO date string (YYYY-MM-DD) for a Date in target timezone.
 */
export function getDateStringInTimezone(
  date: Date | string,
  timezone: string = "Asia/Kolkata"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      partMap[part.type] = part.value;
    }
  }
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

/**
 * Returns HH:mm (24-hour format) time string for a Date in target timezone.
 */
export function getTimeStringInTimezone(
  date: Date | string,
  timezone: string = "Asia/Kolkata"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      partMap[part.type] = part.value;
    }
  }
  return `${partMap.hour}:${partMap.minute}`;
}
