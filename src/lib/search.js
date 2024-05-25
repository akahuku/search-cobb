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

import {esc, tag, log, MODE} from './common.js';
import {delay} from './utils.js';
import * as unifier from './unifier.js';
import * as regexTransformer from './regex-transformer.js';

/*
 * consts
 */

const RELATION_OTHER = 0;
const RELATION_BROTHER = 1;
const RELATION_UNCLE = 2;
const RELATION_NEPHEW = 3;
const RELATION_COUSIN = 4;

const WAIT_FOR_YIELD_EVERY = 32;
const WAIT_MSECS = 1;
const DELAY_LIMIT_MSECS = 500;

/*
 * 0: no trim
 * 1: trim left spaces
 * 2: merge left spaces into a space
 */
const TRIM_STRATEGY = 1;

/*
 * variables
 */

const searchInfoPool = {
	unified: {
		promise: undefined,
		info: {
			unified: true,
			sets: undefined
		}
	},
	strict: {
		promise: undefined,
		info: {
			unified: false,
			sets: undefined
		}
	}
};

export const exceptElementIds = new Set;

let sessionKey;

/*
 * functions
 */

const trimStart = (() => {
	switch (TRIM_STRATEGY) {
	case 0:
		// no trim
		return s => {
			return {leading: '', rest: s};
		};
	case 1:
		// trim left spaces
		return s => {
			const re = /^\s+/u.exec(s);
			if (re) {
				return {leading: re[0], rest: s.substring(re[0].length)};
			}
			else {
				return {leading: '', rest: s};
			}
		};
	case 2:
		// merge left spaces into a space
		return s => {
			const re = /^\s+/u.exec(s);
			if (re) {
				return {leading: re[0], rest: ' ' + s.substring(re[0].length)};
			}
			else {
				return {leading: '', rest: s};
			}
		};
	default:
		throw new Error('trimStart: unknown strategy');
	}
})();

function getPath (target, sentinel) {
	const result = [];
	while (target && target.parentNode && target !== sentinel) {
		const index = Array.prototype.indexOf.call(target.parentNode.childNodes, target);
		result.unshift(index);
		target = target.parentNode;
	}
	return result;
}

function getTextNodeFromPath (element, path) {
	for (let pathIndex = 0; element instanceof Element && pathIndex < path.length; pathIndex++) {
		const index = path[pathIndex];

		if (index < 0) {
			throw new Error(`getTextNodeFromPath: index is negative`);
		}
		if (index > element.childNodes.length) {
			throw new Error(`getTextNodeFromPath: index (${index}) is greater than childNodes.length (${element.childNodes.length})`);
		}

		element = element.childNodes[index];
	}

	if (!(element instanceof Text)) {
		throw new Error(`getTextNodeFromPath: final result is not a text node, ${Object.prototype.toString.call(element)}`);
	}

	return element;
}

function getTextNodeFromIndex (index, positions, isEnd) {
	let positionIndex = findPosition(index, positions, isEnd);
	if (positionIndex < 0) {
		throw new Error(`getTextNodeFromIndex: index (${index}) is not in positions`);
	}

	let elementIndex = positionIndex;
	while (elementIndex >= 0 && !(positions[elementIndex][1] instanceof Element)) {
		elementIndex--;
	}
	if (elementIndex < 0) {
		throw new Error(`getTextNodeFromIndex: element index (${elementIndex}) is not in positions`);
	}

	const element = positions[elementIndex][1];
	const path = positions[positionIndex].slice(positionIndex === elementIndex ? 2 : 1);

	return {
		textNode: getTextNodeFromPath(element, path),
		positionIndex
	};
}

