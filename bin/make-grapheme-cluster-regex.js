#!/usr/bin/env -S node --preserve-symlinks
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

import fs from 'node:fs';
import https from 'node:https';
import {default as nodePath} from 'node:path';
import readline from 'node:readline';
import * as url from 'node:url';
import * as util from 'node:util';

const dirname = nodePath.dirname(url.fileURLToPath(import.meta.url));

// UCD configurations
export const UNICODE_VERSION = '15.1.0';
export const UCD_SOURCE_URL = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/`;
export const UCD_PATH = nodePath.join(dirname, '../unicode/');

const UCD_FILENAME = 'UnicodeData.txt';
const DCP_FILENAME = 'DerivedCoreProperties.txt';
const PL_FILENAME  = 'PropList.txt';
const ISC_FILENAME = 'IndicSyllabicCategory.txt';
const ED_FILENAME  = 'emoji/emoji-data.txt';
const HST_FILENAME = 'HangulSyllableType.txt';

// output file configurations
const CODE_PATH = nodePath.join(dirname, '../src/lib/grapheme-regex.js');

/*
 * functions
 */

export function downloadFrom (url, path) {
	return new Promise((resolve, reject) => {
		https.get(url, response => {
			const fileStream = fs.createWriteStream(path);
			fileStream.on('finish', () => {
				fileStream.close();
				resolve();
			});
			fileStream.on('error', err => {
				console.dir(err);
				reject();
			});
			response.pipe(fileStream);
		}).on('error', () => {
			reject();
		});
	});
}

export function fileExists (filepath, mode) {
	let result = true;
	try {
		fs.accessSync(filepath, mode || fs.constants.R_OK);
	}
	catch {
		result = false;
	}
	return result;
}

export function isCombiningMark (cp) {
	return /^\p{M}$/u.test(String.fromCodePoint(cp));
}

export function getStringFromCodePoints (cp, gryphOnly) {
	const r1 = (Array.isArray(cp) ? cp : [cp])
		.map(cp => {
			const ch = String.fromCodePoint(cp);
			if (cp == 0xa0 || isCombiningMark(cp)) {
				const cpString = `000000${cp.toString(16)}`
					.substr(cp < 0x10000 ? -4 : -6)
					.toUpperCase();
				return '\\u{' + cpString + '}';
			}
			else {
				return String.fromCodePoint(cp);
			}
		})
		.join('');
	if (gryphOnly) {
		return `"${r1.replace(/\\$/, '\\\\').replace(/"/g, '\\"')}"`;
	}

	const r2 = (Array.isArray(cp) ? cp : [cp])
		.map(cp => {
			return `000000${cp.toString(16)}`
				.substr(cp < 0x10000 ? -4 : -6)
				.toUpperCase();
		})
		.join(' ');

	return `[${r2} "${r1.replace(/\\$/, '\\\\').replace(/"/g, '\\"')}"]`;
}

export function getDumpedString (s, gryphOnly) {
	if (typeof s !== 'string') {
		return '' + s;
	}

	const codePoints = [];
	for (const ch of s) {
		codePoints.push(ch.codePointAt(0));
	}

	return getStringFromCodePoints(codePoints, gryphOnly);
}

