/** Helpers for turning a Supabase write into a result the UI can trust.
 *
 *  A write blocked by row-level security does NOT return an error — PostgREST
 *  reports success with zero rows affected. Every mutation must therefore ask for
 *  the affected rows back and check how many came out, or a read-only user sees
 *  "saved" for work that was silently discarded.
 */

export const NO_PERMISSION_MESSAGE =
  'Không lưu được — bạn không có quyền ghi (cần role PM hoặc Admin). Thử đăng xuất rồi đăng nhập lại.';

export type WriteResult = { ok: true } | { ok: false; message: string };

function isRlsMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('row-level security') || m.includes('rls') || m.includes('permission denied');
}

/**
 * Validate a Supabase mutation that used `.select()`.
 *
 * @param error rows-returned error from PostgREST, if any
 * @param rows  the rows the write actually affected (`data` from `.select()`)
 * @param expected how many rows the caller expected to change; omit to accept 1+
 */
export function checkWrite(
  error: { message: string } | null,
  rows: unknown[] | null,
  expected?: number,
): WriteResult {
  if (error) {
    return { ok: false, message: isRlsMessage(error.message) ? NO_PERMISSION_MESSAGE : error.message };
  }
  const affected = rows?.length ?? 0;
  if (expected === undefined ? affected < 1 : affected !== expected) {
    return { ok: false, message: NO_PERMISSION_MESSAGE };
  }
  return { ok: true };
}