function getTextNodeIndexFromCompiledTextIndex (compiledTextIndex, searchInfo, searchSetIndex, isEnd) {
	const {textNode, positionIndex} = getTextNodeFromIndex(
		compiledTextIndex, searchInfo.sets[searchSetIndex].positions, isEnd);
	const {leading, rest} = trimStart(textNode.nodeValue);
	const buffer = [];
	const DEBUG = false;//!isEnd && /⑬/.test(textNode.nodeValue);

	let textNodeIndexBefore = undefined;
	let textNodeIndex = 0;
	let compiledTextIndex2 = searchInfo.sets[searchSetIndex].positions[positionIndex][0];

	for (const g of (new Intl.Segmenter).segment(rest)) {
		if (compiledTextIndex2 >= compiledTextIndex) {
			if (DEBUG && buffer.length) {
				buffer.push([
					`breaking loop (1):`,
					`         textNodeIndex: ${textNodeIndex}`,
					`   textNodeIndexBefore: ${textNodeIndexBefore}`,
					`     compiledTextIndex: ${compiledTextIndex}`,
					`    compiledTextIndex2: ${compiledTextIndex2}`,
				].join('\n'));
			}
			break;
		}

		const unified = searchInfo.unified ? unifier.unifyGrapheme(g.segment) : g.segment;

		if (DEBUG && !isEnd) {
			if (buffer.length === 0) {
				buffer.push(`*** start, isEnd: ${isEnd ? 'true' : 'false'} ***`);
			}
			buffer.push([
				`segment "${esc(g.segment)}":`,
				`    textNode.nodeValue: "${esc(rest)}"`,
				`         textNodeIndex: ${textNodeIndex}`,
				`     compiledTextIndex: ${compiledTextIndex}`,
				`    compiledTextIndex2: ${compiledTextIndex2}`,
				`       unified segment: "${esc(unified)}" (${unified.length})`
			].join('\n'));
		}

		textNodeIndexBefore = textNodeIndex;
		textNodeIndex += g.segment.length;
		compiledTextIndex2 += unified.length;
	}

	if (!isEnd
	 && compiledTextIndex2 > compiledTextIndex
	 && textNodeIndexBefore !== undefined) {
		textNodeIndex = textNodeIndexBefore;
		buffer.push([
			`adjusting textNodeIndex: result: ${textNodeIndex}`,
		].join('\n'));
	}

	if (DEBUG) {
		buffer.push([
			`after loop:`,
			`         textNodeIndex: ${textNodeIndex}`,
			`   textNodeIndexBefore: ${textNodeIndexBefore}`,
			`     compiledTextIndex: ${compiledTextIndex}`,
			`    compiledTextIndex2: ${compiledTextIndex2}`,
		].join('\n'));
		console.log(buffer.join('\n'));
	}

	return {
		textNode,
		positionIndex,
		textNodeIndex: textNodeIndex + leading.length
	};
}

function getRelation (target, otherTarget) {
	let relation = RELATION_OTHER;

	/*
	 * relation to lastTextNode
	 *
	 * 1) direct siblings
	 *   <p>
	 *      #last
	 *      #current
	 *   </p>
	 *
	 * 2) uncle
	 *   <p>
	 *      #last
	 *      <span>#current</span>
	 *   </p>
	 *
	 * 3) nephew
	 *   <p>
	 *      <span>#last</span>
	 *      #current
	 *   </p>
	 *
	 * 4) cousin
	 *   <p>
	 *      <span>#last</span>
	 *      <span>#current</span>
	 *   </p>
	 *
	 * 0) other
	 */

	if (target && otherTarget) {
		if (target.previousSibling === otherTarget) {
			relation = RELATION_BROTHER;
		}
		else if (target.parentNode.previousSibling === otherTarget) {
			relation = RELATION_UNCLE;
		}
		else if (target.previousSibling === otherTarget.parentNode) {
			relation = RELATION_NEPHEW;
		}
		else if (target.parentNode.previousSibling === otherTarget.parentNode) {
			relation = RELATION_COUSIN;
		}
	}

	//log(`getRelation: target ${tag(target)} -> otherTarget ${tag(otherTarget)}: ${relation}`);
	return relation;
}

function isLeftMargined (target) {
	const style = window.getComputedStyle(target);
	if (style.marginLeft !== '0px') return true;
	if (style.paddingLeft !== '0px') return true;
	if (style.borderLeftStyle !== 'none' && style.borderLeftWidth !== '0px') return true;
	return false;
}

function isRightMargined (target) {
	const style = window.getComputedStyle(target);
	if (style.marginRight !== '0px') return true;
	if (style.paddingRight !== '0px') return true;
	if (style.borderRightStyle !== 'none' && style.borderRightWidth !== '0px') return true;
	return false;
}

