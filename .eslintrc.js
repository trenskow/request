module.exports = {
	'env': {
		'es6': true,
		'node': true,
		'browser': true
	},
	'parserOptions': {
		'ecmaVersion': 2021,
		'sourceType': 'module'
	},
	'extends': 'eslint:recommended',
	'rules': {
		'indent': [
			'error',
			'tab',
			{ 'SwitchCase': 1 }
		],
		'linebreak-style': [
			'error',
			'unix'
		],
		'quotes': [
			'error',
			'single'
		],
		'semi': [
			'error',
			'always'
		],
		'no-console': [
			'error', {
				'allow': [
					'warn',
					'error',
					'info'
				]
			}
		],
		'no-unused-vars': [
			'error', {
				'argsIgnorePattern': '^_'
			}
		],
		'no-empty': [
			'error', {
				'allowEmptyCatch': true
			}
		],
		'no-trailing-spaces': [
			'error', {
				'ignoreComments': true
			}
		],
		'require-atomic-updates': 'off',
		'no-implicit-globals': [
			'error'
		],
		'eol-last': [
			'error',
			'always'
		]
	}
};
