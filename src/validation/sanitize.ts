/** Strip control chars (except common whitespace) and normalize. */
export function sanitizePlainText(input: string, maxLength: number): string {
  const stripped = input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength);
}

export function sanitizeDisplayName(input: string): string {
  return sanitizePlainText(input, 32).replace(/\s+/g, ' ');
}

export function sanitizeRoomName(input: string): string {
  return sanitizePlainText(input, 48).replace(/\s+/g, ' ');
}
