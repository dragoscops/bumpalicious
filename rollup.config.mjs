import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import copy from 'rollup-plugin-copy';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
    sourcemap: false,
    banner: '#!/usr/bin/env node',
    inlineDynamicImports: true, // Bundle dynamic imports into a single file
  },
  external: [
    // Node.js built-ins
    'fs',
    'path',
    'child_process',
    'stream',
    'util',
    'events',
    'os',
    'url',
    'crypto',
    'http',
    'https',
    'net',
    'tls',
    'zlib',
    'buffer',
    'string_decoder',
    'assert',
  ],
  plugins: [
    // Resolve node modules
    resolve({
      preferBuiltins: true,
      exportConditions: ['node'],
    }),

    // Convert CommonJS to ES modules
    commonjs(),

    // Handle JSON imports
    json(),

    // Copy template files from conventional-changelog packages
    copy({
      targets: [
        {
          src: 'node_modules/conventional-changelog-angular/src/templates/*',
          dest: 'dist/templates/angular',
        },
        {
          src: 'node_modules/conventional-changelog-atom/src/templates/*',
          dest: 'dist/templates/atom',
        },
        {
          src: 'node_modules/conventional-changelog-codemirror/src/templates/*',
          dest: 'dist/templates/codemirror',
        },
        {
          src: 'node_modules/conventional-changelog-conventionalcommits/src/templates/*',
          dest: 'dist/templates/conventionalcommits',
        },
        {
          src: 'node_modules/conventional-changelog-ember/src/templates/*',
          dest: 'dist/templates/ember',
        },
        {
          src: 'node_modules/conventional-changelog-eslint/src/templates/*',
          dest: 'dist/templates/eslint',
        },
        {
          src: 'node_modules/conventional-changelog-express/src/templates/*',
          dest: 'dist/templates/express',
        },
        {
          src: 'node_modules/conventional-changelog-jshint/src/templates/*',
          dest: 'dist/templates/jshint',
        },
        {
          src: 'node_modules/conventional-changelog-jquery/src/templates/*',
          dest: 'dist/templates/jquery',
        },
      ],
      hook: 'writeBundle',
      verbose: true,
    }),

    // Compile TypeScript
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationMap: false,
    }),
  ],
};
