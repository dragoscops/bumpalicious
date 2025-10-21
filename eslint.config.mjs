// eslint.config.js
import templEslintConfig from '@templ-project/eslint';

export default [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'docs/**',
      '.jscpd/**',
      'node_modules/**',
      '**/*.config.js',
      '**/*.config.mjs',
      '*.md',
      '*.html',
      'package.json',
      'package-lock.json',
      '.gitignore',
      '.prettierignore',
      '.eslintignore',
      'LICENSE',
      'tsconfig*.json',
      'typedoc.json',
      'jsconfig.json',
      '.specs/**/*',
    ],
  },
  ...templEslintConfig,
];