function isSeparated (node1, node2) {
	let result = true;
	switch (getRelation(node1, node2)) {
	case RELATION_BROTHER:
		result = false;
		break;
	case RELATION_UNCLE:
		result = isLeftMargined(node1.parentNode);
		break;
	case RELATION_NEPHEW:
		result = isRightMargined(node2.parentNode);
		break;
	case RELATION_COUSIN:
		result = isLeftMargined(node1.parentNode)
			|| isRightMargined(node2.parentNode);
		break;
	}
	return result;
}

function createBlockWalker (root, options = {}) {
	const exceptElements = options.exceptElements;
	const report = options.report ?? (() => {});

	if (exceptElementIds.has(root.id) || exceptElements?.has(root)) {
		return {
			nextNode () {
				return null;
			}
		};
	}

	return document.createTreeWalker(
		root,
		window.NodeFilter.SHOW_ELEMENT | window.NodeFilter.SHOW_TEXT,
		node => {
			if (exceptElementIds.has(node.id) || exceptElements?.has(node)) {
				return window.NodeFilter.FILTER_REJECT;
			}

			if (node.nodeType === 1) {
				// skip invisible elements
				const visibility = node.checkVisibility({
					contentVisibilityAuto: true,
					opacityProperty: true,
					visibilityProperty: true
				});
				if (!visibility) {
					return window.NodeFilter.FILTER_REJECT;
				}

				// skip elements that don'e have size
				const rect = node.parentNode.getBoundingClientRect();
				if (rect.width === 0 && rect.height === 0) {
					return window.NodeFilter.FILTER_REJECT;
				}

				// skip elements that have some disiplay style
				const display = window.getComputedStyle(node).display;
				if (display === 'inline' || display.startsWith('inline-')
				 || display === 'table' || display.startsWith('table-')
				 || display === 'ruby' || display.startsWith('ruby-')
				 || display === 'grid'
				 || display === 'flex') {
					return window.NodeFilter.FILTER_SKIP;
				}
			}

			const reportResult = report(node, options);
			if (reportResult !== undefined) {
				return reportResult;
			}

			return window.NodeFilter.FILTER_ACCEPT;
		});
}

async function getSearchTargetFromIframe (detail, searchRoot) {
	if (searchRoot.src === 'about:blank') {
		return {detail, lines: [], positions: null};
	}

	try {
		searchRoot.contentWindow.postMessage({
			command: 'getSearchTarget', detail, sessionKey
		}, '*');
		const result = await Promise.race([
			new Promise((resolve, reject) => {
				window.addEventListener('message', e => {
					resolve(e.data);
				}, {once: true});
			}),
			new Promise((resolve, reject) => {
				setTimeout(reject, 1000 * 5);
			})
		]);
		return {
			detail,
			lines: result.sets[0].lines,
			positions: [0, searchRoot]
		};
	}
	catch (err) {
		return {detail, lines: [], positions: null};
	}
}

async function getSearchTarget (detail, searchRoot, options = {}) {
	const lines = [], positions = [];
	let lastTextNode, lastRootNode;
	let textLength = 0, currentText = '';

	for await (const {type, node, root} of blockWalk(searchRoot, options)) {
		switch (type) {
		case 'block':
			if (currentText !== '') {
				lines.push(currentText);
			}

			lastTextNode = undefined;
			currentText = '';
			break;

		case 'text':
			// treat some elements as empty
			if (node.parentNode.nodeName === 'RT'
			 || node.parentNode.nodeName === 'RP') {
				break;
			}

			let value = trimStart(node.nodeValue).rest;
			if (value === '') {
				break;
			}

			if (!detail.strict) {
				value = unifier.unifyString(value);
			}

			if (!lastTextNode) {
				positions.push([
					positions.length ? ++textLength : textLength,
					root,
					...getPath(node, root)
				]);

				currentText = value;
			}
			else {
				if (isSeparated(node, lastTextNode)
				 && /\S$/.test(currentText) && /^\S/.test(value)) {
					currentText += ' ';
					textLength++;
				}

				if (root === lastRootNode) {
					positions.push([
						textLength,
						...getPath(node, root)
					]);
				}
				else {
					positions.push([
						textLength,
						root,
						...getPath(node, root)
					]);
				}
			
				currentText += value;
			}

			/*
			log(JSON.stringify(positions.slice(-1)[0], (key, value) => {
				if (value instanceof Element) {
					return tag(value);
				}
				return value;
			}) + ` "${esc(value)}"`);
			*/

			lastTextNode = node;
			lastRootNode = root;
			textLength += value.length;
			break;
		}
	}

	if (currentText !== '') {
		lines.push(currentText);
	}

	return {detail, lines, positions};
}

