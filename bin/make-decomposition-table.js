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
const UNICODE_VERSION = '15.1.0';
const UCD_SOURCE_URL = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/UnicodeData.txt`;
const UCD_PATH = nodePath.join(dirname, '../unicode/UnicodeData.txt');

// output file configurations
const CODE_PATH = nodePath.join(dirname, '../src/lib/unifier.js');

// decomposable character types
const TYPE_LETTER_WITH_MIDDLE_DOT = 0;					// LETTER with middle dot
const TYPE_APOSTROPHE_WITH_LETTER = 1;					// apostrophe with LETTER
const TYPE_DEGREE_WITH_LETTER = 2;						// degree with LETTER
const TYPE_VISIBLE_DIACRITICAL_MARK = 3;				// visible diacritical mark
const TYPE_COMBINING_MARKS = 4;							// combining marks
const TYPE_KATAKANA_HIRAGANA = 5;						// Katakana/Hiragana with combining marks
const TYPE_LETTER_WITH_COMBINING_MARKS = 6;				// LETTER with combining marks
const TYPE_LETTER_WITH_COMBINING_MARKS_REVERSED = 7;	// LETTER with combining marks (reversed)
const TYPE_SIMPLE_SUBST = 254;							// simple subst
const TYPE_COMPLEX_SUBST = 255;							// complex subst

/*
 * functions
 */

function downloadFrom (url, path) {
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

function printHelp () {
	const name = nodePath.basename(process.argv[1]);
	console.log(`\
${name} -- make unicode decomposition table
usage: ${name} [options]
option:
  -f, --force-load-ucd    Force loading of ucd(UnicodeData.txt) file
`);
	process.exit(1);
}

function parseArgs () {
	try {
		const args = util.parseArgs({
			options: {
				'help':           {type: 'boolean', short: 'h'},
				'force-load-ucd': {type: 'boolean', short: 'f'},
				'verbose':        {type: 'boolean', short: 'v'},
				'?':              {type: 'boolean'}
			},
			strict: true
		});

		let forceLoadUCD = false;

		if (args.values.help || args.values['?']) {
			printHelp();
		}
		if (args.values['force-load-ucd']) {
			forceLoadUCD = true;
		}
		return {
			forceLoadUCD,
			verbose: args.values.verbose
		};
	}
	catch (err) {
		console.error(err.message);
		printHelp();
	}
}

function fileExists (filepath, mode) {
	let result = true;
	try {
		fs.accessSync(filepath, mode || fs.constants.R_OK);
	}
	catch {
		result = false;
	}
	return result;
}

function classify (cp, decomp) {
	let key = '*';
	let d = '';
	let type = '';
	let codePoints = [];

	decomp.replace(/<([^>]+)>\s*/, ($0, $1) => {
		key = $1;
		return '';
	}).replace(/[0-9A-F]+/g, $0 => {
		const cp = parseInt($0, 16);
		d += String.fromCodePoint(cp);
		codePoints.push(cp);
	});

	if (/^\P{M}\u00b7$/u.test(d)) {
		type = TYPE_LETTER_WITH_MIDDLE_DOT;
	}
	else if (/^\u02bc\P{M}$/u.test(d)) {
		type = TYPE_APOSTROPHE_WITH_LETTER;
	}
	else if (/^\u00b0\P{M}$/u.test(d)) {
		type = TYPE_DEGREE_WITH_LETTER;
	}
	else if (/^\u0020.$/u.test(d)) {
		type = TYPE_VISIBLE_DIACRITICAL_MARK;
	}
	else if (/^\p{M}+$/u.test(d)) {
		type = TYPE_COMBINING_MARKS;
	}
	else if (/^[\p{Script=Katakana}\p{Script=Hiragana}]\p{M}$/u.test(d)) {
		type = TYPE_COMPLEX_SUBST;
	}
	else if (/^\P{M}\p{M}+$/u.test(d)) {
		type = TYPE_LETTER_WITH_COMBINING_MARKS;
	}
	else if (/^\p{M}+\P{M}$/u.test(d)) {
		type = TYPE_LETTER_WITH_COMBINING_MARKS_REVERSED;
	}
	else {
		if (/^.$/u.test(d)) {
			type = TYPE_SIMPLE_SUBST;
		}
		else {
			type = TYPE_COMPLEX_SUBST;
		}
	}

	return {cp, decomp, key, type, codePoints};
}

function isStrongRTL (cp) {
	return /^(?:AL|R)$/.test(bidiClassMap.get(cp));
}

function isCombiningMark (cp) {
	return /^\p{M}$/u.test(String.fromCodePoint(cp));
}

function getStringFromCodePoints (cp, gryphOnly) {
	const r1 = (Array.isArray(cp) ? cp : [cp])
		.map(cp => {
			const ch = String.fromCodePoint(cp);
			if (cp == 0xa0 || isCombiningMark(cp) || isStrongRTL(cp)) {
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

function getDumpedString (s, gryphOnly) {
	if (typeof s !== 'string') {
		return '' + s;
	}

	const codePoints = [];
	for (const ch of s) {
		codePoints.push(ch.codePointAt(0));
	}

	return getStringFromCodePoints(codePoints, gryphOnly);
}

function fold (decomp) {
	if ('folded' in decomp) {
		return decomp.folded;
	}

	const result = [];
	const codePoints = decomp.decomp.split(' ');
	if (codePoints.length && /^<[^>]+>$/.test(codePoints[0])) {
		codePoints.shift();
	}

	let indices;

	switch (decomp.type) {
	case TYPE_LETTER_WITH_MIDDLE_DOT:
		indices = [0];
		break;
	case TYPE_APOSTROPHE_WITH_LETTER:
		indices = [1];
		break;
	case TYPE_DEGREE_WITH_LETTER:
		indices = [1];
		break;

	case TYPE_VISIBLE_DIACRITICAL_MARK:
	case TYPE_COMBINING_MARKS:
		break;

	case TYPE_LETTER_WITH_COMBINING_MARKS:
		indices = [0];
		break;
	case TYPE_LETTER_WITH_COMBINING_MARKS_REVERSED:
		indices = [1];
		break;

	case TYPE_SIMPLE_SUBST:
		indices = [0];
		break;
	case TYPE_COMPLEX_SUBST:
		indices = Object.keys(codePoints);
		break;

	default:
		throw new Error(`fold: unknown type: ${decomp.type}`);
	}

	for (const cps of codePoints) {
		const cp = parseInt(cps, 16);
		if (decompositionMap.has(cp)) {
			fold(decompositionMap.get(cp));
		}
	}

	if (indices) {
		for (const index of indices) {
			const cp = parseInt(codePoints[index], 16);
			if (decompositionMap.has(cp)) {
				result.push(fold(decompositionMap.get(cp)));
			}
			else {
				result.push(String.fromCodePoint(cp));
			}
		}

		return decomp.folded = result.join('');
	}
	else {
		return decomp.folded = null;
	}
}

function printDecomposition (decomp, depth = 0) {
	const indent = ' '.repeat(depth * 4);
	const source = `${getDumpedString(String.fromCodePoint(decomp.cp))}`;
	const decompDesc = `${decomp.decomp} (${decomp.type})`;
	const foldResult = `${getDumpedString(decomp.folded)}`;
	console.log(`${indent}${source}: ${decompDesc} → ${foldResult}`);

	for (const cp of decomp.codePoints) {
		if (decompositionMap.has(cp)) {
			printDecomposition(decompositionMap.get(cp), depth + 1);
		}
	}
}

function unifyString (s) {
	return Array
		.from((new Intl.Segmenter).segment(s))
		.map(seg => {
			const decomp =
				decompositionMap.get(segment.normalize('NFKC').codePointAt(0))
			 ?? decompositionMap.get(segment.normalize('NFC').codePointAt(0))
			 ?? decompositionMap.get(segment.codePointAt(0));
			return decomp?.folded ?? segment;
		})
		.join('');
}

/*
 * unicode data map loaders
 */

async function makeDecompositionMap () {
	if (args.forceLoadUCD || !fileExists(UCD_PATH)) {
		console.log(`loading UnicodeData.txt...`);
		await downloadFrom(UCD_SOURCE_URL, UCD_PATH);
		console.log(`done.`);
	}

	if (!fileExists(UCD_PATH)) {
		throw new Error(`UnicodeData.txt not found on "${UCD_PATH}". stop.`);
	}

	// register decomposition data from UnicodeData.txt
	const stream = fs.createReadStream(UCD_PATH);
	try {
		const rl = readline.createInterface({
			input: stream,
			crlfDelay: Infinity,
		});

		for await (const line of rl) {
			const [cpString,,,, bidi, decompString] = line.split(';');
			const cp = parseInt(cpString, 16);

			if (bidi !== '') {
				bidiClassMap.set(cp, bidi);
			}

			if (decompString !== '') {
				decompositionMap.set(cp, classify(cp, decompString));
			}
		}
	}
	finally {
		stream.close();
	}

	// register japanese han old->new mappings
	for (const [oldHan, newHan] of Object.entries(hanJp1981)) {
		const cp = oldHan.codePointAt(0);
		const decompString = `<hanjp1981> ${newHan.codePointAt(0).toString(16).toUpperCase()}`;
		decompositionMap.set(cp, classify(cp, decompString));
	}

	// Unicode 15.1.0 seems to have some omissions about unifying mappings.
	// so we fill in the missing pieces here.
	//   - Kana Supplement                  U+1B000 - U+1B0FF
	//   - Kana Extended-A                  U+1B100 - U+1B12F
	//   - Enclosed Alphanumeric            U+2460  - U+24FF
	//   - Enclosed Alphanumeric Supplement U+1F100 - U+1F1FF
	for (const supplement of [
		kanaSupplement,
		enclosedAlphanumeric,
		enclosedAlphanumericSupplement]
	) {
		for (const [from, to] of Object.entries(supplement)) {
			const cp = from.codePointAt(0);
			if (!decompositionMap.has(cp)) {
				const decompString = `<supplement> ` +
					[...to]
						.map(ch => ch.codePointAt(0).toString(16).toUpperCase())
						.join(' ');
				decompositionMap.set(cp, classify(cp, decompString));
				//console.log(`${from}: ${to} ${decompString}`);
			}
		}
	}

	// create all fold data
	let printed = 0;
	for (const key of decompositionMap.keys()) {
		const decomp = decompositionMap.get(key);
		fold(decomp);

		//printDecomposition(decomp);
		//if (++printed >= 256) break;
	}

}

async function makeSourceCode () {
	return new Promise((resolve, reject) => {
		const stream = fs.createWriteStream(CODE_PATH);
		stream.on('finish', () => {
			stream.close();
			console.log(`source code generated to: "${CODE_PATH}".`);
			resolve();
		});
		stream.on('error', err => {
			console.dir(err);
			reject();
		});

		stream.write(`\
