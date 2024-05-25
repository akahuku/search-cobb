import assert from 'node:assert/strict';
import fs from 'node:fs';
import {default as nodePath} from 'node:path';
import readline from 'node:readline';
import * as url from 'node:url';

//import {graphemeRegex} from '../src/lib/grapheme-regex.js';
import {
	UNICODE_VERSION, UCD_SOURCE_URL, UCD_PATH,
	q2pl, downloadFrom, fileExists,
	graphemeRegex
} from '../bin/make-grapheme-cluster-regex.js';

const dirname = nodePath.dirname(url.fileURLToPath(import.meta.url));

function getDividePosition (s, index) {
	return getDumpedString(s.substring(index - 8, index)) +
		' ' +
		getDumpedString(s.substring(index, index + 8));
}

function getDumpedString (s) {
	return '[' + [...s].map(ch => {
		return `000000${ch.codePointAt(0).toString(16)}`
			.substr(-6)
			.toUpperCase()
			.replace(/^00([0-9A-F]{4})/, '$1');
	}).join(' ') + ']';
}

function getSimplifiedPattern (pattern) {
	return pattern.source.replace(/\[((?:\\.|[^\]])+)\]/g, ($0, $1) => {
		let re;

		re = /^\\u(?:\{[0-9A-F]+\}|[0-9A-F]{1,4})-\\u(?:\{[0-9A-F]+\}|[0-9A-F]{1,4})/.exec($1);
		if (re) {
			return '[' + re[0] + ']';
		}

		re = /^\\u(?:\{[0-9A-F]+\}|[0-9A-F]{1,4})/.exec($1);
		if (re) {
			return '[' + re[0] + ']';
		}

		return $0;
	});
}

