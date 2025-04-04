/**
 * List of potential version file names to check
 */
export const DENO_VERSION_FILES = ['deno.jsonc', 'deno.json', 'jsr.json', 'package.json'];

/**
 * List of potential Go version files to check
 */
export const GO_VERSION_FILES = [
  'go.mod',
  'pkg/version/version.go',
  'internal/version/version.go',
  'cmd/version.go',
  'version.go',
];

/**
 * List of potential Node.js version files to check
 */
export const NODE_VERSION_FILES = DENO_VERSION_FILES.slice(2);

/**
 * List of potential Python version files to check
 */
export const PYTHON_VERSION_FILES = ['pyproject.toml', 'setup.py', 'setup.cfg', '__init__.py'];

/**
 * List of potential Rust version files to check
 */
export const RUST_VERSION_FILES = ['Cargo.toml'];

/**
 * List of potential Rust version files to check
 */
export const TEXT_VERSION_FILES = ['version', 'version.txt', 'VERSION', 'VERSION.txt'];

/**
 * List of potential Zig version files to check
 */
export const ZIG_VERSION_FILES = ['build.zig', 'build.zig.zon'];
