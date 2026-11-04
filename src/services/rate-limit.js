import '../config.js';
import { statusResult } from './utils.js';

const {
  RATE_LIMIT_KEY,
  DEFAULT_RETRY_SECONDS
} = globalThis.FLIGHT_ALERT_CONFIG;

// Check whether the OpenSky API rate limit is still active.
export async function getRateLimitStatus() {
  const stored = await chrome.storage.local.get(RATE_LIMIT_KEY);

  const until = Number(stored[RATE_LIMIT_KEY]) || 0;

  if (until <= Date.now()) {
    return null;
  }

  return statusResult('OpenSky rate limit active', {
    rateLimited: true,
    rateLimitedUntil: until,
    retryAfterSeconds: Math.ceil(
      (until - Date.now()) / 1000
    )
  });
}

// Save the OpenSky rate limit after receiving an HTTP 429 response.
export async function saveRateLimit(response) {
  const raw = response.headers.get(
    'X-Rate-Limit-Retry-After-Seconds'
  );

  const parsed = Number(raw);

  const seconds =
    raw !== null &&
    Number.isFinite(parsed) &&
    parsed > 0
      ? Math.ceil(parsed)
      : DEFAULT_RETRY_SECONDS;

  const until = Date.now() + seconds * 1000;

  await chrome.storage.local.set({
    [RATE_LIMIT_KEY]: until
  });

  return statusResult('OpenSky rate limit active', {
    rateLimited: true,
    rateLimitedUntil: until,
    retryAfterSeconds: seconds
  });
}
