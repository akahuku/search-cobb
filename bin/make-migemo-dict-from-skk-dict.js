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
import {default as nodePath} from 'node:path';
import readline from 'node:readline';
import * as url from 'node:url';
import * as util from 'node:util';

import iconv from 'iconv-lite';
import {CompactDictionaryBuilder} from '../src/lib/jsmigemo.js';

/*
 * consts/
 */

const dirname = nodePath.dirname(url.fileURLToPath(import.meta.url));
const DEFAULT_SKK_DICT_PATH = '/usr/share/skk/SKK-JISYO.L';
const SYSTEM_WORD_PATH = '/usr/share/dict/words';

const KATA_TO_HIRA_MAP = {
	'ァ': 'ぁ',
	'ア': 'あ',
	'ィ': 'ぃ',
	'イ': 'い',
	'ゥ': 'ぅ',
	'ウ': 'う',
	'ェ': 'ぇ',
	'エ': 'え',
	'ォ': 'ぉ',
	'オ': 'お',
	'カ': 'か',
	'ガ': 'が',
	'キ': 'き',
	'ギ': 'ぎ',
	'ク': 'く',
	'グ': 'ぐ',
	'ケ': 'け',
	'ゲ': 'げ',
	'コ': 'こ',
	'ゴ': 'ご',
	'サ': 'さ',
	'ザ': 'ざ',
	'シ': 'し',
	'ジ': 'じ',
	'ス': 'す',
	'ズ': 'ず',
	'セ': 'せ',
	'ゼ': 'ぜ',
	'ソ': 'そ',
	'ゾ': 'ぞ',
	'タ': 'た',
	'ダ': 'だ',
	'チ': 'ち',
	'ヂ': 'ぢ',
	'ッ': 'っ',
	'ツ': 'つ',
	'ヅ': 'づ',
	'テ': 'て',
	'デ': 'で',
	'ト': 'と',
	'ド': 'ど',
	'ナ': 'な',
	'ニ': 'に',
	'ヌ': 'ぬ',
	'ネ': 'ね',
	'ノ': 'の',
	'ハ': 'は',
	'バ': 'ば',
	'パ': 'ぱ',
	'ヒ': 'ひ',
	'ビ': 'び',
	'ピ': 'ぴ',
	'フ': 'ふ',
	'ブ': 'ぶ',
	'プ': 'ぷ',
	'ヘ': 'へ',
	'ベ': 'べ',
	'ペ': 'ぺ',
	'ホ': 'ほ',
	'ボ': 'ぼ',
	'ポ': 'ぽ',
	'マ': 'ま',
	'ミ': 'み',
	'ム': 'む',
	'メ': 'め',
	'モ': 'も',
	'ャ': 'ゃ',
	'ヤ': 'や',
	'ュ': 'ゅ',
	'ユ': 'ゆ',
	'ョ': 'ょ',
	'ヨ': 'よ',
	'ラ': 'ら',
	'リ': 'り',
	'ル': 'る',
	'レ': 'れ',
	'ロ': 'ろ',
	'ヮ': 'ゎ',
	'ワ': 'わ',
	'ヰ': 'ゐ',
	'ヱ': 'ゑ',
	'ヲ': 'を',
	'ン': 'ん',
	'ヴ': 'ゔ',
	'ヵ': 'ゕ',
	'ヶ': 'ゖ',
	'ヷ': 'わ゙',
	'ヸ': 'ゐ゙',
	'ヹ': 'ゑ゙',
	'ヺ': 'を゙'
};

/*
 * functions
 */

function printHelp () {
	const name = nodePath.basename(process.argv[1]);
	console.log(`\
${name} -- make jsmigemo dict file from SKK dictionaries
usage: ${name} [options] <path/to/SKK dict>...
option:
  -d, --dest <path>       path to jsmigemo dict file
                          if not specified, migemo dict will be printed to stdout.
`);
	process.exit(1);
}

function parseArgs () {
	try {
		const args = util.parseArgs({
			options: {
				'help':    {type: 'boolean', short: 'h'},
				'dest':    {type: 'string',  short: 'd'},
				'verbose': {type: 'boolean', short: 'v'},
				'?':       {type: 'boolean'}
			},
			strict: true,
			allowPositionals: true
		});

		if (args.values.help || args.values['?']) {
			printHelp();
		}
		if (args.positionals.length === 0) {
			args.positionals.push(DEFAULT_SKK_DICT_PATH);
		}
		return {
			destPath: args.values.dest || '-',
			positionals: args.positionals,
			verbose: args.values.verbose
		};
	}
	catch (err) {
		console.error(err.message);
		printHelp();
	}
}

function peekFile (path, peekSize = 512) {
	let fd = fs.openSync(path);
	try {
		const b = Buffer.alloc(peekSize);
		fs.readSync(fd, b, 0, b.length);
		return b.toString('latin1');
	}
	finally {
		fd && fs.closeSync(fd);
	}
}

function guessEncoding (path) {
	const peekedContent = peekFile(path);
	if (/-\*-.*coding:\s*(\S+).*-\*-/.test(peekedContent)) {
		return RegExp.$1;
	}
	return 'utf8';
}

