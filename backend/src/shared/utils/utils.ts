export function parseS3Uri(s3Uri: string): { bucket: string; key: string } {
  const match = s3Uri.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid S3 URI: ${s3Uri}`);
  }
  return { bucket: match[1], key: match[2] };
}

export function buildS3Uri(bucket: string, key: string): string {
  return `s3://${bucket}/${key}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function calculateMaxWords(
  durationSeconds: number,
  wordsPerSecond = 2.5,
): number {
  const maxWords = Math.floor(durationSeconds * wordsPerSecond);
  return Math.max(5, maxWords);
}

export function sanitizeForDisplay(text: string): string {
  return text.replace(/'/g, '').replace(/:/g, '-').replace(/"/g, '').trim();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(text.length - maxLength);
}

export function normalizeTimeRangeValues(
  start: number,
  end: number,
): { start: number; end: number; duration: number } | null {
  const normalizedStart = Math.min(start, end);
  const normalizedEnd = Math.max(start, end);
  const duration = normalizedEnd - normalizedStart;

  if (duration <= 0) return null;

  return {
    start: Math.max(0, normalizedStart),
    end: normalizedEnd,
    duration,
  };
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delayMs?: number; backoff?: number } = {},
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, backoff = 2 } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * Math.pow(backoff, attempt - 1)),
        );
      }
    }
  }

  throw lastError;
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
