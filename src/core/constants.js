/**
 * List of potential version file names to check
 */
export const DENO_VERSION_FILES = ['deno.jsonc', 'deno.json', 'jsr.json', 'package.json'];

/**
 * List of potential Go version files to check
 */
export const GO_VERSION_FILES = [
  'go.mod',
  'version.go',
  'pkg/version/version.go',
  'internal/version/version.go',
  'cmd/version.go',
  'version',
];
