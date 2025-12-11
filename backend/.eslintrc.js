module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    // Possible Errors
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-template-curly-in-string': 'error',

    // Best Practices
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-throw-literal': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-var': 'error',
    'prefer-const': 'error',
    'require-await': 'warn',
    'no-return-await': 'error',

    // Node.js and CommonJS
    'no-path-concat': 'error',
    'handle-callback-err': 'error',

    // Stylistic Issues
    'indent': ['error', 2, { SwitchCase: 1 }],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'comma-spacing': ['error', { before: false, after: true }],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'keyword-spacing': ['error', { before: true, after: true }],
    'space-before-blocks': 'error',
    'space-infix-ops': 'error',
    'no-trailing-spaces': 'error',
    'eol-last': ['error', 'always'],

    // ES6
    'arrow-spacing': ['error', { before: true, after: true }],
    'prefer-arrow-callback': 'warn',
    'prefer-template': 'warn',
    'template-curly-spacing': ['error', 'never']
  },
  overrides: [
    {
      files: ['*.test.js', '**/__tests__/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'no-unused-vars': 'off'
      }
    }
  ]
};
