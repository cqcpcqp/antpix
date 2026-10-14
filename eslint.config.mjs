import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    'library/**',
    'temp/**',
    'local/**',
    'profiles/**',
    'build/**',
    'tmp/**',
    'output/**',
    '.venv/**',
    'art/**',
    'assets/scripts/levels.ts',
    'cloudfunctions/game/profile.js',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['scripts/**/*.{mjs,cjs}', 'tests/**/*.mjs', 'cloudfunctions/**/*.js', '*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['wechat/**/*.js'],
    languageOptions: { globals: { ...globals.es2020, wx: 'readonly' } },
  },
  {
    files: ['assets/scripts/**/*.ts'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.es2020, console: 'readonly' } },
  },
  prettier,
]);