/*
 * exported functions
 */

export function setSessionKey (arg) {
	sessionKey = arg;
}

export function findPosition (index, positions, exclusive = false) {
	let left = 0, right = positions.length - 1;
	let middle;

	while (left <= right) {
		middle = ((left + right) / 2) >> 0;

		if (!exclusive && (
			middle === positions.length - 1 && positions[middle][0] <= index
			 || positions[middle][0] <= index && index < positions[middle + 1][0])
		) {
			return middle;
		}
		else if (exclusive && (
			middle === positions.length - 1 && positions[middle][0] < index
			 || positions[middle][0] < index && index <= positions[middle + 1][0])
		) {
			return middle;
		}
		else if (positions[middle][0] < index) {
			left = middle + 1;
		}
		else {
			right = middle - 1;
		}
	}

	return -1;
}

export async function* blockWalk (root, options = {}) {
	const walker = createBlockWalker(root, options);
	const blocks = [root];
	const startTime = Date.now();
	for (let node, yieldCount = 0; node = walker.nextNode(); ) {
		if (node.nodeType === 1) {
			blocks.unshift(node);
			yield {
				type: 'block',
				node,
				root: undefined,
				position: window.getComputedStyle(node).position
			};
			(yieldCount++ % WAIT_FOR_YIELD_EVERY === 0)
				&& Date.now() - startTime < DELAY_LIMIT_MSECS
				&& await delay(WAIT_MSECS);
		}
		else {
			let r;
			loop: do {
				for (r = node.parentNode; r !== document.documentElement; r = r.parentNode) {
					if (r === blocks[0]) {
						break loop;
					}
				}
				blocks.shift();
				yield {
					type: 'block',
					node: blocks[0],
					root: undefined,
					position: window.getComputedStyle(blocks[0]).position
				};
			} while (blocks.length);

			if (!blocks.length) {
				r = root;
				blocks.unshift(root);
			}

			yield {
				type: 'text',
				node,
				root: r,
				position: window.getComputedStyle(node.parentNode).position
			};
			(yieldCount++ % WAIT_FOR_YIELD_EVERY === 0)
				&& Date.now() - startTime < DELAY_LIMIT_MSECS
				&& await delay(WAIT_MSECS);
		}
	}
}

export async function getPattern (text, target, detail) {
	if (detail.mode === MODE.MIGEMO && text !== '') {
		const response = await chrome.runtime.sendMessage({
			type: 'migemoQuery',
			query: text
		});

		if (!response?.migemoQuery) {
			throw new Error('Failed to convert Migemo expression');
		}

		text = response.migemoQuery;
	}

	text = regexTransformer.transform(text, target, detail);

	try {
		return new RegExp(text, 'gmsu' + (detail.strict ? '' : 'i'));
	}
	catch (err) {
		console.error(text);
		console.dir(err.stack);

		// V8 specific regex error message...
		if (/:\s*([^:]+)$/.test(err.message)) {
			throw new Error(RegExp.$1);
		}
		else {
			throw err;
		}
	}
}