describe('graphemeRegex', () => {
	/*
	 * this test data is from:
	 *   https://www.hos.co.jp/blog/20211122/
	 */
	it('graphemeRegex', () => {
		const testData = [
			// Grapheme clusters (both legacy and extended)
			[0x67, 0x308],
			[0x1100, 0x1161, 0x11A8],
			// Extended Grapheme Clusters
			[0x0BA8, 0x0BBF],
			// JIS X 0213
			[0x30BB, 0x309A],
			// Standardized Variation Sequence
			[0x30, 0xFE00],
			[0x1820, 0x180B],
			// Ideographic Variation Sequence
			[0x8FBA, 0xE0102],
			// Emoji
			[0x1F603],
			[0x1F1EF, 0x1F1F5],
			[0x261D, 0x1F3FF],
			[0x1F468, 0x200D, 0x1F469, 0x200D, 0x1F466, 0x200D, 0x1F466],
			[0x31, 0xFE0F, 0x20E3],
			[0x1F469, 0x200D, 0x2708, 0xFE0F],
			[0x1F3F4, 0xE0067, 0xE0062, 0xE0065, 0xE006E, 0xE0067, 0xE007F],
			[0x1F469, 0x1F3FD, 0x200D, 0x1F9B1],
			[0x1F468, 0x1F3FE, 0x200D, 0x1F9BC],
			[0x1F9D1, 0x200D, 0x1F4BC],
			[0x1F468, 0x200D, 0x1F37C],
			[0x1F9D1, 0x1F3FB, 0x200D, 0x2764, 0xFE0F, 0x200D, 0x1F48B, 0x200D, 0x1F9D1, 0x1F3FC],
			[0x1FAC3, 0x1F3FC],
		];

		const testString = testData
			.flat(Infinity)
			.map(cp => String.fromCodePoint(cp))
			.join('');
		const pattern = new RegExp(graphemeRegex(testString), 'ug');

		for (let re, i = 0; re = pattern.exec(testString); i++) {
			const actualCodePoints = [...re[0]].map(ch => ch.codePointAt(0));
			assert.deepEqual(actualCodePoints, testData[i], `test #${i}`);
		}
	});

	it('avoid catastrophic backtracks', () => {
		// <<<
		const target = [
			`1715043287902.jpg 105.85KiB 保存する`,
			` 24/05/07(火)09:54:47 | No.1186548744 del 2 猫屋敷いいよね`,
			` ... 1 24/05/07(火)10:01:53 | No.1186549767 でも吸われてる時は虚無`,
			` ... 2 24/05/07(火)10:06:43 | No.1186550552 3 今までにない関係性ですごい好き\nまだまだプリキュア可能性あるなって感じた`,
			` ... 3 24/05/07(火)10:09:46 | No.1186551036 絡み合う下の二人をニチアサにお流ししたらもう可能性は無限だ`,
			` ... 4 24/05/07(火)10:12:13 | No.1186551401 4 上のユキめっちゃ好き`,
			` ... 5 24/05/07(火)10:13:50 | No.1186551671 6 人になっても吸え`,
			` ... 6 24/05/07(火)10:15:16 | No.1186551876 4 こないだのNTRなんぬー!!!は面白かった`,
			` ... 7 24/05/07(火)10:17:13 | No.1186552178 人間体ユキの膝枕に顔突っ込んで吸うのかな`,
			` ... 8 24/05/07(火)10:17:56 | No.1186552300 まゆにそんなこと出来るのか`,
			` ... 9 24/05/07(火)10:26:00 | No.1186553603 2 頼りない子がクール系美人に膝枕する構図が最高だと思う`,
			` ... 10 24/05/07(火)10:31:45 | No.1186554623 うちのまゆを巻き込むなって言ったんぬ`,
			` ... 11 24/05/07(火)10:34:10 | No.1186555061 2 殺してやる...殺してやるぞキュアワンダフル`,
			` ... 12 24/05/07(火)10:34:44 | No.1186555171 ユキ...まゆ吸いしろ`,
			` ... 13 24/05/07(火)10:36:06 | No.1186555456 >殺してやる...殺してやるぞキュアワンダフル プリキュアに巻き込んだ件抜きにしてもNTRなんぬでこのスイッチが入ってそうなのがひどい`,
			` ... 14 24/05/07(火)10:38:17 | No.1186555828 ママとかお姉ちゃん気分のキャッツなのかな`,
			` ... 15 24/05/07(火)11:04:11 | No.1186560336 猫屋敷は怯えてる表情がいいよね...`,
			` ... 16 24/05/07(火)11:20:39 | No.1186563155 でもまゆぴーはさとるポンチ予約済みだからなぁ`,
			` ... 17 24/05/07(火)11:24:11 | No.1186563784 去年と同じ尺稼ぎの百合ごっこか...`,
			` ... 18 24/05/07(火)11:32:35 | No.1186565519 1 ありがたいですよね`,
			` ... 19 24/05/07(火)11:34:19 | No.1186565833 1 >でもまゆぴーはさとるポンチ予約済みだからなぁ おいいろは\nこいつから殺していいのかわん `
		].join('');
		// >>>
		const g = graphemeRegex();
		const pattern = new RegExp(`まゆ${g}+ユキ`, 'ug');
		const re = pattern.exec(target);
		assert.ok(!!re);
		assert.equal(re.index, 580);
	});
});