async function makeMigemoDict (hiraganaDict, latin1Dict, path) {
	process.stderr.write(`reading "${path}"...\n`);

	const encoding = guessEncoding(path);

	const stream = fs.createReadStream(path);
	let count = 0;
	try {
		let des, ens, rl;

		if (encoding !== 'utf8') {
			des = iconv.decodeStream(encoding);
			ens = iconv.encodeStream('utf8');
			rl = readline.createInterface({
				input: stream.pipe(des).pipe(ens),
				crlfDelay: Infinity,
			});
		}
		else {
			rl = readline.createInterface({
				input: stream,
				crlfDelay: Infinity,
			});
		}

		/*
		 * the code is based on
		 *   https://github.com/oguna/jsmigemo/blob/master/bin/jsmigemo-skk2migemo.mjs
		 *
		 * but is actually port of the following files:
		 *   https://github.com/koron/cmigemo/blob/master/tools/skk2migemo.pl
		 *   https://github.com/koron/cmigemo/blob/master/tools/optimize-dict.pl
		 */

		for await (const line of rl) {
			if (line.startsWith(';;')) continue;

			const index = line.indexOf(' ');
			if (index < 0) continue;
			let key = line.substring(0, index);
			let value = line.substring(index + 1);

			/*
			 * tweak the key
			 */

			// skip all prefix entries: ">ふじん /夫人;社長-,鈴木-/"
			if (/^[<>?]/.test(key)) {
				continue;
			}

			// skip all suffix entries: "ふじん> /婦人;-服,-靴,-参政権/"
			if (/[<>?]$/.test(key)) {
				continue;
			}

			// strip "okuri"
			if (/^([^ -~]+)[a-z]$/.test(key)) {
				key = RegExp.$1;
			}

			if (key === '') {
				continue;
			}
			key = key.toLowerCase();

			/*
			 * tweak the value
			 */

			const hasNumber = /#/.test(key);
			value = value
				.replace(/^\/|\/$/g, '')
				.split('/')
				.filter(v => {
					// strip lisp expressions
					return !/^\([a-zA-Z].*\)$/.test(v);
				})
				.filter(v => {
					// strip number expressions
					return !hasNumber || !/#/.test(v);
				})
				.map(v => {
					// strip annotations
					return v.replace(/;.*$/, '');
				});

			if (value.length === 0) {
				continue;
			}

			const dict = /^([ -~]+)$/.test(key) ? latin1Dict : hiraganaDict;
			let valueset;
			if (dict.has(key)) {
				valueset = dict.get(key);
			}
			else {
				valueset = new Set;
				dict.set(key, valueset);
			}

			for (const v of value) {
				valueset.add(v);
			}

			if (++count % 1000 === 0) {
				process.stderr.write(`\r${count}`);
			}
		}
	}
	finally {
		stream.close();
		process.stderr.write(`\rprocessed ${count} entries.\n`);
	}
}

async function makeWordDict (dict) {
	const path = SYSTEM_WORD_PATH;
	process.stderr.write(`reading "${path}"...\n`);

	const stream = fs.createReadStream(path);
	let count = 0;
	try {
		const rl = readline.createInterface({
			input: stream,
			crlfDelay: Infinity,
		});
		for await (const line of rl) {
			if (line === '') continue;
			if (line.endsWith("'s")) continue;

			dict.add(line.toLowerCase());

			if (++count % 1000 === 0) {
				process.stderr.write(`\r${count}`);
			}
		}
	}
	finally {
		stream.close();
		process.stderr.write(`\rprocessed ${count} entries.\n`);
	}
}

function toHiragana (s) {
	return s.replace(/[\u30a1-\u30fa]/g, $0 => KATA_TO_HIRA_MAP[$0]);
}

function outputMigemoDict (hiraganaDict, latin1Dict, wordDict, path) {
	/*
	 * transform latin1Dict and merge into hiraganaDict
	 */
	process.stderr.write(`transforming alphabet words...\n`);
	for (const [key, value] of latin1Dict.entries()) {
		if (!wordDict.has(key)) continue;

		for (const v of value.values()) {
			const hiragana = toHiragana(v);
			if (!/^(?:\p{Script=Hiragana}|ー)+$/u.test(hiragana)) continue;

			if (hiraganaDict.has(hiragana)) {
				hiraganaDict.get(hiragana).add(key);
			}
			else {
				hiraganaDict.set(hiragana, new Set([key]));
			}
		}
	}

	/*
	 * generate jsmigemo dictionary
	 */

	process.stderr.write(`generating jsmigemo dictionary...\n`);
	if (path === '-') {
		const collator = new Intl.Collator;
		const keys = [...hiraganaDict.keys()].sort((a, b) => {
			const isLatinA = /^[\u0000-\u007f]+$/.test(a) ? 1 : 0;
			const isLatinB = /^[\u0000-\u007f]+$/.test(b) ? 1 : 0;
			return isLatinA - isLatinB || b.length - a.length || collator.compare(a, b);
		});

		for (const key of keys) {
			console.log(`${key}\t${[...hiraganaDict.get(key).values()].join('\t')}`);
		}
	}
	else {
		for (const key of hiraganaDict.keys()) {
			const value = hiraganaDict.get(key);
			hiraganaDict.set(key, [...value.values()]);
		}

		const ab = CompactDictionaryBuilder.build(hiraganaDict);
		fs.writeFileSync(path, Buffer.from(ab));

		process.stderr.write(`migemo dict has been generated to "${path}".\n`);
	}
}

const args = parseArgs();

try {
	const hiraganaDict = new Map;
	const latin1Dict = new Map;
	const wordDict = new Set;

	for (const path of args.positionals) {
		await makeMigemoDict(hiraganaDict, latin1Dict, path);
	}

	await makeWordDict(wordDict);

	outputMigemoDict(hiraganaDict, latin1Dict, wordDict, args.destPath);
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