export function getSearchInfo (detail, options = {}) {
	async function doSearchInfo (detail) {
		document.body.normalize();
		let currentNodes = 0;

		const total = document.evaluate(
			'count(/html/body//*|/html/body//*/text())',
			document.body, null, window.XPathResult.NUMBER_TYPE, null).numberValue;
		const subSearchRoots = {
			iframe: new Set,
			fixed: new Set,
			absolute: new Set
		};
		const reportCore = (node, gstOptions) => {
			if (gstOptions.isBody && node.nodeType === 1) {
				if (node.nodeName === 'IFRAME') {
					subSearchRoots.iframe.add(node);
					return window.NodeFilter.FILTER_REJECT;
				}
				else {
					const p = window.getComputedStyle(node).position;
					if (p === 'fixed') {
						subSearchRoots.fixed.add(node);
						return window.NodeFilter.FILTER_REJECT;
					}
					else if (p === 'absolute') {
						subSearchRoots.absolute.add(node);
						return window.NodeFilter.FILTER_REJECT;
					}
				}
			}
		};
		const report = typeof options.onProgress === 'function' ?
			(node, gstOptions) => {
				if (++currentNodes % 100 === 0) {
					options.onProgress(Math.min(1, currentNodes / total) * 100);
				}
				return reportCore(node, gstOptions);
			} : (node, gstOptions) => {
				return reportCore(node, gstOptions);
			};
		const st = await getSearchTarget(detail, document.body, {isBody: true, report});
		const prop = searchInfoPool[st.detail.strict ? 'strict' : 'unified'];

		if (prop.promise) {
			prop.info.sets = [{
				type: 'body',
				lines: st.lines,
				text: st.lines.join('\n'),
				positions: st.positions
			}];

			loop: for (const [name, nodes] of Object.entries(subSearchRoots)) {
				const targets = name === 'iframe' ?
					[...nodes].map(node => getSearchTargetFromIframe(detail, node)) :
					[...nodes].map(node => getSearchTarget(detail, node, {report}));

				for (const st of await Promise.all(targets)) {
					const prop = searchInfoPool[st.detail.strict ? 'strict' : 'unified'];
					if (!prop.promise) {
						break loop;
					}
					if (st.lines.length) {
						prop.info.sets.push({
							type: name,
							lines: st.lines,
							text: st.lines.join('\n'),
							positions: st.positions
						});
					}
				}
			}

			if (typeof options.onProgress === 'function') {
				options.onProgress(100);
			}
		};

		return prop.info;
	}

	const prop = searchInfoPool[detail.strict ? 'strict' : 'unified'];
	if (!prop.promise || options.ignoreCache) {
		prop.promise = doSearchInfo(detail);
	}

	return prop.promise;
}

export function dumpSearchInfo (searchInfo) {
	function dumpPositions (p) {
		return p
			.map(p => JSON.stringify(
				p,
				(k, v) => v instanceof Element ? tag(v) : v))
			.join('"\n\t"');
	}

	log('*** search info dump ***');
	log(`unified: ${searchInfo.unified ? 'yes' : 'no'}`);

	for (let i = 0; i < searchInfo.sets.length; i++) {
		const searchTarget = searchInfo.sets[i].text;
		const lines = searchInfo.sets[i].lines;
		const positions = searchInfo.sets[i].positions;
		const goal = Math.min(50, lines.length);

		log(`\n*** set #${i} ***`);
		//log(`searchTarget:\n\t"${lines.join('"\n\t"')}"`);

		if (!Array.isArray(positions)) {
			log(`positions not available`);
			continue;
		}

		log(`positions:\n\t"${dumpPositions(positions)}"`);

		if (positions[1] instanceof Node && positions[1].nodeName === 'IFRAME') {
			log(`skipping iframe information`);
			continue;
		}

		for (let lineIndex = 0, positionIndex = 0; lineIndex < goal; lineIndex++) {
			const buffer = [];
			buffer.push(`#${lineIndex}: "${esc(lines[lineIndex])}"`);

			if (positionIndex < positions.length) {
				let element;
				do {
					const position = positions[positionIndex++];
					const index = position[0];
					let pathIndex = 1;

					if (position[pathIndex] instanceof Node) {
						element = position[pathIndex++];
						buffer.push(`\telement: ${element.nodeName}`);
					}

					const path = position.slice(pathIndex);

					if (positionIndex < positions.length) {
						const nextIndex = positions[positionIndex][0];
						buffer.push([
							`\tindex: ${index}`,
							`path: ${path.join(', ')}`,
							`text: "${esc(searchTarget.substring(index, nextIndex))}"`
						].join(' '));
					}
					else {
						buffer.push([
							`\tindex: ${index}`,
							`path: ${path.join(', ')}`,
							`text: "${esc(searchTarget.substr(index, 16))}..."`
						].join(' '));
					}

					try {
						buffer.push([
							`\t\ttext node value: "${esc(trimStart(getTextNodeFromPath(element, path).nodeValue).rest)}"`
						].join(' '));
					}
					catch (err) {
						console.error(`failed to get text node`);
						console.dir(element);
						console.dir(path);
						throw err;
					}

				} while (positionIndex < positions.length
					&& !(positions[positionIndex][1] instanceof Node));
			}
			else {
				throw new Error('lines and positions are unbalanced!');
			}

			log(buffer.join('\n'));
		}

		log(`total number of lines: ${lines.length}, total number of positions: ${positions.length ?? 0}`);
	}
}

