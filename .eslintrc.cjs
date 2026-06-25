/* ESLint config — Vite + React 18 + TypeScript.
 * Legacy (.eslintrc) format on purpose: the `lint` script uses `--ext ts,tsx`,
 * which only applies under the legacy config system (flat config ignores it).
 */
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    'build',
    'coverage',
    'node_modules',
    '*.cjs',
    '*.config.js',
    '*.config.ts',
    'vite.config.ts',
    // Auto-generated, multi-hundred-KB base64 font blob — not meant to be linted.
    'src/modules/nomina/lib/pdf/robotoFont.ts',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-refresh', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // Allow intentionally-unused identifiers when prefixed with `_` (project convention,
    // e.g. unused destructured props / params kept for signature shape).
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    {
      // shadcn/ui primitives export their `cva` variants alongside the component
      // by design; the fast-refresh "only export components" rule doesn't apply.
      files: ['src/shared/components/ui/**/*.{ts,tsx}'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
  ],
}
