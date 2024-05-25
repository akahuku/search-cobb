import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {default as nodePath} from 'node:path';

import * as jsmigemo from '../src/lib/jsmigemo.js';
import {
	transformMigemo,
	transformLiteral,
	transformRegex
} from '../src/lib/regex-transformer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = nodePath.dirname(__filename);

/*
 * asserts:
 *   equal(actual, expected[, message])
 */

describe('transformMigemo', () => {
	let migemo;

	before(() => {
		const dictData = fs.readFileSync(
			nodePath.join(__dirname, '../src/dict/migemo-compact-dict'));
		const dict = new jsmigemo.CompactDictionary(dictData.buffer);

		migemo = new jsmigemo.Migemo;
		migemo.setRxop([
			'|', '(?:', ')', '[', ']', '',
			'\\.[]{}()*+?^$|'
		]);
		migemo.setDict(dict);
	});

	/*       migemo					unified string			RegExp
	 *       ===================	====================	====================
	 * ch    [［］｛｝]				[\\[\\]\\{\\}]			[\[\]\{\}]
	 * p     [＋]					[\\+]					[\+]
	 * k     [（）＊＋－．／？［＼］＾｛｜｝]
	 *								[\\(\\)\\*\\+\\-\\./\\?\\[\\\\\\]\\^\\{\\|\\}]
	 *														[\(\)\*\+\-\./\?\[\\\]\^\{\|\}]
	 * i     \(concat "I\\057O("\)	(must be stripped from dictionary)
	 * z     k\$_\{eff\}\$          k\$_\{eff\}\$			k\$_\{eff\}\$
	 * ri-   
	 * bu
	 */

	for (const query of ['ch', 'p', 'k', 'i', 'z', 'ri-', 'bu']) {
		it(`query: "${query}"`, () => {
			const result = transformMigemo(migemo.query(query), null, {});
			try {
				const pattern = new RegExp(result, 'gu');
				assert.ok(pattern instanceof RegExp);
			}
			catch (err) {
				transformMigemo(migemo.query(query), null, {}, true);
				throw err;
			}
		});
	}
});

describe('transformLiteral', () => {
	it('bottom backslash', () => {
		assert.throws(() => {
			const actual = transformLiteral('\\babc\\');
		});
	});

	it('transformLiteral', () => {
		const actual = transformLiteral('a+b.c?  def{2} [D-H]');
		assert.equal(actual, 'a\\+b\\.c\\?\\s+def\\{2\\}\\s+\\[D-H\\]');
	});

	it('unifying fullwidth meta characters', () => {
		const actual = transformLiteral('[＊＋，－．＼／] ＊＋，－．＼／');
		assert.equal(actual, '\\[\\*\\+,-\\.\\\\/\\]\\s+\\*\\+,-\\.\\\\/');
	});
});

describe('transformRegex', () => {
	it('bottom backslash', () => {
		assert.throws(() => {
			const actual = transformRegex('\\babc\\');
		});
	});

	it('backslash', () => {
		const actual = transformRegex('\\babc\\b');
		assert.equal(actual, '\\babc\\b');
	});

	it('space folding #1', () => {
		const actual = transformRegex('a+b.c?  def{2}');
		assert.equal(actual, 'a+b.c?\\s+def{2}');
	});

	it('space folding #2', () => {
		const actual = transformRegex('a+[ ABC]c?  def{2}');
		assert.equal(actual, 'a+[ ABC]c?\\s+def{2}');
	});

	it('unifying fullwidth meta characters, inside character class', () => {
		const actual = transformRegex('[［－］｛｝（）．＊＋？＾＄｜＼]');
		assert.equal(actual, '[\\[\\-\\]{}().*+?^$|\\\\]');
	});

	it('unifying fullwidth meta characters, outside character class', () => {
		const actual = transformRegex('＊＋，－．＼／');
		assert.equal(actual, '\\*\\+,-\\.\\\\/');
	});

	it('combining marks in character class', () => {
		const source = transformRegex('[ぶブ]');
		assert.equal(source, '(?:ふ\u3099|フ\u3099)');
	});
});
