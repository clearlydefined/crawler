const js = require('@eslint/js')
const globals = require('globals')
const eslintConfigPrettier = require('eslint-config-prettier')

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha
      },
      parserOptions: {
        sourceType: 'module'
      }
    },
    rules: {
      quotes: ['error', 'single'],
      semi: ['error', 'never'],
      'no-console': 'off'
    }
  },
  eslintConfigPrettier
]
