/**
 * Default version to use when no version is specified
 */
export const DEFAULT_VERSION = '0.0.1';

/**
 * List of potential Go version files to check
 */
export const GO_VERSION_FILES = ['go.mod', '**/version.go'];

/**
 * List of potential Node.js version files to check
 */
export const NODE_VERSION_FILES = ['jsr.json', 'package.json'];

/**
 * List of potential Python version files to check
 */
export const PYTHON_VERSION_FILES = ['pyproject.toml', 'setup.py', 'setup.cfg', '__init__.py'];

/**
 * List of potential Rust version files to check
 */
export const RUST_VERSION_FILES = ['Cargo.toml'];

/**
 * List of potential Text version files to check
 */
export const TEXT_VERSION_FILES = ['version', 'version.txt', 'VERSION', 'VERSION.txt'];

/**
 * List of potential Zig version files to check
 */
export const ZIG_VERSION_FILES = ['build.zig', 'build.zig.zon'];
