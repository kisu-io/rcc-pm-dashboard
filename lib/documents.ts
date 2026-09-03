/** Pure helpers for the document drive. Kept free of React and Supabase so the
 *  path arithmetic can be unit-tested. */

/** Escape the LIKE wildcards so a folder name containing % or _ cannot widen the match. */
export function escapeLike(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

/** Full folder path of a document row, e.g. "Level 1/Kitchen". */
export function folderPathOf(folderPath: string | null | undefined, name: string): string {
  return folderPath ? `${folderPath}/${name}` : name;
}

/**
 * LIKE pattern matching a folder's descendants and nothing else.
 *
 * The naive pattern `${prefix}%` also matches sibling folders that merely start
 * with the same characters — deleting "Level 1" would sweep up "Level 10" and
 * "Level 12". Anchoring on the separator confines the match to real children;
 * the folder itself must be matched separately by equality.
 */
export function childFolderPattern(folderPath: string | null | undefined, name: string): string {
  return `${escapeLike(folderPathOf(folderPath, name))}/%`;
}

/** Rewrite a child's folder_path when its ancestor folder is renamed. */
export function rewriteFolderPath(
  childFolderPath: string | null | undefined,
  oldPrefix: string,
  newPrefix: string,
): string | null {
  if (!childFolderPath) return childFolderPath ?? null;
  if (childFolderPath === oldPrefix) return newPrefix;
  if (childFolderPath.startsWith(`${oldPrefix}/`)) {
    return `${newPrefix}${childFolderPath.slice(oldPrefix.length)}`;
  }
  return childFolderPath;
}

/** Marker stored in columns that hold a reference to a private storage object
 *  (e.g. projects.cover_url) instead of a directly fetchable URL. */
const STORAGE_REF_PREFIX = 'storage://';

export function toStorageRef(bucket: string, path: string): string {
  return `${STORAGE_REF_PREFIX}${bucket}/${path}`;
}

export function parseStorageRef(value: string | null | undefined): { bucket: string; path: string } | null {
  if (!value || !value.startsWith(STORAGE_REF_PREFIX)) return null;
  const rest = value.slice(STORAGE_REF_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}
