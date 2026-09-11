import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Skrip yang ditempel ke konsol DevTools, bukan bagian dari bundel.
  { ignores: ['dist', 'node_modules', 'coverage', 'scripts/perf-autotype.js'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      /* Batasan arsitektur dok. 06 §2, ditegakkan mesin (bukan niat baik). */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/**', '**/pages/**', 'react', 'react-dom'],
              message:
                'dok. 06 §2 batasan 1: src/lib/engine/ harus murni — dites di Node tanpa React.',
            },
          ],
        },
      ],
    },
  },
  {
    // Batasan 1 hanya berlaku di engine; sisanya bebas mengimpor React.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/engine/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Batasan 2: hanya src/lib/storage/ yang boleh menyentuh localStorage.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/storage/**', 'src/test/**', 'src/**/__tests__/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'dok. 06 §2 batasan 2: lewat src/lib/storage/.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'localStorage',
          message: 'dok. 06 §2 batasan 2: lewat src/lib/storage/.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message: 'dok. 06 §2 batasan 4: tidak ada network request saat runtime.',
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.ts', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
);
