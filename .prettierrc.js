export default {
  bracketSpacing: false,
  overrides: [
    {
      files: '*.json',
      options: {
        parser: 'json',
        singleQuote: false,
      },
    },
    {
      files: '*.json5',
      options: {
        parser: 'json5',
        singleQuote: false,
      },
    },
    {
      files: '*.jsonc',
      options: {
        parser: 'jsonc',
        singleQuote: false,
      },
    },
    {
      files: '*.js',
      options: {
        parser: 'babel',
      },
    },
    {
      files: '*.md',
      options: {
        parser: 'markdown',
        // Optional: You can add Markdown-specific options here
        singleQuote: false, // Example option
        proseWrap: 'preserve', // Options: 'always', 'never', 'preserve'
      },
    },
  ],
  parser: 'typescript',
  printWidth: 120,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
};