describe('ucd test', () => {
	const fileName = 'auxiliary/GraphemeBreakTest.txt';
	const path = nodePath.join(UCD_PATH, nodePath.basename(fileName));

	before(async () => {
		if (!fileExists(path)) {
			console.log(`downloading ${fileName}...`);
			await downloadFrom(
				nodePath.join(UCD_SOURCE_URL, fileName), path);
		}
		if (!fileExists(path)) {
			throw new Error(`${fileName} not found. stop.`);
		}
	});

	it('ensure behaviors of RegExp with u flag for surrogate pairs', () => {
		// U+1f353 U+1f344 U+1f96f
		const target = '🍓🍄🥯';

		assert.equal(
			target.match(/./g).length, 6);
		assert.equal(
			target.match(/./gu).length, 3);
		assert.equal(
			target.match(/[^\u000d]/gu).length, 3);
	});

	it('q2pl #1', () => {
		const source1 = '[\u0600-\u0605]';
		const source2 = '[^\x00-\x1f\x7f-\x9f\xad]';
		const expectedPattern = new RegExp(`${source1}*${source2}`, 'gu');
		const actualPattern = new RegExp(`${q2pl(source1, '*')}${source2}`, 'gu');
		const target = '\u0600A';
		const actualResult = actualPattern.exec(target);
		const expectedResult = expectedPattern.exec(target);

		assert.ok(Array.isArray(actualResult));
		assert.equal(typeof actualResult[0], 'string');
		assert.equal(typeof expectedResult[0], 'string' );
		assert.equal(actualResult[0], expectedResult[0]);
	});

	it('q2pl #2', () => {
		const source1 = '[0-9]';
		const source2 = '[a-z]';
		const source3 = '[0-9A-Z]';
		const expectedPattern = new RegExp(`${source1}*${source2}${source3}*`, 'gu');
		const actualPattern = new RegExp(`${q2pl(source1, '*')}${source2}${q2pl(source3, '*')}`, 'gu');
		const target = 'a01bcd9';
		const actualResult = target.match(actualPattern);
		const expectedResult = target.match(expectedPattern);

		assert.deepEqual(actualResult, expectedResult);
	});

	it('ucd test bugs #1', () => {
		/*
		 * expected: ÷ U+0020 ÷ U+0020 ÷ U+0600 ÷ U+000A ÷ U+0020 ÷
		 *   actual: ÷ U+0020 ÷ U+0020 ÷          U+000A ÷ U+0020 ÷
		 */
		const target = '\u0020\u0020\u0600\u000a\u0020';
		const expected = Array.from((new Intl.Segmenter).segment(target)).map(g => g.segment);
		const actual = [];
		const pattern = new RegExp(graphemeRegex(), 'gu');
		for (let re; re = pattern.exec(target); ) {
			actual.push(re[0]);
		}

		/*
		console.log('*** expected ***');
		for (const a of expected) {
			console.log(getDumpedString(a));
		}
		console.log('*** actual ***');
		for (const a of actual) {
			console.log(getDumpedString(a));
		}
		console.log('***');
		*/

		assert.deepEqual(actual, expected);
	});

	it('ucd test', async () => {
		const positions = [];
		const textFragments = [];
		let index = 0;

		const stream = fs.createReadStream(path);
		process.stdout.write(`reading ${fileName}...`);
		try {
			const rl = readline.createInterface({
				input: stream,
				crlfDelay: Infinity,
			});
			let lineNumber = 0;

			for await (const line of rl) {
				lineNumber++;

				if (!/^([0-9A-F÷×\s]+)/.test(line)) continue;
				const items = RegExp.$1.replace(/\s+$/, '').split(/\s+/);

				for (let i = 0; i < items.length; i++) {
					const item = items[i];
					if (item === '÷') {
						positions.push([index, lineNumber, i / 2, line]);
					}
					else if (/^[0-9A-F]+$/.test(item)) {
						const cp = parseInt(item, 16);
						const ch = String.fromCodePoint(cp);
						textFragments.push(ch);
						index += ch.length;
					}
				}

				textFragments.push('\u0000');
				index++;
			}
		}
		finally {
			stream.close();
			process.stdout.write('\n\n');
		}

		process.stdout.write(`testing...`);
		let passed = 0, failed = 0;
		try {
			const text = textFragments.join('');
			const pattern = new RegExp(graphemeRegex(), 'gu');

			for (let re, index = 0; re = pattern.exec(text); index++) {
				if (re.index !== positions[index][0]) {
					const [matchIndex, lineNumber, breakIndex, line] = positions[index];

					if (failed === 0) {
						console.log([
							``,
							`*** invalid index ***`,
							`     test line: ${lineNumber} "${line}"`,
							`   break index: ${breakIndex}`,
							`expected index: ${matchIndex} ${getDividePosition(text, matchIndex)}`,
							`  actual index: ${re.index} ${getDividePosition(text, re.index)}`,
							`simple pattern: ${getSimplifiedPattern(pattern)}`,
							`          gcr0: ${re.groups.gcr0}`,
							`          gcr1: ${re.groups.gcr1}`,
						].join('\n'));
					}

					pattern.lastIndex = positions[index][0] + re[0].length;
					failed++;
				}
				else {
					passed++;
				}
			}
			process.stdout.write(`\n${passed} test of ${positions.length} passed, ${failed} failed`);
		}
		finally {
			process.stdout.write('\n\n');
		}

		if (passed !== positions.length) {
			assert.fail(`has not passed all tests`);
		}
	});
});

// vim:set ts=4 sw=4 fenc=UTF-8 ff=unix ft=javascript fdm=marker fmr=<<<,>>> :
