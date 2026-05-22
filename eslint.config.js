import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'no-restricted-syntax': [
        'error',
        {
          selector: 'BinaryExpression[operator="in"][right.type="ArrayExpression"]',
          message: 'Use Array.includes() instead of the `in` operator with arrays.',
        },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'e2e/'],
  },
);
