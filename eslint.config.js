import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
    },
  },
  {
    files: ['packages/web/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.strict.rules,
    },
  },
  {
    // Maintainability budget for application code: small files, short focused
    // functions, low branching, and no unchecked non-null assertions.
    files: ['packages/*/src/**/*.{ts,tsx}'],
    rules: {
      complexity: ['error', 12],
      'max-depth': ['error', 4],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-nested-ternary': 'error',
    },
  },
  {
    // Reference/seed data is declarative and naturally long.
    files: ['packages/server/src/data/**'],
    rules: { 'max-lines': 'off', 'max-lines-per-function': 'off' },
  },
);
