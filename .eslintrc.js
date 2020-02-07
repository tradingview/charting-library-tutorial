module.exports = {
	env: {
		es6: true,
		browser: true,
		jquery: true,
		commonjs: true,
	},

	// parser: 'babel-eslint',

	parserOptions: {
		ecmaVersion: 6,
		sourceType: 'module',
		allowImportExportEverywhere: true,
		ecmaFeatures: {
			generators: false,
			objectLiteralDuplicateProperties: false,
			experimentalObjectRestSpread: true,
		}
	},

	rules: {

		// best practices

		// enforces getter/setter pairs in objects
		'accessor-pairs': 'off',

		// enforces return statements in callbacks of array's methods
		// http://eslint.org/docs/rules/array-callback-return
		'array-callback-return': 'error',

		// treat var statements as if they were block scoped
		// 'block-scoped-var': 2,
		// specify the maximum cyclomatic complexity allowed in a program
		complexity: ['off', 11],

		// require return statements to either always or never specify values
		'consistent-return': 'off',

		// specify curly brace conventions for all control statements
		curly: ['error', 'all'],

		// require default case in switch statements
		'default-case': 'off',

		// encourages use of dot notation whenever possible
		'dot-notation': ['error', { allowKeywords: true }],

		// enforces consistent newlines before or after dots
		'dot-location': 'off',

		// require the use of === and !==
		eqeqeq: ['error', 'smart'],

		// make sure for-in loops have an if statement
		'guard-for-in': 'off',

		// Blacklist certain identifiers to prevent them being used
		// http://eslint.org/docs/rules/id-blacklist
		'id-blacklist': 'off',

		// disallow the use of alert, confirm, and prompt
		'no-alert': 'warn',

		// disallow use of arguments.caller or arguments.callee
		'no-caller': 'error',

		// disallow lexical declarations in case/default clauses
		// http://eslint.org/docs/rules/no-case-declarations.html
		'no-case-declarations': 'error',

		// disallow division operators explicitly at beginning of regular expression
		'no-div-regex': 'off',

		// disallow else after a return in an if
		'no-else-return': 'off',

		// disallow Unnecessary Labels
		// http://eslint.org/docs/rules/no-extra-label
		'no-extra-label': 'error',

		// disallow comparisons to null without a type-checking operator
		'no-eq-null': 'off',

		// disallow use of eval()
		'no-eval': 'error',

		// disallow adding to native types
		'no-extend-native': 'error',

		// disallow unnecessary function binding
		'no-extra-bind': 'error',

		// disallow fallthrough of case statements
		'no-fallthrough': 'error',

		// disallow the use of leading or trailing decimal points in numeric literals
		'no-floating-decimal': 'error',

		// disallow the type conversions with shorter notations
		'no-implicit-coercion': 'off',

		// disallow use of eval()-like methods
		'no-implied-eval': 'error',

		// disallow this keywords outside of classes or class-like objects
		'no-invalid-this': 'off',

		// disallow usage of __iterator__ property
		'no-iterator': 'error',

		// disallow use of labels for anything other then loops and switches
		'no-labels': ['error', { allowLoop: false, allowSwitch: false }],

		// disallow unnecessary nested blocks
		'no-lone-blocks': 'error',

		// disallow creation of functions within loops
		'no-loop-func': 'error',

		// disallow use of multiple spaces
		'no-multi-spaces': 'error',

		// disallow use of multiline strings
		'no-multi-str': 'error',

		// disallow reassignments of native objects
		'no-native-reassign': 'error',

		// disallow use of new operator when not part of the assignment or comparison
		'no-new': 'error',

		// disallow use of new operator for Function object
		'no-new-func': 'error',

		// disallows creating new instances of String, Number, and Boolean
		'no-new-wrappers': 'error',

		// disallow use of (old style) octal literals
		'no-octal': 'error',

		// disallow use of octal escape sequences in string literals, such as
		// var foo = 'Copyright \251';
		'no-octal-escape': 'error',

		// disallow reassignment of function parameters
		// disallow parameter object manipulation
		// rule: http://eslint.org/docs/rules/no-param-reassign.html
		// 'no-param-reassign': [2, { 'props': true }],
		// disallow use of process.env
		'no-process-env': 'off',

		// disallow usage of __proto__ property
		'no-proto': 'error',

		// disallow declaring the same variable more then once
		'no-redeclare': 'off',

		// disallow use of assignment in return statement
		'no-return-assign': 'error',

		// disallow use of `javascript:` urls.
		'no-script-url': 'error',

		// disallow comparisons where both sides are exactly the same
		'no-self-compare': 'error',

		// disallow use of comma operator
		'no-sequences': 'error',

		// restrict what can be thrown as an exception
		'no-throw-literal': 'error',

		// disallow unmodified conditions of loops
		// http://eslint.org/docs/rules/no-unmodified-loop-condition
		'no-unmodified-loop-condition': 'off',

		// disallow usage of expressions in statement position
		'no-unused-expressions': 'error',

		// disallow unused labels
		// http://eslint.org/docs/rules/no-unused-labels
		'no-unused-labels': 'error',

		// disallow unnecessary .call() and .apply()
		'no-useless-call': 'off',

		// disallow use of void operator
		'no-void': 'off',

		// disallow usage of configurable warning terms in comments: e.g. todo
		'no-warning-comments': ['off', { terms: ['todo', 'fixme', 'xxx'], location: 'start' }],

		// disallow use of the with statement
		'no-with': 'error',

		// require use of the second argument for parseInt()
		radix: 'off',

		// requires to declare all vars on top of their containing scope
		// 'vars-on-top': 2,
		// require immediate function invocation to be wrapped in parentheses
		// http://eslint.org/docs/rules/wrap-iife.html
		'wrap-iife': ['error', 'inside'],

		// require or disallow Yoda conditions
		yoda: 'off',

		// errors

		// disallow assignment in conditional expressions
		'no-cond-assign': ['error', 'always'],

		// disallow use of console
		'no-console': 'off',

		// disallow use of constant expressions in conditions
		'no-constant-condition': 'warn',

		// disallow control characters in regular expressions
		'no-control-regex': 'error',

		// disallow use of debugger
		'no-debugger': 'warn',

		// disallow duplicate arguments in functions
		'no-dupe-args': 'error',

		// disallow duplicate keys when creating object literals
		'no-dupe-keys': 'error',

		// disallow a duplicate case label.
		'no-duplicate-case': 'error',

		// disallow the use of empty character classes in regular expressions
		'no-empty-character-class': 'error',

		// disallow empty statements
		'no-empty': 'error',

		// disallow assigning to the exception in a catch block
		'no-ex-assign': 'error',

		// disallow double-negation boolean casts in a boolean context
		'no-extra-boolean-cast': 'off',

		// disallow unnecessary parentheses
		'no-extra-parens': ['error', 'functions'],

		// disallow unnecessary semicolons
		'no-extra-semi': 'error',

		// disallow overwriting functions written as function declarations
		// 'no-func-assign': 2,
		// disallow function or variable declarations in nested blocks
		'no-inner-declarations': 'error',

		// disallow invalid regular expression strings in the RegExp constructor
		'no-invalid-regexp': 'error',

		// disallow irregular whitespace outside of strings and comments
		'no-irregular-whitespace': 'error',

		// disallow negation of the left operand of an in expression
		'no-negated-in-lhs': 'error',

		// disallow the use of object properties of the global object (Math and JSON) as functions
		'no-obj-calls': 'error',

		// disallow multiple spaces in a regular expression literal
		'no-regex-spaces': 'error',

		// disallow sparse arrays
		'no-sparse-arrays': 'error',

		// disallow unreachable statements after a return, throw, continue, or break statement
		'no-unreachable': 'error',

		// disallow comparisons with the value NaN
		'use-isnan': 'error',

		// ensure JSDoc comments are valid
		'valid-jsdoc': 'off',

		// ensure that the results of typeof are compared against a valid string
		'valid-typeof': 'error',

		// Avoid code that looks like two expressions but is actually one
		'no-unexpected-multiline': 'off',

		// es6

		// enforces no braces where they can be omitted
		// http://eslint.org/docs/rules/arrow-body-style
		'arrow-body-style': ['error', 'as-needed'],

		// require parens in arrow function arguments
		'arrow-parens': 'off',

		// require space before/after arrow function's arrow
		// https://github.com/eslint/eslint/blob/master/docs/rules/arrow-spacing.md
		'arrow-spacing': ['error', { before: true, after: true }],

		// require trailing commas in multiline object literals
		// 'comma-dangle': [2, 'always-multiline'],

		// verify super() callings in constructors
		'constructor-super': 'error',

		// enforce the spacing around the * in generator functions
		'generator-star-spacing': 'off',

		// disallow modifying variables of class declarations
		'no-class-assign': 'error',

		// disallow arrow functions where they could be confused with comparisons
		// http://eslint.org/docs/rules/no-confusing-arrow
		// 'no-confusing-arrow': 2,

		// disallow modifying variables that are declared using const
		'no-const-assign': 'error',

		// disallow symbol constructor
		// http://eslint.org/docs/rules/no-new-symbol
		'no-new-symbol': 'error',

		// disallow specific globals
		'no-restricted-globals': ['error', 'fetch'],

		// disallow specific imports
		// http://eslint.org/docs/rules/no-restricted-imports
		'no-restricted-imports': 'off',

		// disallow to use this/super before super() calling in constructors.
		'no-this-before-super': 'error',

		// require let or const instead of var
		'no-var': 'off',

		// disallow unnecessary constructor
		// http://eslint.org/docs/rules/no-useless-constructor
		'no-useless-constructor': 'error',

		// require method and property shorthand syntax for object literals
		// https://github.com/eslint/eslint/blob/master/docs/rules/object-shorthand.md
		'object-shorthand': 'off',

		// suggest using arrow functions as callbacks
		'prefer-arrow-callback': 'off',

		// suggest using of const declaration for variables that are never modified after declared
		'prefer-const': 'error',

		// suggest using the spread operator instead of .apply()
		'prefer-spread': 'off',

		// suggest using Reflect methods where applicable
		'prefer-reflect': 'off',

		// use rest parameters instead of arguments
		// http://eslint.org/docs/rules/prefer-rest-params
		'prefer-rest-params': 'off',

		// suggest using template literals instead of string concatenation
		// http://eslint.org/docs/rules/prefer-template
		'prefer-template': 'off',

		// disallow generator functions that do not have yield
		'require-yield': 'error',

		// import sorting
		// http://eslint.org/docs/rules/sort-imports
		'sort-imports': 'off',

		// enforce usage of spacing in template strings
		// http://eslint.org/docs/rules/template-curly-spacing
		'template-curly-spacing': 'error',

		// enforce spacing around the * in yield* expressions
		// http://eslint.org/docs/rules/yield-star-spacing
		'yield-star-spacing': ['error', 'after'],

		// legasy

		// disallow trailing commas in object literals
		'comma-dangle': 'off',

		// specify the maximum depth that blocks can be nested
		'max-depth': ['off', 4],

		// limits the number of parameters that can be used in the function declaration.
		'max-params': ['off', 3],

		// specify the maximum number of statement allowed in a function
		'max-statements': ['off', 10],

		// disallow use of bitwise operators
		'no-bitwise': 'off',

		// disallow use of unary operators, ++ and --
		'no-plusplus': 'off',

		// strict

		// babel inserts `'use strict';` for us
		strict: 'off',

		// vars

		// enforce or disallow variable initializations at definition
		'init-declarations': 'off',

		// disallow the catch clause parameter name being the same as a variable in the outer scope
		'no-catch-shadow': 'off',

		// disallow deletion of variables
		'no-delete-var': 'error',

		// disallow var and named functions in global scope
		// http://eslint.org/docs/rules/no-implicit-globals
		'no-implicit-globals': 'off',

		// disallow labels that share a name with a variable
		'no-label-var': 'off',

		// disallow self assignment
		// http://eslint.org/docs/rules/no-self-assign
		'no-self-assign': 'error',

		// disallow shadowing of names such as arguments
		'no-shadow-restricted-names': 'error',

		// disallow declaration of variables already declared in the outer scope
		// 'no-shadow': 2,
		// disallow use of undefined when initializing variables
		'no-undef-init': 'off',

		// disallow use of undeclared variables unless mentioned in a /*global */ block
		'no-undef': 'error',

		// disallow use of undefined variable
		'no-undefined': 'off',

		// disallow declaration of variables that are not used in the code
		'no-unused-vars': ['error', { vars: 'local', args: 'none' }],

		// disallow use of variables before they are defined
		'no-use-before-define': ['off', { functions: false, classes: true }],

		// style

		// enforce spacing inside array brackets
		'array-bracket-spacing': ['error', 'never'],

		// enforce one true brace style
		'brace-style': ['error', '1tbs', { allowSingleLine: true }],

		// require camel case names
		// 'camelcase': [2, { 'properties': 'never' }],
		// enforce spacing before and after comma
		'comma-spacing': ['error', { before: false, after: true }],

		// enforce one true comma style
		'comma-style': ['error', 'last'],

		// disallow padding inside computed properties
		'computed-property-spacing': ['error', 'never'],

		// enforces consistent naming when capturing the current execution context
		'consistent-this': 'off',

		// enforce newline at the end of file, with no multiple empty lines
		'eol-last': 'error',

		// require function expressions to have a name
		'func-names': 'off',

		// enforces use of function declarations or expressions
		'func-style': 'off',

		// this option enforces minimum and maximum identifier lengths
		// (variable names, property names etc.)
		'id-length': 'off',

		// this option sets a specific tab width for your code
		// https://github.com/eslint/eslint/blob/master/docs/rules/indent.md
		indent: ['error', 'tab', { SwitchCase: 1, VariableDeclarator: 1 }],

		// specify whether double or single quotes should be used in JSX attributes
		// http://eslint.org/docs/rules/jsx-quotes
		'jsx-quotes': ['error', 'prefer-double'],

		// enforces spacing between keys and values in object literal properties
		'key-spacing': ['error', { beforeColon: false, afterColon: true }],

		// require a space before & after certain keywords
		'keyword-spacing': ['error', {
			before: true,
			after: true,
			overrides: {
				return: { after: true },
				throw: { after: true },
				case: { after: true }
			}
		}],

		// enforces empty lines around comments
		'lines-around-comment': 'off',

		// disallow mixed 'LF' and 'CRLF' as linebreaks
		'linebreak-style': 'off',

		// specify the maximum length of a line in your program
		// https://github.com/eslint/eslint/blob/master/docs/rules/max-len.md
		//   'max-len': [2, 100, 2, {
		// 'ignoreUrls': true,
		// 'ignoreComments': false
		//   }],
		// specify the maximum depth callbacks can be nested
		'max-nested-callbacks': 'off',

		// require a capital letter for constructors
		'new-cap': ['error', { newIsCap: true, capIsNew: false }],

		// disallow the omission of parentheses when invoking a constructor with no arguments
		'new-parens': 'off',

		// allow/disallow an empty newline after var statement
		'newline-after-var': 'off',

		// http://eslint.org/docs/rules/newline-before-return
		'newline-before-return': 'off',

		// enforces new line after each method call in the chain to make it
		// more readable and easy to maintain
		// http://eslint.org/docs/rules/newline-per-chained-call
		'newline-per-chained-call': ['off', { ignoreChainWithDepth: 3 }],

		// disallow use of the Array constructor
		'no-array-constructor': 'error',

		// disallow use of the continue statement
		'no-continue': 'off',

		// disallow comments inline after code
		'no-inline-comments': 'off',

		// disallow if as the only statement in an else block
		'no-lonely-if': 'off',

		// disallow mixed spaces and tabs for indentation
		'no-mixed-spaces-and-tabs': 'error',

		// disallow multiple empty lines and only one newline at the end
		'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],

		// disallow nested ternary expressions
		// 'no-nested-ternary': 2,
		// disallow use of the Object constructor
		'no-new-object': 'error',

		// disallow space between function identifier and application
		'no-spaced-func': 'error',

		// disallow the use of ternary operators
		'no-ternary': 'off',

		// disallow trailing whitespace at the end of lines
		'no-trailing-spaces': 'error',

		// disallow dangling underscores in identifiers
		'no-underscore-dangle': 'off',

		// disallow the use of Boolean literals in conditional expressions
		// also, prefer `a || b` over `a ? a : b`
		// http://eslint.org/docs/rules/no-unneeded-ternary
		'no-unneeded-ternary': ['error', { defaultAssignment: false }],

		// disallow whitespace before properties
		// http://eslint.org/docs/rules/no-whitespace-before-property
		'no-whitespace-before-property': 'error',

		// require padding inside curly braces
		'object-curly-spacing': ['error', 'always'],

		// allow just one var statement per function
		'one-var': ['error', 'never'],

		// require a newline around variable declaration
		// http://eslint.org/docs/rules/one-var-declaration-per-line
		'one-var-declaration-per-line': ['error', 'always'],

		// require assignment operator shorthand where possible or prohibit it entirely
		'operator-assignment': 'off',

		// enforce operators to be placed before or after line breaks
		'operator-linebreak': 'off',

		// enforce padding within blocks
		'padded-blocks': ['error', 'never'],

		// require quotes around object literal property names
		// http://eslint.org/docs/rules/quote-props.html
		'quote-props': ['error', 'as-needed', { keywords: false, unnecessary: true, numbers: false }],

		// specify whether double or single quotes should be used
		quotes: ['error', 'single', 'avoid-escape'],

		// require identifiers to match the provided regular expression
		'id-match': 'off',

		// enforce spacing before and after semicolons
		'semi-spacing': ['error', { before: false, after: true }],

		// require or disallow use of semicolons instead of ASI
		semi: ['error', 'always'],

		// sort variables within the same declaration block
		'sort-vars': 'off',

		// require or disallow space before blocks
		'space-before-blocks': 'error',

		// require or disallow space before function opening parenthesis
		// https://github.com/eslint/eslint/blob/master/docs/rules/space-before-function-paren.md
		'space-before-function-paren': ['error', { anonymous: 'never', named: 'never' }],

		// require or disallow spaces inside parentheses
		'space-in-parens': ['error', 'never'],

		// require spaces around operators
		'space-infix-ops': 'error',

		// Require or disallow spaces before/after unary operators
		'space-unary-ops': 'off',

		// require or disallow a space immediately following the // or /* in a comment
		'spaced-comment': ['error', 'always', {
			exceptions: ['-', '+'],
			markers: ['=', '!'], // space here to support sprockets directives
		}],

		// require regex literals to be wrapped in parentheses
		'wrap-regex': 'off',
	}
};