export function getFoundItemRange (matchResult, searchInfo, searchSetIndex) {
	if (searchInfo.sets[searchSetIndex].type === 'iframe') {
		return {
			match: {
				text: matchResult[0],
				index: matchResult.index
			},
			target: searchInfo.sets[searchSetIndex].positions[1]
		};
	}
	else {
		const start = getTextNodeIndexFromCompiledTextIndex(
			matchResult.index, searchInfo, searchSetIndex);
		if (start.textNodeIndex >= start.textNode.nodeValue.length) {
			console.log([
				`*** getFoundItemRange ***`,
				`!Invalid start range!`,
				`            matchResult[0]: "${esc(matchResult[0])}"`,
				`       start.textNodeIndex: ${start.textNodeIndex}`,
				`  start.textNode.nodeValue: "${esc(start.textNode.nodeValue)}"`
			].join('\n'));
			return null;
		}

		const end = getTextNodeIndexFromCompiledTextIndex(
			matchResult.index + matchResult[0].length, searchInfo, searchSetIndex, true);
		if (end.textNodeIndex === 0) {
			console.log([
				`*** getFoundItemRange ***`,
				`!Invalid end range!`,
				`          matchResult[0]: "${esc(matchResult[0])}"`,
				`       end.textNodeIndex: ${end.textNodeIndex}`,
				`  end.textNode.nodeValue: "${esc(end.textNode.nodeValue)}"`
			].join('\n'));
			return null;
		}

		/*
		 * foundItemRange = {
		 *     match: {
		 *         text: <string>
		 *         index: <number>
		 *     },
		 *     start: {
		 *         textNode: <Text>
		 *         positionIndex: <number>
		 *         textNodeIndex: <number>
		 *     },
		 *     end: {
		 *         textNode: <Text>
		 *         positionIndex: <number>
		 *         textNodeIndex: <number>
		 *     }
		 * }
		 */
		return {
			match: {
				text: matchResult[0],
				index: matchResult.index
			},
			start,
			end
		};
	}
}

export function close () {
	searchInfoPool.unified.promise =
	searchInfoPool.unified.lines =
	searchInfoPool.unified.text =
	searchInfoPool.unified.positions =
	searchInfoPool.strict.promise =
	searchInfoPool.strict.lines =
	searchInfoPool.strict.text =
	searchInfoPool.strict.positions = undefined;
}

export function* execLoop (pattern, text, limit = 1000) {
	while (true) {
		// TBD: what about ReDoS?
		const lastIndex = pattern.lastIndex;
		const re = pattern.exec(text);
		if (!re || re[0].length === 0) break;

		re.graphemes = [...(new Intl.Segmenter).segment(re[0])];

		/*
		 * truncatate re[0] if exceeds 'limit' (in grapheme clusters)
		 */
		if (typeof limit === 'number' && re.graphemes.length > limit) {
			re.graphemes = re.graphemes.slice(0, limit);
			re[0] = re.graphemes.map(g => g.segment).join('');
			pattern.lastIndex = lastIndex + re[0].length;
		}

		yield re;
	}
}

/*
 * A little investigation:
 *   Which extensions allow regular expression searches across multiple elements?
 *
 * can:
 *   RegExp Finder 1.0.0
 *   find+ | Regex Find-in-Page Tool 2.2.2
 *   Regular Expression Search 2.5.4.10
 *
 * cannot:
 *   Multi Search & Multi Jump 0.2.1.29
 *   Colorful Search Results with RegExp 2.0.8
 *   Chrome Regex Search 1.0.8
 */