/*
 * unifier.js - unify characters for search
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
import {coreExtractRegex} from './grapheme-regex.js';
`);

		stream.write('const map = {\n');
		for (const key of decompositionMap.keys()) {
			const decomp = decompositionMap.get(key);
			if (decomp.folded !== null) {
				const ch = getStringFromCodePoints(key, true);
				const value = getDumpedString(decomp.folded, true);
				stream.write(`\t${ch}: ${value},\n`);
			}
		}
		stream.write('};\n');

		stream.write(`\
const coreExtractPattern = new RegExp(\`^\${coreExtractRegex(true)}$\`, 'u');
function extractCore (s) {
	s = s.normalize('NFD');
	if (s.length === 1) return s;
	if (s.length === 2 && /^[\\ud800-\\udbff][\\udc00-\\udfff]$/.test(s)) return s;
	const re = coreExtractPattern.exec(s);
	if (!re) return s;

	/*
	 * 1: CRLF
	 * 2: Control
	 * 3: core (hangul-syllable)
	 * 4: core (RI-Sequence)
	 * 5: core (xpicto-sequence)
	 * 6: core (conjunctCluster)
	 * 7: core (non-control)
	 */
	for (let i = 1; i <= 7; i++) {
		if (typeof re[i] !== 'string') continue;
		if (re[i] === '') continue;
		if (i === 5) {
			if (re[i].length === 1) return re[i];
			if (re[i].length === 2 && /^[\\ud800-\\udbff][\\udc00-\\udfff]$/.test(re[i])) return re[i];
			return [...re[i]][0];
		}
		else {
			return re[i];
		}
	}
	return s;
}
export function unifyGrapheme (g) {
	return map[String.fromCodePoint(g.normalize('NFKC').codePointAt(0))]
		?? map[String.fromCodePoint(g.normalize('NFC').codePointAt(0))]
		?? map[g]
		?? extractCore(g);
}
export function unifyString (s) {
	return Array
		.from((new Intl.Segmenter).segment(s))
		.map(seg => unifyGrapheme(seg.segment))
		.join('');
}
`);
		stream.end();
	});
}

const args = parseArgs();
const bidiClassMap = new Map;
const decompositionMap = new Map;

/*
 * 日本語圏で使用される漢字における
 * 常用漢字表、人名用漢字に収録された新字体とその旧字体のマップ
 *
 * @see https://www.asahi-net.or.jp/~ax2s-kmtn/ref/old_chara.html
 */
const hanJp1981 = {
	// 常用漢字表
	"亞": "亜",	// U+4E9E(5033) -> U+4E9C(3021)
	"惡": "悪",	// U+60E1(5828) -> U+60AA(302D)
	"壓": "圧",	// U+58D3(545A) -> U+5727(3035)
	"圍": "囲",	// U+570D(5423) -> U+56F2(304F)
	"爲": "為",	// U+7232(602A) -> U+70BA(3059)
	"醫": "医",	// U+91AB(6E50) -> U+533B(3065)
	"壹": "壱",	// U+58F9(5465) -> U+58F1(306D)
	"逸": "逸",	// U+FA67(7C59) -> U+9038(306F)
	"稻": "稲",	// U+7A3B(634B) -> U+7A32(3070)
	"飮": "飲",	// U+98EE(5D3B) -> U+98F2(307B)
	"隱": "隠",	// U+96B1(702C) -> U+96A0(3123)
	"營": "営",	// U+71DF(535B) -> U+55B6(3144)
	"榮": "栄",	// U+69AE(5C46) -> U+6804(3149)
	"衞": "衛",	// U+885E(6A4C) -> U+885B(3152)
	"驛": "駅",	// U+9A5B(7163) -> U+99C5(3158)
	"謁": "謁",	// U+FA62(7C2F) -> U+8B01(315A)
	"圓": "円",	// U+5713(5424) -> U+5186(315F)
	"緣": "縁",	// U+7DE3(7A2D) -> U+7E01(316F)
	"艷": "艶",	// U+8277(6766) -> U+8276(3170)
	"鹽": "塩",	// U+9E7D(7345) -> U+5869(3176)
	"奧": "奥",	// U+5967(547C) -> U+5965(317C)
	"應": "応",	// U+61C9(5866) -> U+5FDC(317E)
	"橫": "横",	// U+6A6B(7630) -> U+6A2A(3223)
	"歐": "欧",	// U+6B50(5D3F) -> U+6B27(3224)
	"毆": "殴",	// U+6BC6(5D58) -> U+6BB4(3225)
	"黃": "黄",	// U+9EC3(7E71) -> U+9EC4(322B)
	"溫": "温",	// U+6EAB(767C) -> U+6E29(3239)
	"穩": "穏",	// U+7A69(6353) -> U+7A4F(323A)
	"假": "仮",	// U+5047(5071) -> U+4EEE(323E)
	"價": "価",	// U+50F9(512B) -> U+4FA1(3241)
	"禍": "禍",	// U+FA52(793F) -> U+798D(3252)
	"畫": "画",	// U+756B(6141) -> U+753B(3268)
	"會": "会",	// U+6703(5072) -> U+4F1A(3271)
	"壞": "壊",	// U+58DE(5455) -> U+58CA(3275)
	"悔": "悔",	// U+FA3D(7450) -> U+6094(3279)
	"懷": "懐",	// U+61F7(5867) -> U+61D0(327B)
	"海": "海",	// U+FA45(7669) -> U+6D77(3324)
	"繪": "絵",	// U+7E6A(6569) -> U+7D75(3328)
	"慨": "慨",	// U+FA3E(745C) -> U+6168(3334)
	"槪": "概",	// U+69EA(7624) -> U+6982(3335)
	"擴": "拡",	// U+64F4(5A32) -> U+62E1(3348)
	"殼": "殻",	// U+6BBC(5D57) -> U+6BBB(334C)
	"覺": "覚",	// U+89BA(6B34) -> U+899A(3350)
	"學": "学",	// U+5B78(555C) -> U+5B66(3358)
	"嶽": "岳",	// U+5DBD(5656) -> U+5CB3(3359)
	"樂": "楽",	// U+6A02(5C5B) -> U+697D(335A)
	"喝": "喝",	// U+FA36(2F2C) -> U+559D(3365)
	"渴": "渇",	// U+6E34(7678) -> U+6E07(3369)
	"褐": "褐",	// U+FA60(7B6F) -> U+8910(336C)
	"勸": "勧",	// U+52F8(5230) -> U+52E7(342B)
	"卷": "巻",	// U+5377(524B) -> U+5DFB(342C)
	"寬": "寛",	// U+5BEC(4F5A) -> U+5BDB(3432)
	"歡": "歓",	// U+6B61(5D44) -> U+6B53(343F)
	"漢": "漢",	// U+FA47(7725) -> U+6F22(3441)
	"罐": "缶",	// U+7F50(6625) -> U+7F36(344C)
	"觀": "観",	// U+89C0(6B37) -> U+89B3(3451)
	"關": "関",	// U+95DC(6F70) -> U+95A2(3458)
	"陷": "陥",	// U+9677(6F7C) -> U+9665(3459)
	"顏": "顔",	// U+984F(707A) -> U+9854(3469)
	"器": "器",	// U+FA38(2F36) -> U+5668(346F)
	"既": "既",	// U+FA42(752B) -> U+65E2(347B)
	"歸": "帰",	// U+6B78(5D45) -> U+5E30(3522)
	"氣": "気",	// U+6C23(5D66) -> U+6C17(3524)
	"祈": "祈",	// U+FA4E(7973) -> U+7948(3527)
	"龜": "亀",	// U+9F9C(737D) -> U+4E80(3535)
	"僞": "偽",	// U+50DE(5126) -> U+507D(3536)
	"戲": "戯",	// U+6232(5926) -> U+622F(353A)
	"犧": "犠",	// U+72A7(603A) -> U+72A0(353E)
	"舊": "旧",	// U+820A(6751) -> U+65E7(356C)
	"據": "拠",	// U+64DA(5A21) -> U+62E0(3572)
	"擧": "挙",	// U+64E7(5A29) -> U+6319(3573)
	"虛": "虚",	// U+865B(7B4E) -> U+865A(3575)
	"峽": "峡",	// U+5CFD(5637) -> U+5CE1(362E)
	"挾": "挟",	// U+633E(5951) -> U+631F(3634)
	"狹": "狭",	// U+72F9(6045) -> U+72ED(3639)
	"鄕": "郷",	// U+9115(7C6C) -> U+90F7(363F)
	"響": "響",	// U+FA69(7D76) -> U+97FF(3641)
	"曉": "暁",	// U+66C9(5A7C) -> U+6681(3647)
	"勤": "勤",	// U+FA34(2E68) -> U+52E4(3650)
	"謹": "謹",	// U+FA63(7C30) -> U+8B39(3660)
	"區": "区",	// U+5340(523F) -> U+533A(3668)
	"驅": "駆",	// U+9A45(715C) -> U+99C6(366E)
	"勳": "勲",	// U+52F3(522E) -> U+52F2(372E)
	"薰": "薫",	// U+85B0(7B40) -> U+85AB(3730)
	"徑": "径",	// U+5F91(574D) -> U+5F84(3742)
	"惠": "恵",	// U+60E0(582A) -> U+6075(3743)
	"揭": "掲",	// U+63ED(7473) -> U+63B2(3747)
	"溪": "渓",	// U+6EAA(5E64) -> U+6E13(374C)
	"經": "経",	// U+7D93(6534) -> U+7D4C(3750)
	"繼": "継",	// U+7E7C(656B) -> U+7D99(3751)
	"莖": "茎",	// U+8396(6833) -> U+830E(3754)
	"螢": "蛍",	// U+87A2(6A25) -> U+86CD(3756)
	"輕": "軽",	// U+8F15(6D4B) -> U+8EFD(375A)
	"鷄": "鶏",	// U+9DC4(7331) -> U+9D8F(375C)
	"藝": "芸",	// U+85DD(693A) -> U+82B8(375D)
	"擊": "撃",	// U+64CA(7522) -> U+6483(3762)
	"缺": "欠",	// U+7F3A(657E) -> U+6B20(3767)
	"儉": "倹",	// U+5109(512D) -> U+5039(3770)
	"劍": "剣",	// U+528D(5178) -> U+5263(3775)
	"圈": "圏",	// U+5708(5421) -> U+570F(3777)
	"檢": "検",	// U+6AA2(5C7D) -> U+691C(3821)
	"權": "権",	// U+6B0A(5C5E) -> U+6A29(3822)
	"獻": "献",	// U+737B(605B) -> U+732E(3825)
	"硏": "研",	// U+784F(7923) -> U+7814(3826)
	"縣": "県",	// U+7E23(6551) -> U+770C(3829)
	"險": "険",	// U+96AA(702A) -> U+967A(3831)
	"顯": "顕",	// U+986F(707D) -> U+9855(3832)
	"驗": "験",	// U+9A57(7164) -> U+9A13(3833)
	"嚴": "厳",	// U+56B4(536E) -> U+53B3(3837)
	"效": "効",	// U+6548(5A43) -> U+52B9(387A)
	"廣": "広",	// U+5EE3(5722) -> U+5E83(392D)
	"恆": "恒",	// U+6046(5771) -> U+6052(3931)
	"鑛": "鉱",	// U+945B(6F4A) -> U+9271(395B)
	"號": "号",	// U+865F(694B) -> U+53F7(3966)
	"國": "国",	// U+570B(5422) -> U+56FD(3971)
	"穀": "穀",	// U+FA54(794D) -> U+7A40(3972)
	"黑": "黒",	// U+9ED1(7E72) -> U+9ED2(3975)
	"濟": "済",	// U+6FDF(5F3B) -> U+6E08(3A51)
	"碎": "砕",	// U+788E(626C) -> U+7815(3A55)
	"齋": "斎",	// U+9F4B(6337) -> U+658E(3A58)
	"劑": "剤",	// U+5291(517D) -> U+5264(3A5E)
	"櫻": "桜",	// U+6AFB(5D2F) -> U+685C(3A79)
	"册": "冊",	// U+518C(5146) -> U+518A(3A7D)
	"殺": "殺",	// U+F970(7649) -> U+6BBA(3B26)
	"雜": "雑",	// U+96DC(7038) -> U+96D1(3B28)
	"參": "参",	// U+53C3(5254) -> U+53C2(3B32)
	"慘": "惨",	// U+6158(584E) -> U+60E8(3B34)
	"棧": "桟",	// U+68E7(5C22) -> U+685F(3B37)
	"蠶": "蚕",	// U+8836(6A44) -> U+8695(3B3D)
	"贊": "賛",	// U+8D0A(6C55) -> U+8CDB(3B3F)
	"殘": "残",	// U+6B98(5D4C) -> U+6B8B(3B44)
	"祉": "祉",	// U+FA4D(7934) -> U+7949(3B63)
	"絲": "糸",	// U+7D72(652F) -> U+7CF8(3B65)
	"視": "視",	// U+FA61(7B79) -> U+8996(3B6B)
	"齒": "歯",	// U+9F52(736F) -> U+6B6F(3B75)
	"兒": "児",	// U+5152(513B) -> U+5150(3B79)
	"辭": "辞",	// U+8FAD(6D66) -> U+8F9E(3C2D)
	"濕": "湿",	// U+6FD5(5F3C) -> U+6E7F(3C3E)
	"實": "実",	// U+5BE6(5569) -> U+5B9F(3C42)
	"舍": "舎",	// U+820D(6752) -> U+820E(3C4B)
	"寫": "写",	// U+5BEB(556D) -> U+5199(3C4C)
	"煮": "煮",	// U+FA48(7755) -> U+716E(3C51)
	"社": "社",	// U+FA4C(7933) -> U+793E(3C52)
	"者": "者",	// U+FA5B(7A44) -> U+8005(3C54)
	"釋": "釈",	// U+91CB(6E59) -> U+91C8(3C61)
	"壽": "寿",	// U+58FD(5468) -> U+5BFF(3C77)
	"收": "収",	// U+6536(5A40) -> U+53CE(3C7D)
	"臭": "臭",	// U+FA5C(7A58) -> U+81ED(3D2D)
	"從": "従",	// U+5F9E(574F) -> U+5F93(3D3E)
	"澁": "渋",	// U+6F81(5F27) -> U+6E0B(3D42)
	"獸": "獣",	// U+7378(6059) -> U+7363(3D43)
	"縱": "縦",	// U+7E31(6554) -> U+7E26(3D44)
	"祝": "祝",	// U+FA51(793B) -> U+795D(3D4B)
	"肅": "粛",	// U+8085(6669) -> U+7C9B(3D4D)
	"處": "処",	// U+8655(515D) -> U+51E6(3D68)
	"暑": "暑",	// U+FA43(7543) -> U+6691(3D6B)
	"緖": "緒",	// U+7DD6(7A2C) -> U+7DD2(3D6F)
	"署": "署",	// U+FA5A(7A3A) -> U+7F72(3D70)
	"諸": "諸",	// U+FA22(7C2E) -> U+8AF8(3D74)
	"敍": "叙",	// U+654D(5A46) -> U+53D9(3D76)
	"奬": "奨",	// U+596C(547D) -> U+5968(3E29)
	"將": "将",	// U+5C07(5572) -> U+5C06(3E2D)
	"涉": "渉",	// U+6D89(766C) -> U+6E09(3E44)
	"燒": "焼",	// U+71D2(5F76) -> U+713C(3E46)
	"祥": "祥",	// U+FA1A(793D) -> U+7965(3E4D)
	"稱": "称",	// U+7A31(634A) -> U+79F0(3E4E)
	"證": "証",	// U+8B49(6B7A) -> U+8A3C(3E5A)
	"乘": "乗",	// U+4E58(502B) -> U+4E57(3E68)
	"剩": "剰",	// U+5269(5174) -> U+5270(3E6A)
	"壤": "壌",	// U+58E4(5461) -> U+58CC(3E6D)
	"孃": "嬢",	// U+5B43(5550) -> U+5B22(3E6E)
	"條": "条",	// U+689D(5B6A) -> U+6761(3E72)
	"淨": "浄",	// U+6DE8(5E46) -> U+6D44(3E74)
	"狀": "状",	// U+72C0(776D) -> U+72B6(3E75)
	"疊": "畳",	// U+758A(6148) -> U+7573(3E76)
	"讓": "譲",	// U+8B93(6C2A) -> U+8B72(3E79)
	"釀": "醸",	// U+91C0(6E56) -> U+91B8(3E7A)
	"囑": "嘱",	// U+56D1(5376) -> U+5631(3E7C)
	"觸": "触",	// U+89F8(6B3D) -> U+89E6(3F28)
	"寢": "寝",	// U+5BE2(556A) -> U+5BDD(3F32)
	"愼": "慎",	// U+613C(5846) -> U+614E(3F35)
	"眞": "真",	// U+771E(6243) -> U+771F(3F3F)
	"神": "神",	// U+FA19(793C) -> U+795E(3F40)
	"盡": "尽",	// U+76E1(6238) -> U+5C3D(3F54)
	"圖": "図",	// U+5716(5426) -> U+56F3(3F5E)
	"粹": "粋",	// U+7CB9(646F) -> U+7C8B(3F68)
	"醉": "酔",	// U+9189(6E4D) -> U+9154(3F6C)
	"隨": "随",	// U+96A8(6E2E) -> U+968F(3F6F)
	"髓": "髄",	// U+9AD3(7172) -> U+9AC4(3F71)
	"數": "数",	// U+6578(5A4B) -> U+6570(3F74)
	"樞": "枢",	// U+6A1E(5C64) -> U+67A2(3F75)
	"瀨": "瀬",	// U+7028(773E) -> U+702C(4025)
	"聲": "声",	// U+8072(6661) -> U+58F0(403C)
	"靜": "静",	// U+975C(7050) -> U+9759(4045)
	"齊": "斉",	// U+9F4A(736E) -> U+6589(4046)
	"攝": "摂",	// U+651D(5970) -> U+6442(405D)
	"竊": "窃",	// U+7ACA(6366) -> U+7A83(4060)
	"節": "節",	// U+FA56(7964) -> U+7BC0(4061)
	"專": "専",	// U+5C08(5573) -> U+5C02(406C)
	"戰": "戦",	// U+6230(5925) -> U+6226(406F)
	"淺": "浅",	// U+6DFA(5E49) -> U+6D45(4075)
	"潛": "潜",	// U+6F5B(5F2A) -> U+6F5C(4078)
	"纖": "繊",	// U+7E96(6579) -> U+7E4A(4121)
	"踐": "践",	// U+8E10(6C78) -> U+8DF5(4129)
	"錢": "銭",	// U+9322(6F22) -> U+92AD(412C)
	"禪": "禅",	// U+79AA(6338) -> U+7985(4135)
	"曾": "曽",	// U+66FE(413D) -> U+66FD(413E)
	"祖": "祖",	// U+FA50(7939) -> U+7956(4144)
	"僧": "僧",	// U+FA31(2E49) -> U+50E7(414E)
	"雙": "双",	// U+96D9(5256) -> U+53CC(4150)
	"壯": "壮",	// U+58EF(5463) -> U+58EE(4154)
	"層": "層",	// U+FA3B(4F61) -> U+5C64(4158)
	"搜": "捜",	// U+641C(5953) -> U+635C(415C)
	"插": "挿",	// U+63D2(5967) -> U+633F(415E)
	"巢": "巣",	// U+5DE2(7428) -> U+5DE3(4163)
	"爭": "争",	// U+722D(6027) -> U+4E89(4168)
	"瘦": "痩",	// U+7626(7E7D) -> U+75E9(4169)
	"總": "総",	// U+7E3D(6541) -> U+7DCF(416D)
	"莊": "荘",	// U+838A(6837) -> U+8358(4171)
	"裝": "装",	// U+88DD(6A66) -> U+88C5(4175)
	"騷": "騒",	// U+9A37(715B) -> U+9A12(417B)
	"增": "増",	// U+589E(2F5D) -> U+5897(417D)
	"憎": "憎",	// U+FA3F(745E) -> U+618E(417E)
	"臟": "臓",	// U+81DF(6747) -> U+81D3(4221)
	"藏": "蔵",	// U+85CF(6936) -> U+8535(4222)
	"贈": "贈",	// U+FA65(7C3D) -> U+8D08(4223)
	"卽": "即",	// U+537D(2E71) -> U+5373(4228)
	"屬": "属",	// U+5C6C(5624) -> U+5C5E(4230)
	"續": "続",	// U+7E8C(6574) -> U+7D9A(4233)
	"墮": "堕",	// U+58AE(5458) -> U+5815(4244)
	"體": "体",	// U+9AD4(7173) -> U+4F53(424E)
	"對": "対",	// U+5C0D(5574) -> U+5BFE(4250)
	"帶": "帯",	// U+5E36(5668) -> U+5E2F(4253)
	"滯": "滞",	// U+6EEF(5E7C) -> U+6EDE(425A)
	"臺": "台",	// U+81FA(674A) -> U+53F0(4266)
	"瀧": "滝",	// U+7027(426D) -> U+6EDD(426C)
	"擇": "択",	// U+64C7(5A24) -> U+629E(4272)
	"澤": "沢",	// U+6FA4(5F37) -> U+6CA2(4274)
	"單": "単",	// U+55AE(5345) -> U+5358(4331)
	"嘆": "嘆",	// U+FA37(2F2F) -> U+5606(4332)
	"擔": "担",	// U+64D4(593F) -> U+62C5(4334)
	"膽": "胆",	// U+81BD(673C) -> U+80C6(4340)
	"團": "団",	// U+5718(5425) -> U+56E3(4344)
	"彈": "弾",	// U+5F48(573C) -> U+5F3E(4346)
	"斷": "断",	// U+65B7(5A52) -> U+65AD(4347)
	"癡": "痴",	// U+7661(6177) -> U+75F4(4354)
	"遲": "遅",	// U+9072(6E2F) -> U+9045(4359)
	"晝": "昼",	// U+665D(5A6C) -> U+663C(436B)
	"蟲": "虫",	// U+87F2(6A35) -> U+866B(436E)
	"鑄": "鋳",	// U+9444(6F49) -> U+92F3(4372)
	"著": "著",	// U+FA5F(7B27) -> U+8457(4378)
	"廳": "庁",	// U+5EF3(572C) -> U+5E81(4423)
	"徵": "徴",	// U+5FB5(7444) -> U+5FB4(4427)
	"懲": "懲",	// U+FA40(7461) -> U+61F2(4428)
	"聽": "聴",	// U+807D(6665) -> U+8074(4430)
	"敕": "勅",	// U+6555(5A45) -> U+52C5(443C)
	"鎭": "鎮",	// U+93AD(6F2F) -> U+93AE(4443)
	"塚": "塚",	// U+FA10(2F57) -> U+585A(444D)
	"遞": "逓",	// U+905E(6E2A) -> U+9013(447E)
	"鐵": "鉄",	// U+9435(6F44) -> U+9244(4534)
	"轉": "転",	// U+8F49(6D5B) -> U+8EE2(453E)
	"點": "点",	// U+9EDE(735A) -> U+70B9(4540)
	"傳": "伝",	// U+50B3(5123) -> U+4F1D(4541)
	"都": "都",	// U+FA26(7C6A) -> U+90FD(4554)
	"黨": "党",	// U+9EE8(735E) -> U+515A(455E)
	"盜": "盗",	// U+76DC(5D39) -> U+76D7(4570)
	"燈": "灯",	// U+71C8(4575) -> U+706F(4574)
	"當": "当",	// U+7576(6144) -> U+5F53(4576)
	"鬭": "闘",	// U+9B2D(722C) -> U+95D8(462E)
	"德": "徳",	// U+5FB7(7445) -> U+5FB3(4641)
	"獨": "独",	// U+7368(6057) -> U+72EC(4648)
	"讀": "読",	// U+8B80(6C26) -> U+8AAD(4649)
	"突": "突",	// U+FA55(7951) -> U+7A81(464D)
	"屆": "届",	// U+5C46(557C) -> U+5C4A(464F)
	"繩": "縄",	// U+7E69(656A) -> U+7E04(466C)
	"難": "難",	// U+FA68(7D63) -> U+96E3(4671)
	"貳": "弐",	// U+8CB3(6C48) -> U+5F10(4675)
	"惱": "悩",	// U+60F1(583D) -> U+60A9(473A)
	"腦": "脳",	// U+8166(672A) -> U+8133(473E)
	"霸": "覇",	// U+9738(5B31) -> U+8987(4746)
	"廢": "廃",	// U+5EE2(5726) -> U+5EC3(4751)
	"拜": "拝",	// U+62DC(5941) -> U+62DD(4752)
	"梅": "梅",	// U+FA44(7565) -> U+6885(475F)
	"賣": "売",	// U+8CE3(6C4E) -> U+58F2(4764)
	"麥": "麦",	// U+9EA5(734E) -> U+9EA6(477E)
	"發": "発",	// U+767C(6224) -> U+767A(482F)
	"髮": "髪",	// U+9AEE(717B) -> U+9AEA(4831)
	"拔": "抜",	// U+62D4(5936) -> U+629C(4834)
	"繁": "繁",	// U+FA59(7A33) -> U+7E41(484B)
	"晚": "晩",	// U+665A(753C) -> U+6669(4855)
	"蠻": "蛮",	// U+883B(6A47) -> U+86EE(485A)
	"卑": "卑",	// U+FA35(2E6E) -> U+5351(485C)
	"碑": "碑",	// U+FA4B(7927) -> U+7891(486A)
	"祕": "秘",	// U+7955(6330) -> U+79D8(486B)
	"濱": "浜",	// U+6FF1(5F40) -> U+6D5C(494D)
	"賓": "賓",	// U+FA64(7C38) -> U+8CD3(4950)
	"頻": "頻",	// U+FA6A(7D7B) -> U+983B(4951)
	"敏": "敏",	// U+FA41(7528) -> U+654F(4952)
	"甁": "瓶",	// U+7501(7847) -> U+74F6(4953)
	"侮": "侮",	// U+FA30(2E38) -> U+4FAE(496E)
	"福": "福",	// U+FA1B(7941) -> U+798F(4A21)
	"拂": "払",	// U+62C2(5944) -> U+6255(4A27)
	"佛": "仏",	// U+4F5B(5047) -> U+4ECF(4A29)
	"倂": "併",	// U+5002(2E3C) -> U+4F75(4A3B)
	"塀": "塀",	// U+FA39(2F5A) -> U+5840(4A3D)
	"竝": "並",	// U+7ADD(636D) -> U+4E26(4A42)
	"變": "変",	// U+8B8A(5A4E) -> U+5909(4A51)
	"邊": "辺",	// U+908A(6E34) -> U+8FBA(4A55)
	"勉": "勉",	// U+FA33(2E63) -> U+52C9(4A59)
	"辨": "弁",	// U+8FA8(517E) -> U+5F01(4A5B)
	"瓣": "弁",	// U+74E3(6122) -> U+5F01(4A5B)
	"辯": "弁",	// U+8FAF(6D67) -> U+5F01(4A5B)
	"舖": "舗",	// U+8216(6754) -> U+8217(4A5E)
	"步": "歩",	// U+6B65(7643) -> U+6B69(4A62)
	"穗": "穂",	// U+7A57(634F) -> U+7A42(4A66)
	"寶": "宝",	// U+5BF6(556F) -> U+5B9D(4A75)
	"襃": "褒",	// U+8943(6A71) -> U+8912(4B2B)
	"豐": "豊",	// U+8C50(6C34) -> U+8C4A(4B2D)
	"墨": "墨",	// U+FA3A(2F5E) -> U+58A8(4B4F)
	"沒": "没",	// U+6C92(5D73) -> U+6CA1(4B57)
	"飜": "翻",	// U+98DC(664C) -> U+7FFB(4B5D)
	"每": "毎",	// U+6BCF(764A) -> U+6BCE(4B68)
	"萬": "万",	// U+842C(685F) -> U+4E07(4B7C)
	"滿": "満",	// U+6EFF(5E60) -> U+6E80(4B7E)
	"免": "免",	// U+FA32(2E50) -> U+514D(4C48)
	"麵": "麺",	// U+9EB5(7E70) -> U+9EBA(4C4D)
	"默": "黙",	// U+9ED8(6054) -> U+9ED9(4C5B)
	"餠": "餅",	// U+9920(7136) -> U+9905(4C5F)
	"戾": "戻",	// U+623E(7463) -> U+623B(4C61)
	"彌": "弥",	// U+5F4C(573D) -> U+5F25(4C6F)
	"藥": "薬",	// U+85E5(693B) -> U+85AC(4C74)
	"譯": "訳",	// U+8B6F(6C23) -> U+8A33(4C75)
	"豫": "予",	// U+8C6B(502E) -> U+4E88(4D3D)
	"餘": "余",	// U+9918(7131) -> U+4F59(4D3E)
	"與": "与",	// U+8207(6750) -> U+4E0E(4D3F)
	"譽": "誉",	// U+8B7D(6C25) -> U+8A89(4D40)
	"搖": "揺",	// U+6416(596A) -> U+63FA(4D49)
	"樣": "様",	// U+6A23(5C6B) -> U+69D8(4D4D)
	"謠": "謡",	// U+8B20(6B6F) -> U+8B21(4D58)
	"來": "来",	// U+4F86(5054) -> U+6765(4D68)
	"賴": "頼",	// U+8CF4(7C3A) -> U+983C(4D6A)
	"亂": "乱",	// U+4E82(502C) -> U+4E71(4D70)
	"欄": "欄",	// U+F91D(763B) -> U+6B04(4D73)
	"覽": "覧",	// U+89BD(6B35) -> U+89A7(4D77)
	"隆": "隆",	// U+F9DC(7D5D) -> U+9686(4E34)
	"龍": "竜",	// U+9F8D(4E36) -> U+7ADC(4E35)
	"虜": "虜",	// U+F936(7B4F) -> U+865C(4E3A)
	"兩": "両",	// U+5169(5140) -> U+4E21(4E3E)
	"獵": "猟",	// U+7375(605A) -> U+731F(4E44)
	"綠": "緑",	// U+7DA0(7A28) -> U+7DD1(4E50)
	"壘": "塁",	// U+58D8(545E) -> U+5841(4E5D)
	"淚": "涙",	// U+6DDA(7673) -> U+6D99(4E5E)
	"類": "類",	// U+F9D0(7E24) -> U+985E(4E60)
	"勵": "励",	// U+52F5(522F) -> U+52B1(4E65)
	"禮": "礼",	// U+79AE(6339) -> U+793C(4E69)
	"隸": "隷",	// U+96B8(7031) -> U+96B7(4E6C)
	"靈": "霊",	// U+9748(704D) -> U+970A(4E6E)
	"齡": "齢",	// U+9F61(7374) -> U+9F62(4E70)
	"曆": "暦",	// U+66C6(7547) -> U+66A6(4E71)
	"歷": "歴",	// U+6B77(7645) -> U+6B74(4E72)
	"戀": "恋",	// U+6200(5878) -> U+604B(4E78)
	"練": "練",	// U+FA57(7A2E) -> U+7DF4(4E7D)
	"鍊": "錬",	// U+934A(7D3B) -> U+932C(4F23)
	"爐": "炉",	// U+7210(6024) -> U+7089(4F27)
	"勞": "労",	// U+52DE(5229) -> U+52B4(4F2B)
	"廊": "廊",	// U+F928(742E) -> U+5ECA(4F2D)
	"朗": "朗",	// U+F929(754E) -> U+6717(4F2F)
	"樓": "楼",	// U+6A13(5C6C) -> U+697C(4F30)
	"郞": "郎",	// U+90DE(7C67) -> U+90CE(4F3A)
	"錄": "録",	// U+9304(7D35) -> U+9332(4F3F)
	"灣": "湾",	// U+7063(5F54) -> U+6E7E(4F51)

	// 人名用漢字
	"巖": "巌",	// U+5DD6(565E) -> U+5DCC(3460)
	"堯": "尭",	// U+582F(7421) -> U+5C2D(3646)
	"渚": "渚",	// U+FA46(7677) -> U+6E1A(3D6D)
	"穰": "穣",	// U+7A70(6355) -> U+7A63(3E77)
	"晉": "晋",	// U+6649(5A69) -> U+664B(3F38)
	"聰": "聡",	// U+8070(6662) -> U+8061(416F)
	"琢": "琢",	// U+FA4A(7825) -> U+7422(4276)
	"猪": "猪",	// U+FA16(776F) -> U+732A(4376)
	"禎": "禎",	// U+FA53(7940) -> U+798E(4477)
	"槇": "槙",	// U+69C7(7422) -> U+69D9(4B6A)
	"祐": "祐",	// U+FA4F(7938) -> U+7950(4D34)
	"遙": "遥",	// U+9059(7423) -> U+9065(4D5A)
	"祿": "禄",	// U+797F(6333) -> U+7984(4F3D)
	"瑤": "瑶",	// U+7464(7424) -> U+7476(6076)

	// その他
	"凛": "凜",
	"晄": "晃",
	"檜": "桧",
	"禰": "祢",
	"禱": "祷",
	"萠": "萌",
	"薗": "園",
	"駈": "駆",
	"嶋": "島",
	"盃": "杯",
	"冨": "富",
	"峯": "峰",
	"埜": "野",
	"凉": "涼",
};

const kanaSupplement = {
	// Historic Katakana
	"\u{1B000}": "え",	// KATAKANA LETTER ARCHAIC E
	// Historic Hiragana and Hentaigana
	//"\u{1B001}": "",	// HIRAGANA LETTER ARCHAIC YE
	// Hentaigana
	"\u{1B002}": "あ",	// HENTAIGANA LETTER A-1
	"\u{1B003}": "あ",	// HENTAIGANA LETTER A-2
	"\u{1B004}": "あ",	// HENTAIGANA LETTER A-3
	"\u{1B005}": "あ",	// HENTAIGANA LETTER A-WO
	"\u{1B006}": "い",	// HENTAIGANA LETTER I-1
	"\u{1B007}": "い",	// HENTAIGANA LETTER I-2
	"\u{1B008}": "い",	// HENTAIGANA LETTER I-3
	"\u{1B009}": "い",	// HENTAIGANA LETTER I-4
	"\u{1B00A}": "う",	// HENTAIGANA LETTER U-1
	"\u{1B00B}": "う",	// HENTAIGANA LETTER U-2
	"\u{1B00C}": "う",	// HENTAIGANA LETTER U-3
	"\u{1B00D}": "う",	// HENTAIGANA LETTER U-4
	"\u{1B00E}": "う",	// HENTAIGANA LETTER U-5
	"\u{1B00F}": "え",	// HENTAIGANA LETTER E-2
	"\u{1B010}": "え",	// HENTAIGANA LETTER E-3
	"\u{1B011}": "え",	// HENTAIGANA LETTER E-4
	"\u{1B012}": "え",	// HENTAIGANA LETTER E-5
	"\u{1B013}": "え",	// HENTAIGANA LETTER E-6
	"\u{1B014}": "お",	// HENTAIGANA LETTER O-1
	"\u{1B015}": "お",	// HENTAIGANA LETTER O-2
	"\u{1B016}": "お",	// HENTAIGANA LETTER O-3
	"\u{1B017}": "か",	// HENTAIGANA LETTER KA-1
	"\u{1B018}": "か",	// HENTAIGANA LETTER KA-2
	"\u{1B019}": "か",	// HENTAIGANA LETTER KA-3
	"\u{1B01A}": "か",	// HENTAIGANA LETTER KA-4
	"\u{1B01B}": "か",	// HENTAIGANA LETTER KA-5
	"\u{1B01C}": "か",	// HENTAIGANA LETTER KA-6
	"\u{1B01D}": "か",	// HENTAIGANA LETTER KA-7
	"\u{1B01E}": "か",	// HENTAIGANA LETTER KA-8
	"\u{1B01F}": "か",	// HENTAIGANA LETTER KA-9
	"\u{1B020}": "か",	// HENTAIGANA LETTER KA-10
	"\u{1B021}": "か",	// HENTAIGANA LETTER KA-11
	"\u{1B022}": "か",	// HENTAIGANA LETTER KA-KE
	"\u{1B023}": "き",	// HENTAIGANA LETTER KI-1
	"\u{1B024}": "き",	// HENTAIGANA LETTER KI-2
	"\u{1B025}": "き",	// HENTAIGANA LETTER KI-3
	"\u{1B026}": "き",	// HENTAIGANA LETTER KI-4
	"\u{1B027}": "き",	// HENTAIGANA LETTER KI-5
	"\u{1B028}": "き",	// HENTAIGANA LETTER KI-6
	"\u{1B029}": "き",	// HENTAIGANA LETTER KI-7
	"\u{1B02A}": "き",	// HENTAIGANA LETTER KI-8
	"\u{1B02B}": "く",	// HENTAIGANA LETTER KU-1
	"\u{1B02C}": "く",	// HENTAIGANA LETTER KU-2
	"\u{1B02D}": "く",	// HENTAIGANA LETTER KU-3
	"\u{1B02E}": "く",	// HENTAIGANA LETTER KU-4
	"\u{1B02F}": "く",	// HENTAIGANA LETTER KU-5
	"\u{1B030}": "く",	// HENTAIGANA LETTER KU-6
	"\u{1B031}": "く",	// HENTAIGANA LETTER KU-7
	"\u{1B032}": "け",	// HENTAIGANA LETTER KE-1
	"\u{1B033}": "け",	// HENTAIGANA LETTER KE-2
	"\u{1B034}": "け",	// HENTAIGANA LETTER KE-3
	"\u{1B035}": "け",	// HENTAIGANA LETTER KE-4
	"\u{1B036}": "け",	// HENTAIGANA LETTER KE-5
	"\u{1B037}": "け",	// HENTAIGANA LETTER KE-6
	"\u{1B038}": "こ",	// HENTAIGANA LETTER KO-1
	"\u{1B039}": "こ",	// HENTAIGANA LETTER KO-2
	"\u{1B03A}": "こ",	// HENTAIGANA LETTER KO-3
	"\u{1B03B}": "こ",	// HENTAIGANA LETTER KO-KI
	"\u{1B03C}": "さ",	// HENTAIGANA LETTER SA-1
	"\u{1B03D}": "さ",	// HENTAIGANA LETTER SA-2
	"\u{1B03E}": "さ",	// HENTAIGANA LETTER SA-3
	"\u{1B03F}": "さ",	// HENTAIGANA LETTER SA-4
	"\u{1B040}": "さ",	// HENTAIGANA LETTER SA-5
	"\u{1B041}": "さ",	// HENTAIGANA LETTER SA-6
	"\u{1B042}": "さ",	// HENTAIGANA LETTER SA-7
	"\u{1B043}": "さ",	// HENTAIGANA LETTER SA-8
	"\u{1B044}": "し",	// HENTAIGANA LETTER SI-1
	"\u{1B045}": "し",	// HENTAIGANA LETTER SI-2
	"\u{1B046}": "し",	// HENTAIGANA LETTER SI-3
	"\u{1B047}": "し",	// HENTAIGANA LETTER SI-4
	"\u{1B048}": "し",	// HENTAIGANA LETTER SI-5
	"\u{1B049}": "し",	// HENTAIGANA LETTER SI-6
	"\u{1B04A}": "す",	// HENTAIGANA LETTER SU-1
	"\u{1B04B}": "す",	// HENTAIGANA LETTER SU-2
	"\u{1B04C}": "す",	// HENTAIGANA LETTER SU-3
	"\u{1B04D}": "す",	// HENTAIGANA LETTER SU-4
	"\u{1B04E}": "す",	// HENTAIGANA LETTER SU-5
	"\u{1B04F}": "す",	// HENTAIGANA LETTER SU-6
	"\u{1B050}": "す",	// HENTAIGANA LETTER SU-7
	"\u{1B051}": "す",	// HENTAIGANA LETTER SU-8
	"\u{1B052}": "せ",	// HENTAIGANA LETTER SE-1
	"\u{1B053}": "せ",	// HENTAIGANA LETTER SE-2
	"\u{1B054}": "せ",	// HENTAIGANA LETTER SE-3
	"\u{1B055}": "せ",	// HENTAIGANA LETTER SE-4
	"\u{1B056}": "せ",	// HENTAIGANA LETTER SE-5
	"\u{1B057}": "そ",	// HENTAIGANA LETTER SO-1
	"\u{1B058}": "そ",	// HENTAIGANA LETTER SO-2
	"\u{1B059}": "そ",	// HENTAIGANA LETTER SO-3
	"\u{1B05A}": "そ",	// HENTAIGANA LETTER SO-4
	"\u{1B05B}": "そ",	// HENTAIGANA LETTER SO-5
	"\u{1B05C}": "そ",	// HENTAIGANA LETTER SO-6
	"\u{1B05D}": "そ",	// HENTAIGANA LETTER SO-7
	"\u{1B05E}": "た",	// HENTAIGANA LETTER TA-1
	"\u{1B05F}": "た",	// HENTAIGANA LETTER TA-2
	"\u{1B060}": "た",	// HENTAIGANA LETTER TA-3
	"\u{1B061}": "た",	// HENTAIGANA LETTER TA-4
	"\u{1B062}": "ち",	// HENTAIGANA LETTER TI-1
	"\u{1B063}": "ち",	// HENTAIGANA LETTER TI-2
	"\u{1B064}": "ち",	// HENTAIGANA LETTER TI-3
	"\u{1B065}": "ち",	// HENTAIGANA LETTER TI-4
	"\u{1B066}": "ち",	// HENTAIGANA LETTER TI-5
	"\u{1B067}": "ち",	// HENTAIGANA LETTER TI-6
	"\u{1B068}": "ち",	// HENTAIGANA LETTER TI-7
	"\u{1B069}": "つ",	// HENTAIGANA LETTER TU-1
	"\u{1B06A}": "つ",	// HENTAIGANA LETTER TU-2
	"\u{1B06B}": "つ",	// HENTAIGANA LETTER TU-3
	"\u{1B06C}": "つ",	// HENTAIGANA LETTER TU-4
	"\u{1B06D}": "つ",	// HENTAIGANA LETTER TU-TO
	"\u{1B06E}": "て",	// HENTAIGANA LETTER TE-1
	"\u{1B06F}": "て",	// HENTAIGANA LETTER TE-2
	"\u{1B070}": "て",	// HENTAIGANA LETTER TE-3
	"\u{1B071}": "て",	// HENTAIGANA LETTER TE-4
	"\u{1B072}": "て",	// HENTAIGANA LETTER TE-5
	"\u{1B073}": "て",	// HENTAIGANA LETTER TE-6
	"\u{1B074}": "て",	// HENTAIGANA LETTER TE-7
	"\u{1B075}": "て",	// HENTAIGANA LETTER TE-8
	"\u{1B076}": "て",	// HENTAIGANA LETTER TE-9
	"\u{1B077}": "と",	// HENTAIGANA LETTER TO-1
	"\u{1B078}": "と",	// HENTAIGANA LETTER TO-2
	"\u{1B079}": "と",	// HENTAIGANA LETTER TO-3
	"\u{1B07A}": "と",	// HENTAIGANA LETTER TO-4
	"\u{1B07B}": "と",	// HENTAIGANA LETTER TO-5
	"\u{1B07C}": "と",	// HENTAIGANA LETTER TO-6
	"\u{1B07D}": "と",	// HENTAIGANA LETTER TO-RA
	"\u{1B07E}": "な",	// HENTAIGANA LETTER NA-1
	"\u{1B07F}": "な",	// HENTAIGANA LETTER NA-2
	"\u{1B080}": "な",	// HENTAIGANA LETTER NA-3
	"\u{1B081}": "な",	// HENTAIGANA LETTER NA-4
	"\u{1B082}": "な",	// HENTAIGANA LETTER NA-5
	"\u{1B083}": "な",	// HENTAIGANA LETTER NA-6
	"\u{1B084}": "な",	// HENTAIGANA LETTER NA-7
	"\u{1B085}": "な",	// HENTAIGANA LETTER NA-8
	"\u{1B086}": "な",	// HENTAIGANA LETTER NA-9
	"\u{1B087}": "に",	// HENTAIGANA LETTER NI-1
	"\u{1B088}": "に",	// HENTAIGANA LETTER NI-2
	"\u{1B089}": "に",	// HENTAIGANA LETTER NI-3
	"\u{1B08A}": "に",	// HENTAIGANA LETTER NI-4
	"\u{1B08B}": "に",	// HENTAIGANA LETTER NI-5
	"\u{1B08C}": "に",	// HENTAIGANA LETTER NI-6
	"\u{1B08D}": "に",	// HENTAIGANA LETTER NI-7
	"\u{1B08E}": "に",	// HENTAIGANA LETTER NI-TE
	"\u{1B08F}": "ぬ",	// HENTAIGANA LETTER NU-1
	"\u{1B090}": "ぬ",	// HENTAIGANA LETTER NU-2
	"\u{1B091}": "ぬ",	// HENTAIGANA LETTER NU-3
	"\u{1B092}": "ね",	// HENTAIGANA LETTER NE-1
	"\u{1B093}": "ね",	// HENTAIGANA LETTER NE-2
	"\u{1B094}": "ね",	// HENTAIGANA LETTER NE-3
	"\u{1B095}": "ね",	// HENTAIGANA LETTER NE-4
	"\u{1B096}": "ね",	// HENTAIGANA LETTER NE-5
	"\u{1B097}": "ね",	// HENTAIGANA LETTER NE-6
	"\u{1B098}": "ね",	// HENTAIGANA LETTER NE-KO
	"\u{1B099}": "の",	// HENTAIGANA LETTER NO-1
	"\u{1B09A}": "の",	// HENTAIGANA LETTER NO-2
	"\u{1B09B}": "の",	// HENTAIGANA LETTER NO-3
	"\u{1B09C}": "の",	// HENTAIGANA LETTER NO-4
	"\u{1B09D}": "の",	// HENTAIGANA LETTER NO-5
	"\u{1B09E}": "は",	// HENTAIGANA LETTER HA-1
	"\u{1B09F}": "は",	// HENTAIGANA LETTER HA-2
	"\u{1B0A0}": "は",	// HENTAIGANA LETTER HA-3
	"\u{1B0A1}": "は",	// HENTAIGANA LETTER HA-4
	"\u{1B0A2}": "は",	// HENTAIGANA LETTER HA-5
	"\u{1B0A3}": "は",	// HENTAIGANA LETTER HA-6
	"\u{1B0A4}": "は",	// HENTAIGANA LETTER HA-7
	"\u{1B0A5}": "は",	// HENTAIGANA LETTER HA-8
	"\u{1B0A6}": "は",	// HENTAIGANA LETTER HA-9
	"\u{1B0A7}": "は",	// HENTAIGANA LETTER HA-10
	"\u{1B0A8}": "は",	// HENTAIGANA LETTER HA-11
	"\u{1B0A9}": "ひ",	// HENTAIGANA LETTER HI-1
	"\u{1B0AA}": "ひ",	// HENTAIGANA LETTER HI-2
	"\u{1B0AB}": "ひ",	// HENTAIGANA LETTER HI-3
	"\u{1B0AC}": "ひ",	// HENTAIGANA LETTER HI-4
	"\u{1B0AD}": "ひ",	// HENTAIGANA LETTER HI-5
	"\u{1B0AE}": "ひ",	// HENTAIGANA LETTER HI-6
	"\u{1B0AF}": "ひ",	// HENTAIGANA LETTER HI-7
	"\u{1B0B0}": "ふ",	// HENTAIGANA LETTER HU-1
	"\u{1B0B1}": "ふ",	// HENTAIGANA LETTER HU-2
	"\u{1B0B2}": "ふ",	// HENTAIGANA LETTER HU-3
	"\u{1B0B3}": "へ",	// HENTAIGANA LETTER HE-1
	"\u{1B0B4}": "へ",	// HENTAIGANA LETTER HE-2
	"\u{1B0B5}": "へ",	// HENTAIGANA LETTER HE-3
	"\u{1B0B6}": "へ",	// HENTAIGANA LETTER HE-4
	"\u{1B0B7}": "へ",	// HENTAIGANA LETTER HE-5
	"\u{1B0B8}": "へ",	// HENTAIGANA LETTER HE-6
	"\u{1B0B9}": "へ",	// HENTAIGANA LETTER HE-7
	"\u{1B0BA}": "ほ",	// HENTAIGANA LETTER HO-1
	"\u{1B0BB}": "ほ",	// HENTAIGANA LETTER HO-2
	"\u{1B0BC}": "ほ",	// HENTAIGANA LETTER HO-3
	"\u{1B0BD}": "ほ",	// HENTAIGANA LETTER HO-4
	"\u{1B0BE}": "ほ",	// HENTAIGANA LETTER HO-5
	"\u{1B0BF}": "ほ",	// HENTAIGANA LETTER HO-6
	"\u{1B0C0}": "ほ",	// HENTAIGANA LETTER HO-7
	"\u{1B0C1}": "ほ",	// HENTAIGANA LETTER HO-8
	"\u{1B0C2}": "ま",	// HENTAIGANA LETTER MA-1
	"\u{1B0C3}": "ま",	// HENTAIGANA LETTER MA-2
	"\u{1B0C4}": "ま",	// HENTAIGANA LETTER MA-3
	"\u{1B0C5}": "ま",	// HENTAIGANA LETTER MA-4
	"\u{1B0C6}": "ま",	// HENTAIGANA LETTER MA-5
	"\u{1B0C7}": "ま",	// HENTAIGANA LETTER MA-6
	"\u{1B0C8}": "ま",	// HENTAIGANA LETTER MA-7
	"\u{1B0C9}": "み",	// HENTAIGANA LETTER MI-1
	"\u{1B0CA}": "み",	// HENTAIGANA LETTER MI-2
	"\u{1B0CB}": "み",	// HENTAIGANA LETTER MI-3
	"\u{1B0CC}": "み",	// HENTAIGANA LETTER MI-4
	"\u{1B0CD}": "み",	// HENTAIGANA LETTER MI-5
	"\u{1B0CE}": "み",	// HENTAIGANA LETTER MI-6
	"\u{1B0CF}": "み",	// HENTAIGANA LETTER MI-7
	"\u{1B0D0}": "む",	// HENTAIGANA LETTER MU-1
	"\u{1B0D1}": "む",	// HENTAIGANA LETTER MU-2
	"\u{1B0D2}": "む",	// HENTAIGANA LETTER MU-3
	"\u{1B0D3}": "む",	// HENTAIGANA LETTER MU-4
	"\u{1B0D4}": "め",	// HENTAIGANA LETTER ME-1
	"\u{1B0D5}": "め",	// HENTAIGANA LETTER ME-2
	"\u{1B0D6}": "め",	// HENTAIGANA LETTER ME-MA
	"\u{1B0D7}": "も",	// HENTAIGANA LETTER MO-1
	"\u{1B0D8}": "も",	// HENTAIGANA LETTER MO-2
	"\u{1B0D9}": "も",	// HENTAIGANA LETTER MO-3
	"\u{1B0DA}": "も",	// HENTAIGANA LETTER MO-4
	"\u{1B0DB}": "も",	// HENTAIGANA LETTER MO-5
	"\u{1B0DC}": "も",	// HENTAIGANA LETTER MO-6
	"\u{1B0DD}": "や",	// HENTAIGANA LETTER YA-1
	"\u{1B0DE}": "や",	// HENTAIGANA LETTER YA-2
	"\u{1B0DF}": "や",	// HENTAIGANA LETTER YA-3
	"\u{1B0E0}": "や",	// HENTAIGANA LETTER YA-4
	"\u{1B0E1}": "や",	// HENTAIGANA LETTER YA-5
	"\u{1B0E2}": "や",	// HENTAIGANA LETTER YA-YO
	"\u{1B0E3}": "ゆ",	// HENTAIGANA LETTER YU-1
	"\u{1B0E4}": "ゆ",	// HENTAIGANA LETTER YU-2
	"\u{1B0E5}": "ゆ",	// HENTAIGANA LETTER YU-3
	"\u{1B0E6}": "ゆ",	// HENTAIGANA LETTER YU-4
	"\u{1B0E7}": "よ",	// HENTAIGANA LETTER YO-1
	"\u{1B0E8}": "よ",	// HENTAIGANA LETTER YO-2
	"\u{1B0E9}": "よ",	// HENTAIGANA LETTER YO-3
	"\u{1B0EA}": "よ",	// HENTAIGANA LETTER YO-4
	"\u{1B0EB}": "よ",	// HENTAIGANA LETTER YO-5
	"\u{1B0EC}": "よ",	// HENTAIGANA LETTER YO-6
	"\u{1B0ED}": "ら",	// HENTAIGANA LETTER RA-1
	"\u{1B0EE}": "ら",	// HENTAIGANA LETTER RA-2
	"\u{1B0EF}": "ら",	// HENTAIGANA LETTER RA-3
	"\u{1B0F0}": "ら",	// HENTAIGANA LETTER RA-4
	"\u{1B0F1}": "り",	// HENTAIGANA LETTER RI-1
	"\u{1B0F2}": "り",	// HENTAIGANA LETTER RI-2
	"\u{1B0F3}": "り",	// HENTAIGANA LETTER RI-3
	"\u{1B0F4}": "り",	// HENTAIGANA LETTER RI-4
	"\u{1B0F5}": "り",	// HENTAIGANA LETTER RI-5
	"\u{1B0F6}": "り",	// HENTAIGANA LETTER RI-6
	"\u{1B0F7}": "り",	// HENTAIGANA LETTER RI-7
	"\u{1B0F8}": "る",	// HENTAIGANA LETTER RU-1
	"\u{1B0F9}": "る",	// HENTAIGANA LETTER RU-2
	"\u{1B0FA}": "る",	// HENTAIGANA LETTER RU-3
	"\u{1B0FB}": "る",	// HENTAIGANA LETTER RU-4
	"\u{1B0FC}": "る",	// HENTAIGANA LETTER RU-5
	"\u{1B0FD}": "る",	// HENTAIGANA LETTER RU-6
	"\u{1B0FE}": "れ",	// HENTAIGANA LETTER RE-1
	"\u{1B0FF}": "れ",	// HENTAIGANA LETTER RE-2

	"\u{1B100}": "れ",	// HENTAIGANA LETTER RE-3
	"\u{1B101}": "れ",	// HENTAIGANA LETTER RE-4
	"\u{1B102}": "ろ",	// HENTAIGANA LETTER RO-1
	"\u{1B103}": "ろ",	// HENTAIGANA LETTER RO-2
	"\u{1B104}": "ろ",	// HENTAIGANA LETTER RO-3
	"\u{1B105}": "ろ",	// HENTAIGANA LETTER RO-4
	"\u{1B106}": "ろ",	// HENTAIGANA LETTER RO-5
	"\u{1B107}": "ろ",	// HENTAIGANA LETTER RO-6
	"\u{1B108}": "わ",	// HENTAIGANA LETTER WA-1
	"\u{1B109}": "わ",	// HENTAIGANA LETTER WA-2
	"\u{1B10A}": "わ",	// HENTAIGANA LETTER WA-3
	"\u{1B10B}": "わ",	// HENTAIGANA LETTER WA-4
	"\u{1B10C}": "わ",	// HENTAIGANA LETTER WA-5
	"\u{1B10D}": "ゐ",	// HENTAIGANA LETTER WI-1
	"\u{1B10E}": "ゐ",	// HENTAIGANA LETTER WI-2
	"\u{1B10F}": "ゐ",	// HENTAIGANA LETTER WI-3
	"\u{1B110}": "ゐ",	// HENTAIGANA LETTER WI-4
	"\u{1B111}": "ゐ",	// HENTAIGANA LETTER WI-5
	"\u{1B112}": "ゑ",	// HENTAIGANA LETTER WE-1
	"\u{1B113}": "ゑ",	// HENTAIGANA LETTER WE-2
	"\u{1B114}": "ゑ",	// HENTAIGANA LETTER WE-3
	"\u{1B115}": "ゑ",	// HENTAIGANA LETTER WE-4
	"\u{1B116}": "を",	// HENTAIGANA LETTER WO-1
	"\u{1B117}": "を",	// HENTAIGANA LETTER WO-2
	"\u{1B118}": "を",	// HENTAIGANA LETTER WO-3
	"\u{1B119}": "を",	// HENTAIGANA LETTER WO-4
	"\u{1B11A}": "を",	// HENTAIGANA LETTER WO-5
	"\u{1B11B}": "を",	// HENTAIGANA LETTER WO-6
	"\u{1B11C}": "を",	// HENTAIGANA LETTER WO-7
	"\u{1B11D}": "ん",	// HENTAIGANA LETTER N-MU-MO-1
	"\u{1B11E}": "ん",	// HENTAIGANA LETTER N-MU-MO-2
	//Historic Hiragana
	//"\u{1B11F}": "",	// HIRAGANA LETTER ARCHAIC WU
	//Historic Katakana
	//"\u{1B120}": "",	// KATAKANA LETTER ARCHAIC YI
	//"\u{1B121}": "",	// KATAKANA LETTER ARCHAIC YE
	//"\u{1B122}": "",	// KATAKANA LETTER ARCHAIC WU
};

const enclosedAlphanumeric = {
	"\u2776": "1",	// DINGBAT NEGATIVE CIRCLED DIGIT ONE
	"\u2777": "2",	// DINGBAT NEGATIVE CIRCLED DIGIT TWO
	"\u2778": "3",	// DINGBAT NEGATIVE CIRCLED DIGIT THREE
	"\u2779": "4",	// DINGBAT NEGATIVE CIRCLED DIGIT FOUR
	"\u277A": "5",	// DINGBAT NEGATIVE CIRCLED DIGIT FIVE
	"\u277B": "6",	// DINGBAT NEGATIVE CIRCLED DIGIT SIX
	"\u277C": "7",	// DINGBAT NEGATIVE CIRCLED DIGIT SEVEN
	"\u277D": "8",	// DINGBAT NEGATIVE CIRCLED DIGIT EIGHT
	"\u277E": "9",	// DINGBAT NEGATIVE CIRCLED DIGIT NINE
	"\u277F": "10",	// DINGBAT NEGATIVE CIRCLED NUMBER TEN
	"\u2780": "1",	// DINGBAT CIRCLED SANS-SERIF DIGIT ONE
	"\u2781": "2",	// DINGBAT CIRCLED SANS-SERIF DIGIT TWO
	"\u2782": "3",	// DINGBAT CIRCLED SANS-SERIF DIGIT THREE
	"\u2783": "4",	// DINGBAT CIRCLED SANS-SERIF DIGIT FOUR
	"\u2784": "5",	// DINGBAT CIRCLED SANS-SERIF DIGIT FIVE
	"\u2785": "6",	// DINGBAT CIRCLED SANS-SERIF DIGIT SIX
	"\u2786": "7",	// DINGBAT CIRCLED SANS-SERIF DIGIT SEVEN
	"\u2787": "8",	// DINGBAT CIRCLED SANS-SERIF DIGIT EIGHT
	"\u2788": "9",	// DINGBAT CIRCLED SANS-SERIF DIGIT NINE
	"\u2789": "10",	// DINGBAT CIRCLED SANS-SERIF NUMBER TEN
	"\u278A": "1",	// DINGBAT NEGATIVE CIRCLED SANS-SERIF DIGIT ONE
	"\u278B": "2",	// DINGBAT NEGATIVE CIRCLED SANS-SERIF DIGIT TWO
	"\u278C": "3",	// DINGBAT NEGATIVE CIRCLED SANS-SERIF DIGIT THREE
	"\u278D": "4",	// DINGBAT NEGATIVE CIRCLED SANS-SERIF DIGIT FOUR
	"\u278E": "5",	// DINGBAT NEGATIVE CIRCLED SANS-SERIF DIGIT FIVE
	"\u278F": "6",	// DINGBAT NEGATIVE CIRCLED SANS-SERIF DIGIT SIX
	"\u2790": "7",	// DINGBAT NEGATIVE CIRCLED SANS-SERIF DIGIT SEVEN
	"\u2791": "8",	// DINGBAT NEGATIVE CIRCLED SANS-SERIF DIGIT EIGHT
	"\u2792": "9",	// DINGBAT NEGATIVE CIRCLED SANS-SERIF DIGIT NINE
	"\u2793": "10",	// DINGBAT NEGATIVE CIRCLED SANS-SERIF NUMBER TEN
	"\u24EB": "11",	// NEGATIVE CIRCLED NUMBER ELEVEN
	"\u24EC": "12",	// NEGATIVE CIRCLED NUMBER TWELVE
	"\u24ED": "13",	// NEGATIVE CIRCLED NUMBER THIRTEEN
	"\u24EE": "14",	// NEGATIVE CIRCLED NUMBER FOURTEEN
	"\u24EF": "15",	// NEGATIVE CIRCLED NUMBER FIFTEEN
	"\u24F0": "16",	// NEGATIVE CIRCLED NUMBER SIXTEEN
	"\u24F1": "17",	// NEGATIVE CIRCLED NUMBER SEVENTEEN
	"\u24F2": "18",	// NEGATIVE CIRCLED NUMBER EIGHTEEN
	"\u24F3": "19",	// NEGATIVE CIRCLED NUMBER NINETEEN
	"\u24F4": "20",	// NEGATIVE CIRCLED NUMBER TWENTY
	"\u24F5": "1",	// DOUBLE CIRCLED DIGIT ONE
	"\u24F6": "2",	// DOUBLE CIRCLED DIGIT TWO
	"\u24F7": "3",	// DOUBLE CIRCLED DIGIT THREE
	"\u24F8": "4",	// DOUBLE CIRCLED DIGIT FOUR
	"\u24F9": "5",	// DOUBLE CIRCLED DIGIT FIVE
	"\u24FA": "6",	// DOUBLE CIRCLED DIGIT SIX
	"\u24FB": "7",	// DOUBLE CIRCLED DIGIT SEVEN
	"\u24FC": "8",	// DOUBLE CIRCLED DIGIT EIGHT
	"\u24FD": "9",	// DOUBLE CIRCLED DIGIT NINE
	"\u24FE": "10",	// DOUBLE CIRCLED NUMBER TEN
	"\u24FF": "0",	// NEGATIVE CIRCLED DIGIT ZERO
};

const enclosedAlphanumericSupplement = {
	// Number with full stop
	"\u{1F100}": "0.",	// DIGIT ZERO FULL STOP
	// Numbers with comma
	"\u{1F101}": "0,",	// DIGIT ZERO COMMA
	"\u{1F102}": "1,",	// DIGIT ONE COMMA
	"\u{1F103}": "2,",	// DIGIT TWO COMMA
	"\u{1F104}": "3,",	// DIGIT THREE COMMA
	"\u{1F105}": "4,",	// DIGIT FOUR COMMA
	"\u{1F106}": "5,",	// DIGIT FIVE COMMA
	"\u{1F107}": "6,",	// DIGIT SIX COMMA
	"\u{1F108}": "7,",	// DIGIT SEVEN COMMA
	"\u{1F109}": "8,",	// DIGIT EIGHT COMMA
	"\u{1F10A}": "9,",	// DIGIT NINE COMMA
	// Circled sans-serif digits
	"\u{1F10B}": "0",	// DINGBAT CIRCLED SANS-SERIF DIGIT ZERO
	"\u{1F10C}": "0",	// DINGBAT NEGATIVE CIRCLED SANS-SERIF DIGIT ZERO
	// Parenthesized Latin letters
	"\u{1F110}": "(A)",	// PARENTHESIZED LATIN CAPITAL LETTER A
	"\u{1F111}": "(B)",	// PARENTHESIZED LATIN CAPITAL LETTER B
	"\u{1F112}": "(C)",	// PARENTHESIZED LATIN CAPITAL LETTER C
	"\u{1F113}": "(D)",	// PARENTHESIZED LATIN CAPITAL LETTER D
	"\u{1F114}": "(E)",	// PARENTHESIZED LATIN CAPITAL LETTER E
	"\u{1F115}": "(F)",	// PARENTHESIZED LATIN CAPITAL LETTER F
	"\u{1F116}": "(G)",	// PARENTHESIZED LATIN CAPITAL LETTER G
	"\u{1F117}": "(H)",	// PARENTHESIZED LATIN CAPITAL LETTER H
	"\u{1F118}": "(I)",	// PARENTHESIZED LATIN CAPITAL LETTER I
	"\u{1F119}": "(J)",	// PARENTHESIZED LATIN CAPITAL LETTER J
	"\u{1F11A}": "(K)",	// PARENTHESIZED LATIN CAPITAL LETTER K
	"\u{1F11B}": "(L)",	// PARENTHESIZED LATIN CAPITAL LETTER L
	"\u{1F11C}": "(M)",	// PARENTHESIZED LATIN CAPITAL LETTER M
	"\u{1F11D}": "(N)",	// PARENTHESIZED LATIN CAPITAL LETTER N
	"\u{1F11E}": "(O)",	// PARENTHESIZED LATIN CAPITAL LETTER O
	"\u{1F11F}": "(P)",	// PARENTHESIZED LATIN CAPITAL LETTER P
	"\u{1F120}": "(Q)",	// PARENTHESIZED LATIN CAPITAL LETTER Q
	"\u{1F121}": "(R)",	// PARENTHESIZED LATIN CAPITAL LETTER R
	"\u{1F122}": "(S)",	// PARENTHESIZED LATIN CAPITAL LETTER S
	"\u{1F123}": "(T)",	// PARENTHESIZED LATIN CAPITAL LETTER T
	"\u{1F124}": "(U)",	// PARENTHESIZED LATIN CAPITAL LETTER U
	"\u{1F125}": "(V)",	// PARENTHESIZED LATIN CAPITAL LETTER V
	"\u{1F126}": "(W)",	// PARENTHESIZED LATIN CAPITAL LETTER W
	"\u{1F127}": "(X)",	// PARENTHESIZED LATIN CAPITAL LETTER X
	"\u{1F128}": "(Y)",	// PARENTHESIZED LATIN CAPITAL LETTER Y
	"\u{1F129}": "(Z)",	// PARENTHESIZED LATIN CAPITAL LETTER Z
	// Latin letter with tortoise shell brackets
	"\u{1F12A}": "〔S〕",	// TORTOISE SHELL BRACKETED LATIN CAPITAL LETTER S
	// Circled italic Latin letters
	"\u{1F12B}": "C",	// CIRCLED ITALIC LATIN CAPITAL LETTER C
	"\u{1F12C}": "R",	// CIRCLED ITALIC LATIN CAPITAL LETTER R
	// Circled Latin letters or letter sequences
	"\u{1F12D}": "CD",	// CIRCLED CD
	"\u{1F12E}": "WZ",	// CIRCLED WZ
	// Squared Latin letters
	"\u{1F130}": "A",	// SQUARED LATIN CAPITAL LETTER A
	"\u{1F131}": "B",	// SQUARED LATIN CAPITAL LETTER B
	"\u{1F132}": "C",	// SQUARED LATIN CAPITAL LETTER C
	"\u{1F133}": "D",	// SQUARED LATIN CAPITAL LETTER D
	"\u{1F134}": "E",	// SQUARED LATIN CAPITAL LETTER E
	"\u{1F135}": "F",	// SQUARED LATIN CAPITAL LETTER F
	"\u{1F136}": "G",	// SQUARED LATIN CAPITAL LETTER G
	"\u{1F137}": "H",	// SQUARED LATIN CAPITAL LETTER H
	"\u{1F138}": "I",	// SQUARED LATIN CAPITAL LETTER I
	"\u{1F139}": "J",	// SQUARED LATIN CAPITAL LETTER J
	"\u{1F13A}": "K",	// SQUARED LATIN CAPITAL LETTER K
	"\u{1F13B}": "L",	// SQUARED LATIN CAPITAL LETTER L
	"\u{1F13C}": "M",	// SQUARED LATIN CAPITAL LETTER M
	"\u{1F13D}": "N",	// SQUARED LATIN CAPITAL LETTER N
	"\u{1F13E}": "O",	// SQUARED LATIN CAPITAL LETTER O
	"\u{1F13F}": "P",	// SQUARED LATIN CAPITAL LETTER P
	"\u{1F140}": "Q",	// SQUARED LATIN CAPITAL LETTER Q
	"\u{1F141}": "R",	// SQUARED LATIN CAPITAL LETTER R
	"\u{1F142}": "S",	// SQUARED LATIN CAPITAL LETTER S
	"\u{1F143}": "T",	// SQUARED LATIN CAPITAL LETTER T
	"\u{1F144}": "U",	// SQUARED LATIN CAPITAL LETTER U
	"\u{1F145}": "V",	// SQUARED LATIN CAPITAL LETTER V
	"\u{1F146}": "W",	// SQUARED LATIN CAPITAL LETTER W
	"\u{1F147}": "X",	// SQUARED LATIN CAPITAL LETTER X
	"\u{1F148}": "Y",	// SQUARED LATIN CAPITAL LETTER Y
	"\u{1F149}": "Z",	// SQUARED LATIN CAPITAL LETTER Z
	"\u{1F14A}": "HV",	// SQUARED HV
	"\u{1F14B}": "MV",	// SQUARED MV
	"\u{1F14C}": "SD",	// SQUARED SD
	"\u{1F14D}": "SS",	// SQUARED SS
	"\u{1F14E}": "PPV",	// SQUARED PPV
	"\u{1F14F}": "WC",	// SQUARED WC
	// White on black circled Latin letters
	"\u{1F150}": "A",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER A
	"\u{1F151}": "B",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER B
	"\u{1F152}": "C",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER C
	"\u{1F153}": "D",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER D
	"\u{1F154}": "E",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER E
	"\u{1F155}": "F",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER F
	"\u{1F156}": "G",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER G
	"\u{1F157}": "H",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER H
	"\u{1F158}": "I",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER I
	"\u{1F159}": "J",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER J
	"\u{1F15A}": "K",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER K
	"\u{1F15B}": "L",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER L
	"\u{1F15C}": "M",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER M
	"\u{1F15D}": "N",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER N
	"\u{1F15E}": "O",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER O
	"\u{1F15F}": "P",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER P
	"\u{1F160}": "Q",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER Q
	"\u{1F161}": "R",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER R
	"\u{1F162}": "S",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER S
	"\u{1F163}": "T",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER T
	"\u{1F164}": "U",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER U
	"\u{1F165}": "V",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER V
	"\u{1F166}": "W",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER W
	"\u{1F167}": "X",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER X
	"\u{1F168}": "Y",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER Y
	"\u{1F169}": "Z",	// NEGATIVE CIRCLED LATIN CAPITAL LETTER Z
	// Raised squared Latin sequences
	"\u{1F16A}": "MC",	// RAISED MC SIGN
	"\u{1F16B}": "MD",	// RAISED MD SIGN
	"\u{1F16C}": "MR",	// RAISED MR SIGN
	// White on black squared Latin letters
	"\u{1F170}": "A",	// NEGATIVE SQUARED LATIN CAPITAL LETTER A
	"\u{1F171}": "B",	// NEGATIVE SQUARED LATIN CAPITAL LETTER B
	"\u{1F172}": "C",	// NEGATIVE SQUARED LATIN CAPITAL LETTER C
	"\u{1F173}": "D",	// NEGATIVE SQUARED LATIN CAPITAL LETTER D
	"\u{1F174}": "E",	// NEGATIVE SQUARED LATIN CAPITAL LETTER E
	"\u{1F175}": "F",	// NEGATIVE SQUARED LATIN CAPITAL LETTER F
	"\u{1F176}": "G",	// NEGATIVE SQUARED LATIN CAPITAL LETTER G
	"\u{1F177}": "H",	// NEGATIVE SQUARED LATIN CAPITAL LETTER H
	"\u{1F178}": "I",	// NEGATIVE SQUARED LATIN CAPITAL LETTER I
	"\u{1F179}": "J",	// NEGATIVE SQUARED LATIN CAPITAL LETTER J
	"\u{1F17A}": "K",	// NEGATIVE SQUARED LATIN CAPITAL LETTER K
	"\u{1F17B}": "L",	// NEGATIVE SQUARED LATIN CAPITAL LETTER L
	"\u{1F17C}": "M",	// NEGATIVE SQUARED LATIN CAPITAL LETTER M
	"\u{1F17D}": "N",	// NEGATIVE SQUARED LATIN CAPITAL LETTER N
	"\u{1F17E}": "O",	// NEGATIVE SQUARED LATIN CAPITAL LETTER O
	"\u{1F17F}": "P",	// NEGATIVE SQUARED LATIN CAPITAL LETTER P
	"\u{1F180}": "Q",	// NEGATIVE SQUARED LATIN CAPITAL LETTER Q
	"\u{1F181}": "R",	// NEGATIVE SQUARED LATIN CAPITAL LETTER R
	"\u{1F182}": "S",	// NEGATIVE SQUARED LATIN CAPITAL LETTER S
	"\u{1F183}": "T",	// NEGATIVE SQUARED LATIN CAPITAL LETTER T
	"\u{1F184}": "U",	// NEGATIVE SQUARED LATIN CAPITAL LETTER U
	"\u{1F185}": "V",	// NEGATIVE SQUARED LATIN CAPITAL LETTER V
	"\u{1F186}": "W",	// NEGATIVE SQUARED LATIN CAPITAL LETTER W
	"\u{1F187}": "X",	// NEGATIVE SQUARED LATIN CAPITAL LETTER X
	"\u{1F188}": "Y",	// NEGATIVE SQUARED LATIN CAPITAL LETTER Y
	"\u{1F189}": "Z",	// NEGATIVE SQUARED LATIN CAPITAL LETTER Z
	"\u{1F18A}": "P",	// CROSSED NEGATIVE SQUARED LATIN CAPITAL LETTER P
	"\u{1F18B}": "IC",	// NEGATIVE SQUARED IC
	"\u{1F18C}": "PA",	// NEGATIVE SQUARED PA
	"\u{1F18D}": "SA",	// NEGATIVE SQUARED SA
	"\u{1F18E}": "AB",	// NEGATIVE SQUARED AB
	"\u{1F18F}": "WC",	// NEGATIVE SQUARED WC
	// Squared Latin letter sequences
	"\u{1F190}": "DJ",		// SQUARE DJ
	"\u{1F191}": "CL",		// SQUARED CL
	"\u{1F192}": "COOL",	// SQUARED COOL
	"\u{1F193}": "FREE",	// SQUARED FREE
	"\u{1F194}": "ID",		// SQUARED ID
	"\u{1F195}": "NEW",		// SQUARED NEW
	"\u{1F196}": "NG",		// SQUARED NG
	"\u{1F197}": "OK",		// SQUARED OK
	"\u{1F198}": "SOS",		// SQUARED SOS
	"\u{1F199}": "UP!",		// SQUARED UP WITH EXCLAMATION MARK
	"\u{1F19A}": "VS",		// SQUARED VS
	// Squared Latin letter sequences from ARIB STD B62
	"\u{1F19B}": "3D",		// SQUARED THREE D
	"\u{1F19C}": "2NDSCR",	// SQUARED SECOND SCREEN
	"\u{1F19D}": "2K",		// SQUARED TWO K
	"\u{1F19E}": "4K",		// SQUARED FOUR K
	"\u{1F19F}": "8K",		// SQUARED EIGHT K
	"\u{1F1A0}": "5.1",		// SQUARED FIVE POINT ONE
	"\u{1F1A1}": "7.1",		// SQUARED SEVEN POINT ONE
	"\u{1F1A2}": "22.2",	// SQUARED TWENTY-TWO POINT TWO
	"\u{1F1A3}": "60P",		// SQUARED SIXTY P
	"\u{1F1A4}": "120P",	// SQUARED ONE HUNDRED TWENTY P
	"\u{1F1A5}": "d",		// SQUARED LATIN SMALL LETTER D
	"\u{1F1A6}": "HC",		// SQUARED HC
	"\u{1F1A7}": "HDR",		// SQUARED HDR
	"\u{1F1A8}": "HI_RES",	// SQUARED HI-RES
	"\u{1F1A9}": "LOSSLESS",// SQUARED LOSSLESS
	"\u{1F1AA}": "SHV",		// SQUARED SHV
	"\u{1F1AB}": "UHD",		// SQUARED UHD
	"\u{1F1AC}": "VOD",		// SQUARED VOD
	// Miscellaneous symbol
	"\u{1F1AD}": "M",		// MASK WORK SYMBOL
	// Regional indicator symbols
	// note: unifying the Regional Indicator into the latin-1 alphabet
	// would improve searchability, but a phantom country code may be
	// generated due to the loss of delimiters (ex. CAZW includes AZ).
	// so, we treat the RI as it is.
	/*
	"\u{1F1E6}": "A",	// REGIONAL INDICATOR SYMBOL LETTER A
	"\u{1F1E7}": "B",	// REGIONAL INDICATOR SYMBOL LETTER B
	"\u{1F1E8}": "C",	// REGIONAL INDICATOR SYMBOL LETTER C
	"\u{1F1E9}": "D",	// REGIONAL INDICATOR SYMBOL LETTER D
	"\u{1F1EA}": "E",	// REGIONAL INDICATOR SYMBOL LETTER E
	"\u{1F1EB}": "F",	// REGIONAL INDICATOR SYMBOL LETTER F
	"\u{1F1EC}": "G",	// REGIONAL INDICATOR SYMBOL LETTER G
	"\u{1F1ED}": "H",	// REGIONAL INDICATOR SYMBOL LETTER H
	"\u{1F1EE}": "I",	// REGIONAL INDICATOR SYMBOL LETTER I
	"\u{1F1EF}": "J",	// REGIONAL INDICATOR SYMBOL LETTER J
	"\u{1F1F0}": "K",	// REGIONAL INDICATOR SYMBOL LETTER K
	"\u{1F1F1}": "L",	// REGIONAL INDICATOR SYMBOL LETTER L
	"\u{1F1F2}": "M",	// REGIONAL INDICATOR SYMBOL LETTER M
	"\u{1F1F3}": "N",	// REGIONAL INDICATOR SYMBOL LETTER N
	"\u{1F1F4}": "O",	// REGIONAL INDICATOR SYMBOL LETTER O
	"\u{1F1F5}": "P",	// REGIONAL INDICATOR SYMBOL LETTER P
	"\u{1F1F6}": "Q",	// REGIONAL INDICATOR SYMBOL LETTER Q
	"\u{1F1F7}": "R",	// REGIONAL INDICATOR SYMBOL LETTER R
	"\u{1F1F8}": "S",	// REGIONAL INDICATOR SYMBOL LETTER S
	"\u{1F1F9}": "T",	// REGIONAL INDICATOR SYMBOL LETTER T
	"\u{1F1FA}": "U",	// REGIONAL INDICATOR SYMBOL LETTER U
	"\u{1F1FB}": "V",	// REGIONAL INDICATOR SYMBOL LETTER V
	"\u{1F1FC}": "W",	// REGIONAL INDICATOR SYMBOL LETTER W
	"\u{1F1FD}": "X",	// REGIONAL INDICATOR SYMBOL LETTER X
	"\u{1F1FE}": "Y",	// REGIONAL INDICATOR SYMBOL LETTER Y
	"\u{1F1FF}": "Z",	// REGIONAL INDICATOR SYMBOL LETTER Z
	*/
};

try {
	await makeDecompositionMap();
	await makeSourceCode();
}
catch (err) {
	if (args.verbose) {
		console.error(err.stack);
	}
	else {
		console.error(err.message);
	}
	process.exit(1);
}
