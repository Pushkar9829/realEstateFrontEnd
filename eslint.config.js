import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

// Layer rule (docs/ARCHITECTURE.md 5.2): panels -> modules -> shared -> design.
const noUp = (patterns, message) => ['error', { patterns: patterns.map((group) => ({ group: [group], message })) }];

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules, 'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^(_|[A-Z])' }] },
  },
  { files: ['src/modules/**'], rules: { 'no-restricted-imports': noUp(['@/panels/*'], 'Modules must not import from panels') } },
  { files: ['src/shared/**'], rules: { 'no-restricted-imports': noUp(['@/panels/*', '@/modules/*'], 'shared must not import from modules or panels') } },
];
