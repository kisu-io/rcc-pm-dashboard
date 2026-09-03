import { describe, test, expect } from 'vitest';
import { escapeLike, folderPathOf, childFolderPattern, rewriteFolderPath } from './documents';

describe('escapeLike', () => {
  test('escapes LIKE wildcards so a folder name cannot widen the match', () => {
    expect(escapeLike('100%_done')).toBe('100\\%\\_done');
  });

  test('leaves an ordinary name untouched', () => {
    expect(escapeLike('Level 1')).toBe('Level 1');
  });
});

describe('folderPathOf', () => {
  test('joins a nested folder onto its parent path', () => {
    expect(folderPathOf('Level 1', 'Kitchen')).toBe('Level 1/Kitchen');
  });

  test('returns the bare name at the drive root', () => {
    expect(folderPathOf(null, 'Level 1')).toBe('Level 1');
  });
});

describe('childFolderPattern', () => {
  test('anchors on the separator so sibling folders are not matched', () => {
    // The bug this guards: 'Level 1%' also matches 'Level 10' and 'Level 12'.
    const pattern = childFolderPattern(null, 'Level 1');
    expect(pattern).toBe('Level 1/%');
    expect(pattern.startsWith('Level 1/')).toBe(true);
  });

  test('escapes wildcards in the folder name', () => {
    expect(childFolderPattern(null, '50%_complete')).toBe('50\\%\\_complete/%');
  });

  test('includes the parent path for a nested folder', () => {
    expect(childFolderPattern('Level 1', 'Kitchen')).toBe('Level 1/Kitchen/%');
  });
});

describe('rewriteFolderPath', () => {
  test('renames the folder itself', () => {
    expect(rewriteFolderPath('Level 1', 'Level 1', 'Level 01')).toBe('Level 01');
  });

  test('renames a descendant', () => {
    expect(rewriteFolderPath('Level 1/Kitchen', 'Level 1', 'Level 01')).toBe('Level 01/Kitchen');
  });

  test('leaves a sibling with a shared prefix alone', () => {
    expect(rewriteFolderPath('Level 10/Kitchen', 'Level 1', 'Level 01')).toBe('Level 10/Kitchen');
  });

  test('passes a root-level document through', () => {
    expect(rewriteFolderPath(null, 'Level 1', 'Level 01')).toBe(null);
  });
});
