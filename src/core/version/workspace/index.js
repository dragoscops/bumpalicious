/**
 * Project type detectors - auto detects project type, name, and version
 * @module detect
 */

import * as deno from './deno.js';
import * as go from './go.js';
import * as node from './node.js';
import * as python from './python.js';
import * as rust from './rust.js';
import * as text from './text.js';
import * as zig from './zig.js';

export default {
  deno,
  go,
  node,
  python,
  rust,
  text,
  zig,
};

export {deno, go, node, python, rust, text, zig};