export function getColoredRegex (pattern) {
	if (pattern instanceof RegExp) {
		pattern = pattern.source;
	}
	return pattern.replace(
		/\\u(?:\{[0-9a-fA-F]+\}|[0-9a-fA-F]{1,4})|\\x[0-9a-fA-F]{2}|\(\?<?[=!:]|[(){}\[\].?*+]/g,
		$0 => {
			if ($0.startsWith('\\u') || $0.startsWith('\\x')) {
				return `\x1b[35m${$0}\x1b[m`;
			}
			else if ($0.startsWith('(?')) {
				return `\x1b[32m${$0}\x1b[m`;
			}
			else {
				return `\x1b[31;1m${$0}\x1b[m`;
			}
		});
}

function printHelp () {
	const name = nodePath.basename(process.argv[1]);
	console.log(`\
${name} -- make regexp pattern which matches grapheme clusters
usage: ${name} [options]
options:
  -f, --force-load-ucd    Force loading of ucd(UnicodeData.txt) file
  -o, --output            Generate source code to 'src/lib/grapheme-regex.js'
  -t, --test              Execute some simple tests
  -v, --verbose           Output verbose error messages
`);
	process.exit(1);
}

function parseArgs () {
	try {
		const args = import.meta.url === url.pathToFileURL(process.argv[1]).href ?
			util.parseArgs({
				options: {
					'help':           {type: 'boolean', short: 'h'},
					'force-load-ucd': {type: 'boolean', short: 'f'},
					'output':         {type: 'boolean', short: 'o'},
					'test':           {type: 'boolean', short: 't'},
					'verbose':        {type: 'boolean', short: 'v'},
					'?':              {type: 'boolean'}
				},
				strict: true
			}) : {
				values: {}
			};

		let forceLoadUCD = false;
		let output = false;
		let test = false;
		let verbose = false;

		if (args.values.help || args.values['?']) {
			printHelp();
		}
		if (args.values['force-load-ucd']) {
			forceLoadUCD = true;
		}
		if (args.values.output) {
			output = true;
		}
		if (args.values.test) {
			test = true;
		}
		if (args.values.verbose) {
			verbose = true;
		}
		return {forceLoadUCD, output, test, verbose};
	}
	catch (err) {
		console.error(err.message);
		printHelp();
	}
}

/*
 * unicode data map loaders
 */

async function makeGeneralCategoryMap (keys) {
	const path = nodePath.join(UCD_PATH, UCD_FILENAME);
	if (args.forceLoadUCD || !fileExists(path)) {
		console.log(`loading ${UCD_FILENAME}...`);
		await downloadFrom(
			nodePath.join(UCD_SOURCE_URL, UCD_FILENAME),
			path);
		console.log(`done.`);
	}

	if (!fileExists(path)) {
		throw new Error(`${UCD_FILENAME} not found on "${path}". stop.`);
	}

	const stream = fs.createReadStream(path);
	process.stdout.write('General Categories: ');
	try {
		const rl = readline.createInterface({
			input: stream,
			crlfDelay: Infinity,
		});

		for await (const line of rl) {
			const [cpString,,generalCategory] = line.split(';');
			const cp = parseInt(cpString, 16);

			if (keys && !keys.has(generalCategory)) {
				continue;
			}

			if (generalCategoryMap.has(generalCategory)) {
				generalCategoryMap.get(generalCategory).add(cp);
			}
			else {
				generalCategoryMap.set(generalCategory, new Set([cp]));
				process.stdout.write(`${generalCategory} `);
			}
		}
	}
	finally {
		stream.close();
		process.stdout.write('\n\n');
	}

	if (!generalCategoryMap.has('Cn')) {
		const cn = new Set;
		for (let i = 0xfdd0; i <= 0xfdef; i++) {
			cn.add(i);
		}
		for (let i = 0; i <= 0x10; i++) {
			cn.add(i * 0x10000 + 0xfffe);
			cn.add(i * 0x10000 + 0xffff);
		}
		generalCategoryMap.set('Cn', cn);
	}
}

async function makeGenericUnicodeMap (map, fileName, keys) {
	const path = nodePath.join(UCD_PATH, nodePath.basename(fileName));
	if (args.forceLoadUCD || !fileExists(path)) {
		console.log(`loading ${fileName}...`);
		await downloadFrom(
			nodePath.join(UCD_SOURCE_URL, fileName),
			path);
		console.log(`done.`);
	}

	if (!fileExists(path)) {
		throw new Error(`${fileName} not found on "${path}". stop.`);
	}

	const stream = fs.createReadStream(path);
	process.stdout.write(`${fileName}: `);
	try {
		const rl = readline.createInterface({
			input: stream,
			crlfDelay: Infinity,
		});

		for await (const line of rl) {
			if (/^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*([^#]+)/.test(line)) {
				const from = parseInt(RegExp.$1, 16);
				const to = RegExp.$2 === undefined || RegExp.$2 === '' ?
					from : parseInt(RegExp.$2, 16);
				const name = RegExp.$3.replace(/\s+$/, '');

				if (keys && !keys.has(name)) {
					continue;
				}

				let set;
				if (map.has(name)) {
					set = map.get(name);
				}
				else {
					set = new Set;
					map.set(name, set);
				}

				for (let i = from; i <= to; i++) {
					set.add(i);
				}
			}
		}

		for (const [name, set] of map) {
			process.stdout.write(`${name}(${set.size})  `);
		}
	}
	finally {
		stream.close();
		process.stdout.write('\n\n');
	}
}

function makeDerivedCorePropertiesMap () {
	return makeGenericUnicodeMap(derivedCorePropertiesMap, DCP_FILENAME);
}

function makePropListMap () {
	return makeGenericUnicodeMap(propListMap, PL_FILENAME);
}

function makeIndicSyllabicCategoryMap () {
	return makeGenericUnicodeMap(indicSyllabicCategoryMap, ISC_FILENAME);
}

function makeEmojiDataMap () {
	return makeGenericUnicodeMap(emojiDataMap, ED_FILENAME);
}

function makeHangulSyllableTypeMap () {
	return makeGenericUnicodeMap(hangulSyllableTypeMap, HST_FILENAME);
}

async function makeSourceCode (path, config) {
	if (typeof path !== 'string' || path === '') {
		path = CODE_PATH;
	}
	return new Promise((resolve, reject) => {
		const stream = fs.createWriteStream(path);
		stream.on('finish', () => {
			stream.close();
			console.log(`source code generated to: "${path}".`);
			resolve();
		});
		stream.on('error', err => {
			console.dir(err);
			reject();
		});

		stream.write(`\
/*
 * grapheme-regex.js - Returns a regular expression matching a grapheme cluster
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

/*
 * The unicode version compatible with this source code is ${UNICODE_VERSION}
 */
`);

		for (const [name, variable] of Object.entries(config.variables)) {
			stream.write(`let ${name} = ${JSON.stringify(variable)};\n`);
		}
		for (const [name, variable] of Object.entries(config.consts)) {
			stream.write(`const ${name} = ${JSON.stringify(variable)};\n`);
		}
		for (const [name, func] of Object.entries(config.functions)) {
			stream.write(`${func.toString()}\n`);
		}
		for (const [name, func] of Object.entries(config.exportedFunctions)) {
			stream.write(`export ${func.toString()}\n`);
		}

		stream.end();
	});
}

/*
 * grapheme cluster functions, taken from:
 *   Unicode® Standard Annex #29 - UNICODE TEXT SEGMENTATION
 *   https://unicode.org/reports/tr29/
 *
 *   Version 15.1.0, Revision 43
 */

// set manipurators
function setUnion (source, ...sets) {
	for (const set of sets) {
		source = new Set([...source, ...set]);
	}
	return source;
}

function setIntersection (source, ...sets) {
	for (const set of sets) {
		source = new Set([...source].filter(a => set.has(a)));
	}
	return source;
}

function setDifference (source, ...sets) {
	for (const set of sets) {
		source = new Set([...source].filter(a => !set.has(a)));
	}
	return source;
}

function tocps (cp) {
	// \xHH
	if (cp < 0x100) {
		return '\\x' + `00${cp.toString(16)}`.substr(-2).toUpperCase();
	}

	// \uHHHH
	if (0x100 <= cp && cp < 0x10000) {
		return '\\u' + `0000${cp.toString(16)}`.substr(-4).toUpperCase();
	}

	// \u{H}
	// \u{HH}     -> \xHH
	// \u{HHH}    -> \uHHHH
	// \u{HHHH}   -> \uHHHH
	// \u{HHHHH}
	// \u{HHHHHH}
	return '\\u{' + cp.toString(16).toUpperCase() + '}';
}

function regexpClassFromSet (set, invert) {
	const codePoints = [...set].sort((a, b) => a - b);
	const ranges = [];
	let from = 0, to;
	while (from < codePoints.length) {
		to = from;
		while (++to < codePoints.length && codePoints[to - 1] + 1 === codePoints[to]) {
			;
		}
		switch (to - from) {
		case 1:
			ranges.push(tocps(codePoints[from]));
			break;
		case 2:
			ranges.push(`${tocps(codePoints[from])}${tocps(codePoints[to - 1])}`);
			break;
		default:
			ranges.push(`${tocps(codePoints[from])}-${tocps(codePoints[to - 1])}`);
			break;
		}
		from = to;
	}
	return `[${invert ? '^' : ''}${ranges.join('')}]`;
}

export function q2pl (s, q = '*') {
	/*
	 * convert quantifier to positive lookahead
	 *
	 *   A* -> (?=(?<gcr0>A*))\k<gcr0>
	 *
	 * @see https://wanago.io/2019/09/23/regex-course-part-four-avoiding-catastrophic-backtracking-using-lookahead/
	 */
	//return s + q;
	const tag = `<gcr${groupCount++}>`;
	switch (q) {
	case '*':
		return `(?=(?${tag}${s}*))\\k${tag}`;
	case '+':
		return `(?=(?${tag}${s}+))\\k${tag}`;
	default:
		throw new Error(`q2pl: unknown quantifier: "${q}"`);
	}
}

//
function gcExtend () {
	/*
	 * Extend := Grapheme_Extend = Yes, or
	 *   Emoji_Modifier=Yes
	 *   This includes:
	 *   General_Category = Nonspacing_Mark
	 *   General_Category = Enclosing_Mark
	 *   U+200C ZERO WIDTH NON-JOINER
	 *   plus a few General_Category = Spacing_Mark needed for canonical equivalence.
	 */
	let result = new Set;
	result = setUnion(result,
		derivedCorePropertiesMap.get('Grapheme_Extend'),
		emojiDataMap.get('Emoji_Modifier')
	);
	return result;
}

function gcZWJ () {
	/*
	 * ZWJ := U+200D ZERO WIDTH JOINER
	 */
	let result = new Set([0x200d]);
	return result;
}

function gcSpacingMark () {
	/*
	 * SpacingMark := Grapheme_Cluster_Break ≠ Extend, and
	 *   General_Category = Spacing_Mark, or
	 *   any of the following (which have General_Category = Other_Letter):
	 *   U+0E33 ( ำ ) THAI CHARACTER SARA AM
	 *   U+0EB3 ( ຳ ) LAO VOWEL SIGN AM
	 *
	 *   Exceptions: The following (which have General_Category = Spacing_Mark
	 *   and would otherwise be included) are specifically excluded:
	 *     U+102B   MYANMAR VOWEL SIGN TALL AA
	 *     U+102C   MYANMAR VOWEL SIGN AA
	 *     U+1038   MYANMAR SIGN VISARGA
	 *     U+1062   MYANMAR VOWEL SIGN SGAW KAREN EU
	 *     ..U+1064 MYANMAR TONE MARK SGAW KAREN KE PHO
	 *     U+1067   MYANMAR VOWEL SIGN WESTERN PWO KAREN EU
	 *     ..U+106D MYANMAR SIGN WESTERN PWO KAREN TONE-5
	 *     U+1083   MYANMAR VOWEL SIGN SHAN AA
	 *     U+1087   MYANMAR SIGN SHAN TONE-2
	 *     ..U+108C MYANMAR SIGN SHAN COUNCIL TONE-3
	 *     U+108F   MYANMAR SIGN RUMAI PALAUNG TONE-5
	 *     U+109A   MYANMAR SIGN KHAMTI TONE-1
	 *     ..U+109C MYANMAR VOWEL SIGN AITON A
	 *     U+1A61   TAI THAM VOWEL SIGN A
	 *     U+1A63   TAI THAM VOWEL SIGN AA
	 *     U+1A64   TAI THAM VOWEL SIGN TALL AA
	 *     U+AA7B   MYANMAR SIGN PAO KAREN TONE
	 *     U+AA7D   MYANMAR SIGN TAI LAING TONE-5
	 *     U+11720  AHOM VOWEL SIGN A
	 *     U+11721  AHOM VOWEL SIGN AA
	 */
	let result = new Set;
	result = setUnion(result,
		generalCategoryMap.get('Mc'),
		new Set([0x0e33, 0x0eb3])
	);
	result = setDifference(result,
		new Set([
			0x102B,
			0x102C,
			0x1038,
			0x1062, 0x1063, 0x1064,
			0x1067, 0x1068, 0x1069, 0x106A, 0x106B, 0x106C, 0x106D,
			0x1083,
			0x1087, 0x1088, 0x1089, 0x108A, 0x108B, 0x108C, 0x108C,
			0x108F,
			0x109A, 0x109B, 0x109C,
			0x1A61,
			0x1A63,
			0x1A64,
			0xAA7B,
			0xAA7D,
			0x11720,
			0x11721,
		]));
	return result;
}

// grapheme cluster components
function gcCrlf () {
	/*
	 * crlf := CR LF | CR | LF
	 */
	return '\\u000D\\u000A?|\\u000A';
}

function gcControl () {
	/*
	 * Control :=
	 *   General_Category = Line_Separator, or
	 *   General_Category = Paragraph_Separator, or
	 *   General_Category = Control, or
	 *   General_Category = Unassigned and Default_Ignorable_Code_Point, or
	 *   General_Category = Format
	 *   and not U+000D CARRIAGE RETURN
	 *   and not U+000A LINE FEED
	 *   and not U+200C ZERO WIDTH NON-JOINER (ZWNJ)
	 *   and not U+200D ZERO WIDTH JOINER (ZWJ)
	 *   and not Prepended_Concatenation_Mark = Yes
	 */
	let result = new Set;
	result = setUnion(result,
		generalCategoryMap.get('Zl'),
		generalCategoryMap.get('Zp'),
		generalCategoryMap.get('Cc'),
		setIntersection(
			generalCategoryMap.get('Cn'),
			derivedCorePropertiesMap.get('Default_Ignorable_Code_Point')),
		generalCategoryMap.get('Cf'));
	result = setDifference(result,
		new Set([0x000d, 0x000a, 0x200c, 0x200d]),
		propListMap.get('Prepended_Concatenation_Mark'));
	return result;
}

function gcPrecore () {
	/*
	 * precore := Prepend
	 *
	 * Prepend :=
	 *   Indic_Syllabic_Category = Consonant_Preceding_Repha, or
	 *   Indic_Syllabic_Category = Consonant_Prefixed, or
	 *   Prepended_Concatenation_Mark = Yes
	 */
	let result = new Set;
	result = setUnion(result,
		indicSyllabicCategoryMap.get('Consonant_Preceding_Repha'),
		indicSyllabicCategoryMap.get('Consonant_Prefixed'),
		propListMap.get('Prepended_Concatenation_Mark'));
	return result;
}

function gcPostcore () {
	/*
	 * postcore := [Extend ZWJ SpacingMark]
	 */
	let result = new Set;
	result = setUnion(result,
		gcExtend(),
		gcZWJ(),
		gcSpacingMark()
	);
	return result;
}

function gcCore (target, group) {
	/*
	 * core := hangul-syllable
	 * | RI-Sequence
	 * | xpicto-sequence
	 * | conjunctCluster
	 * | [^Control CR LF]
	 *
	 * hangul-syllable :=
	 *   L* (V+ | LV V* | LVT) T*
	 *   | L+
	 *   | T+
	 *
	 * RI-Sequence :=
	 *   RI RI
	 *
	 * xpicto-sequence :=
	 *   \p{Extended_Pictographic} (Extend* ZWJ \p{Extended_Pictographic})*
	 *
	 * conjunctCluster :=
	 *   \p{InCB=Consonant} ([\p{InCB=Extend} \p{InCB=Linker}]* \p{InCB=Linker} [\p{InCB=Extend} \p{InCB=Linker}]* \p{InCB=Consonant})+
	 */
	const components = [];

	// hangul-syllable
	if (typeof target !== 'string'
	 || (new RegExp(gcCoreLStr, 'u')).test(target)
	 || (new RegExp(gcCoreVStr, 'u')).test(target)
	 || (new RegExp(gcCoreTStr, 'u')).test(target)
	 || (new RegExp(gcCoreLVStr, 'u')).test(target)
	 || (new RegExp(gcCoreLVTStr, 'u')).test(target)) {
		components.push(`${gcCoreLStr}*(?:${gcCoreVStr}+|${gcCoreLVStr}${gcCoreVStr}*|${gcCoreLVTStr})${gcCoreTStr}*|${gcCoreLStr}+|${gcCoreTStr}+`);
	}

	// RI-Sequence
	if (typeof target !== 'string'
	 || (new RegExp(gcCoreRIStr, 'u')).test(target)) {
		components.push(gcCoreRIStr);
	}

	// xpicto-sequence
	if (typeof target !== 'string'
	 || (new RegExp(gcCoreExpicStr, 'u')).test(target)) {
		components.push(`${gcCoreExpicStr}(?:${gcExtendStr}*${gcZWJStr}${gcCoreExpicStr})*`);
	}

	// conjunctCluster
	if (typeof target !== 'string'
	 || (new RegExp(gcCoreIncbConsonantStr, 'u')).test(target) && (new RegExp(gcCoreIncbLinkerStr, 'u')).test(target)) {
		components.push(`${gcCoreIncbConsonantStr}(?:${gcCoreIncbExLkStr}*${gcCoreIncbLinkerStr}${gcCoreIncbExLkStr}*${gcCoreIncbConsonantStr})+`);
	}

	// non-control characters
	if (typeof target !== 'string'
	 || (new RegExp(gcCoreNonControlStr, 'u')).test(target)) {
		components.push(gcCoreNonControlStr);
	}

	return group ?
		`(?:(${components.join(')|(')}))` :
		`(?:${components.join('|')})`;
}

export function graphemeRegex (target) {
	/*
	 * extended grapheme cluster :=
	 *   crlf
	 *   | Control
	 *   | precore* core postcore*
	 */
	groupCount = 0;
	if (typeof target === 'string') {
		let result = '(?:';

		result += gcCrlfStr;

		if ((new RegExp(gcControlStr, 'u')).test(target)) {
			result += '|' + gcControlStr;
		}

		let result2 = '';
		if ((new RegExp(gcPrecoreStr, 'u')).test(target)) {
			/*
			 * note: Backtracking is necessary here
			 *       because of the characters commonly included in precore and core.
			 *       Therefore, q2pl() not used.
			 */
			//result2 += q2pl(gcPrecoreStr, '*');
			result2 += `${gcPrecoreStr}*`;
		}
		result2 += gcCore(target);

		if ((new RegExp(gcPostcoreStr, 'u')).test(target)) {
			result2 += q2pl(gcPostcoreStr, '*');
		}
		if (result2 !== '') {
			result += '|' + result2;
		}

		result += ')';
		return result;
	}
	else {
		return `(?:` +
			`${gcCrlfStr}` +
			`|${gcControlStr}` +
			// Again, precore is used as is.
			`|${gcPrecoreStr}*${gcCore()}${q2pl(gcPostcoreStr)}` +
			`)`;
	}
}

export function coreExtractRegex (group) {
	groupCount = 0;
	/*
	 * 1: CRLF
	 * 2: Control
	 * 3: core (hangul-syllable)
	 * 4: core (RI-Sequence)
	 * 5: core (xpicto-sequence)
	 * 6: core (conjunctCluster)
	 * 7: core (non-control)
	 */
	return `(?:` +
		`(${gcCrlfStr})` +
		`|(${gcControlStr})` +
		`|${gcPrecoreStr}*${gcCore(undefined, group)}${gcPostcoreStr}*` +
		`)`;
}

/*
 * bootstrap
 */

const args = parseArgs();
const generalCategoryMap = new Map;
const derivedCorePropertiesMap = new Map;
const propListMap = new Map;
const indicSyllabicCategoryMap = new Map;
const emojiDataMap = new Map;
const hangulSyllableTypeMap = new Map;

await makeGeneralCategoryMap();
await makeDerivedCorePropertiesMap();
await makePropListMap();
await makeIndicSyllabicCategoryMap();
await makeEmojiDataMap();
await makeHangulSyllableTypeMap();

/*
 *
 */

let groupCount = 0;
const gcExtendStr = regexpClassFromSet(gcExtend());
const gcZWJStr = regexpClassFromSet(gcZWJ());
const gcSpacingMarkStr = regexpClassFromSet(gcSpacingMark());
const gcCrlfStr = gcCrlf();
const gcControlStr = regexpClassFromSet(gcControl());;
const gcPrecoreStr = regexpClassFromSet(gcPrecore());
const gcPostcoreStr = regexpClassFromSet(gcPostcore());;

const gcCoreLStr = regexpClassFromSet(hangulSyllableTypeMap.get('L'));
const gcCoreVStr = regexpClassFromSet(hangulSyllableTypeMap.get('V'));
const gcCoreTStr = regexpClassFromSet(hangulSyllableTypeMap.get('T'));
const gcCoreLVStr = regexpClassFromSet(hangulSyllableTypeMap.get('LV'));
const gcCoreLVTStr = regexpClassFromSet(hangulSyllableTypeMap.get('LVT'));
const gcCoreRIStr = regexpClassFromSet(propListMap.get('Regional_Indicator')) + '{2}';
const gcCoreExpicStr = regexpClassFromSet(emojiDataMap.get('Extended_Pictographic'));
const gcCoreIncbConsonantStr = regexpClassFromSet(
	derivedCorePropertiesMap.get('InCB; Consonant'));
const gcCoreIncbLinkerStr = regexpClassFromSet(
	derivedCorePropertiesMap.get('InCB; Linker'));
const gcCoreIncbExLkStr = regexpClassFromSet(setUnion(
	derivedCorePropertiesMap.get('InCB; Extend'),
	derivedCorePropertiesMap.get('InCB; Linker')));
const gcCoreNonControlStr = regexpClassFromSet(setUnion(
	gcControl(),
	new Set([0x000d, 0x000a])), true);

try {
	if (args.output) {
		await makeSourceCode(null, {
			variables: {
				groupCount
			},
			consts: {
				gcExtendStr, gcZWJStr, gcSpacingMarkStr, gcCrlfStr, gcControlStr,
				gcPrecoreStr, gcPostcoreStr,
				gcCoreLStr, gcCoreVStr, gcCoreTStr, gcCoreLVStr, gcCoreLVTStr,
				gcCoreRIStr,
				gcCoreExpicStr,
				gcCoreIncbConsonantStr, gcCoreIncbLinkerStr, gcCoreIncbExLkStr,
				gcCoreNonControlStr
			},
			functions: {
				q2pl, gcCore
			},
			exportedFunctions: {
				graphemeRegex, coreExtractRegex
			}
		});
	}
}
catch (err) {
	if (args.verbose) {
		console.error(err?.stack);
	}
	else {
		console.error(err?.message);
	}
	process.exit(1);
}
