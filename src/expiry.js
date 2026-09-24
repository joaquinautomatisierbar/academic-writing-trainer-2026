export const EXPIRY_INSTANT = '2026-09-25T18:00:00.000Z';

function timestamp(value) {
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new TypeError('Invalid date');
  return parsed;
}

export function isExpired(now = new Date(), expiry = EXPIRY_INSTANT) {
  return timestamp(now) >= timestamp(expiry);
}
