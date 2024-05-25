import assert from 'node:assert/strict';

import {esc, tag} from '../src/lib/common.js';
import {
	unifyGrapheme,
	unifyString
} from '../src/lib/unifier.js';

describe('unifier', () => {
	it('alphabet with usual diacritial mark', () => {
		// a + U+0300 Combining Grave Accent
		const result = unifyString('a\u0300');
		assert.equal(result, 'a');
	});

	it('alphabet with rare diacritial mark', () => {
		// a + U+0822 Combining Long Stroke Overlay
		const result = unifyString('a\u0822');
		assert.equal(result, 'a');
	});

	it('precomposed alphabet character', () => {
		// U+00E9 LATIN SMALL LETTER E WITH ACUTE
		const result = unifyString('\u00e9');
		assert.equal(result, 'e');
	});

	it('kana with voiced mark', () => {
		// カ + U+3099 COMBINING KATAKANA-HIRAGANA VOICED SOUND MARK
		const result = unifyString('カ\u3099');
		assert.equal(result, 'カ\u3099');
	});

	it('precomposed kana', () => {
		// U+30AC KATAKANA LETTER GA
		const result = unifyString('ガ');
		assert.equal(result, 'カ\u3099');
	});

	it('hangul character', () => {
		// U+1100 Hangul Choseong Kiyeok
		// U+1161 Hangul Jungseong A
		const result = unifyString('\u1100\u1161');
		assert.equal(result, '\u1100\u1161');
	});

	it('precomposed hangul character', () => {
		// U+AC00 Hangul Syllable Ga -> U+1100 Hangul Choseong Kiyeok
		//                              U+1161 Hangul Jungseong A
		const result = unifyString('가');
		assert.equal(result, '\u1100\u1161');
	});

	it('regional indicators', () => {
		// U+1F1E8 Regional Indicator Symbol Letter C
		// U+1F1E6 Regional Indicator Symbol Letter A
		// U+1F1FF Regional Indicator Symbol Letter Z
		// U+1F1FC Regional Indicator Symbol Letter W
		const result = unifyString('\u{1f1e8}\u{1f1e6}\u{1f1ff}\u{1f1fc}');
		assert.equal(result, '\u{1f1e8}\u{1f1e6}\u{1f1ff}\u{1f1fc}');
	});

	it('emoji sequence', () => {
		// U+1F469 Woman
		// U+200D  ZERO WIDTH JOINER
		// U+1F3EB SCHOOL
		const result = unifyString('\u{1f469}\u200d\u{1f3db}');
		assert.equal(result, '\u{1f469}');
	});

	// TODO: unifying test for devanagari characters

	it('non-control', () => {
		const result = unifyString('abc');
		assert.equal(result, 'abc');
	});
});
