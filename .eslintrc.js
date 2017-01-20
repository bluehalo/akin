module.exports = {
	"env": {
		"es6": true,
		"node": true,
		"mocha": true
	},

	"parserOptions": {
		"ecmaVersion": 6,
		"sourceType": "module"
	},

	"extends": "eslint:recommended",
	"rules": {
		"arrow-parens": ["error", "always"],
		"eqeqeq": ["error", "smart"],
		"no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
		"no-trailing-spaces": ["error"],
		"no-unused-vars": ["error", { "vars": "all", "varsIgnorePattern": "extend|should", "args": "none" }],
		"quotes": ["error", "single"],
		"linebreak-style": ["error", "unix"],
		"semi": ["error", "always"],
		"comma-dangle": ["error", "never"]
	},

	"globals": {
	}
}