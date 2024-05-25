/*
 * Search Cobb
 *
 * @author akahuku@gmail.com
 */
/**
 * Copyright 2024 akahuku, akahuku@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {MODE, OPT_STRICT} from './common.js';
import * as unifier from './unifier.js';
import {graphemeRegex} from './grapheme-regex.js';

const META_MAP = new Set([
	'.', '*', '[', ']', '^', '$',
	'{', '}', '(', ')', '?', '+', '|'
]);
const CHAR_CLASS = new Set([
	'b', 'c', 'd', 'D', 'f', 'n', 'p', 'r', 's', 't', 'u', 'x', 'w', 'W'
]);
const FULLWIDTH_METACHAR_MAP = {
	'［': '[',
	'］': ']',
	'｛': '{',
	'｝': '}',
	'（': '(',
	'）': ')',
	'．': '.',
	'＊': '*',
	'＋': '+',
	'？': '?',
	'＾': '^',
	'＄': '$',
	'｜': '|',
	'＼': '\\'
};
const FULLWIDTH_METACHAR_MAP_CLASS = {
	'［': '[',
	'］': ']',
	'－': '-',
	'＼': '\\'
};

function getIteratePattern () {
	// - escaped character
	// - meta characters
	// - character class
	// - other characters
	return /\\.|[{}().*+?^$|]|\[(?:\\.|[^\]])+\]|[^\[\]{}().*+?^$|]+/gu;
}

function unifyInsideClass (a) {
	const chars = [];
	const graphemes = [];

	a = a.replace(/[［］－＼]/g, $0 => `\\${FULLWIDTH_METACHAR_MAP_CLASS[$0]}`);

	for (const seg of (new Intl.Segmenter).segment(a)) {
		const segment = unifier.unifyGrapheme(seg.segment);
		if (segment.length === 1
		 || segment.length === 2 && /^[\ud800-\udbff][\udc00-\udfff]$/.test(segment)) {
			chars.push(segment);
		}
		else {
			graphemes.push(segment);
		}
	}

	if (chars.length && graphemes.length) {
		return `(?:[${chars.join('')}]|${graphemes.join('|')})`;
	}
	else if (chars.length && graphemes.length === 0) {
		return `[${chars.join('')}]`;
	}
	else if (chars.length === 0 && graphemes.length) {
		return `(?:${graphemes.join('|')})`;
	}
	else {
		return '';
	}
}

function unifyOutsideClass (a) {
	a = a.replace(/[［］｛｝（）．＊＋？＾＄｜＼]/g, $0 => `\\${FULLWIDTH_METACHAR_MAP[$0]}`);
	a = unifier.unifyString(a.replace(/\s+/g, '\\s+'));
	return a;
}

function fixup (result) {
	if (result.length && result[result.length - 1].endsWith('\\')) {
		throw new SyntaxError('A backslash must not be end');
	}

	return result.join('');
}

export function transformRegex (source, target, detail = {}, debug) {
	const result = [];
	const pattern = getIteratePattern();
	const unifyInside = detail.strict ? a => `[${a}]` : unifyInsideClass;
	const unifyOutside = detail.strict ? a => a : unifyOutsideClass;

	for (let re; (re = pattern.exec(source)) !== null; ) {
		if (re[0].startsWith('\\')) {
			result.push(re[0]);
		}
		else if (re[0].startsWith('[')) {
			result.push(unifyInside(re[0].substring(1, re[0].length - 1)));
		}
		else if (META_MAP.has(re[0])) {
			if (re[0] === '.' && typeof target === 'string' && detail.extendDot) {
				result.push(graphemeRegex(target));
			}
			else {
				result.push(re[0]);
			}
		}
		else {
			result.push(unifyOutside(re[0]));
		}
	}

	if (debug) {
		console.log([
			`*** transformRegex ***`,
			`  source: "${source}"`,
			`  result: "${result.join('')}"`
		].join('\n'));
	}

	return fixup(result);
}

export function transformMigemo (source, target, detail = {}, debug) {
	return transformRegex(source, target, detail, debug);
}

export function transformLiteral (source, target, detail = {}, debug) {
	const result = [];
	const pattern = getIteratePattern();
	const unifyOutside = detail.strict ? a => a : unifyOutsideClass;

	for (let re; (re = pattern.exec(source)) !== null; ) {
		if (re[0].startsWith('\\')) {
			result.push(re[0]);
		}
		else if (re[0].startsWith('[')) {
			result.push(`\\[${transformLiteral(re[0].substring(1, re[0].length - 1), detail)}\\]`);
		}
		else if (META_MAP.has(re[0])) {
			result.push('\\' + re[0]);
		}
		else {
			result.push(unifyOutsideClass(re[0]));
		}
	}

	if (debug) {
		console.log([
			`*** transformLiteral ***`,
			`  source: "${source}"`,
			`  result: "${result.join('')}"`
		].join('\n'));
	}

	return fixup(result);
}

export function transform (source, target, detail = {}, debug) {
	switch (detail.mode) {
	case MODE.REGEX:
		return transformRegex(source, target, detail, debug);
	case MODE.MIGEMO:
		return transformMigemo(source, target, detail, debug);
	case MODE.LITERAL:
		return transformLiteral(source, target, detail, debug);
	default:
		throw new Error(`transform: unknown mode: ${detail.mode}`);
	}
}
