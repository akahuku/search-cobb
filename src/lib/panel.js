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

import {_, esc, tag, log, MODE, OPT_STRICT, HIST_MAX} from './common.js';
import {$, delay, empty, debounce} from './utils.js';
import {getStyle} from './popup-style.js';
import {getFoundItemRange} from './search.js';
import {ShellHistory} from './history.js';

/*
 * consts
 */

const randKey = Math.trunc(Math.random() * 0x80000000).toString(16);
const randId = `appsweets-cobb-${randKey}`;
const strokeHandlers = {
	'c-a': (target, alter) => {
		// beginning of text
		document.getSelection().modify(alter, 'backward', 'lineboundary');
	},
	'c-e': (target, alter) => {
		// bottom of text
		document.getSelection().modify(alter, 'forward', 'lineboundary');
	},
	'c-b': (target, alter) => {
		// backward
		document.getSelection().modify(alter, 'backward', 'character');
	},
	'c-c': (target, alter) => {
		// copy active range
		copyActiveRange();
	},
	'c-f': (target, alter) => {
		// forward
		document.getSelection().modify(alter, 'forward', 'character');
	},
	'c-o': (target, alter) => {
		// open active range (if the active range is a link)
		openActiveRange();
	},
	'c-p': (target, alter) => {
		// back
		shellHistory.back();
	},
	'c-n': (target, alter) => {
		// advance
		shellHistory.advance();
	},
	'c-h': (target, alter) => {
		// erase backward char
		const selection = document.getSelection();
		if (selection.toString().length == 0) {
			selection.modify('extend', 'backward', 'character');
		}
		document.execCommand('delete', false, null);
	},
	'c-w': (target, alter) => {
		// erase backward word

		/*
		 * detailed behaviors:
		 *
		 * "foo.bar|"  -> "foo.|"
		 * "\Mfoo|bar" -> "\M|bar"
		 * "\M|"       -> ""
		 *
		 */
		const selection = document.getSelection();
		if (selection.toString().length == 0) {
			selection.modify('extend', 'backward', 'word');
		}
		if (/\\[LMC]$/.test(target.value.substring(0, target.selectionStart + 1))) {
			target.selectionStart += /\\[LMC]$/.test(target.value) ? -1 : 1;
		}
		document.execCommand('delete', false, null);
	},
	'c-u': (target, alter) => {
		// erase from beginning of text to cursor

		/*
		 * detailed behaviors:
		 *
		 * "foo|bar"   -> "|bar"
		 * "\Mfoo|bar" -> "\M|bar"
		 * "\M|"       -> ""
		 */
		const selection = document.getSelection();
		if (selection.toString().length == 0) {
			selection.modify('extend', 'backward', 'lineboundary');
		}
		if (/^\\[LMC].+$/.test(target.value)) {
			target.selectionStart = 2;
		}
		document.execCommand('delete', false, null);
	},
	'c-k': (target, alter) => {
		// erase from cursor to bottom of text
		const selection = document.getSelection();
		if (selection.toString().length == 0) {
			selection.modify('extend', 'forward', 'lineboundary');
		}
		document.execCommand('delete', false, null);
	},
	'c-/': (target, alter) => {
		// select all
		target.setSelectionRange(0, e.target.value.length);
	},
	'!c-m': (target, alter) => {
		// commit text
		commitPanelText(target.value, true);
	},
	'!c-[': (target, alter) => {
		// close panel
		invokeListener(onEscape);
	},

	'a-b': (target, alter) => {
		// backward word
		document.getSelection().modify(alter, 'backward', 'word');
	},
	'a-f': (target, alter) => {
		// forward word
		document.getSelection().modify(alter, 'forward', 'word');
	},
	'!a-l': (target, alter) => {
		$(`${randId}-link-literal`).click();
	},
	'!a-m': (target, alter) => {
		$(`${randId}-link-migemo`).click();
	},
	'!a-c': (target, alter) => {
		$(`${randId}-link-strict`).click();
	},

	/*
	 * note: prefix '!' means 'ignore defaultPrevented property'
	 */
	'!Enter': (target, alter) => {
		// commit text
		commitPanelText(target.value, true);
	},
	'!s-Enter': (target, alter) => {
		// commit text
		commitPanelText(target.value, true, true);
	},
	'!Escape': (target, alter) => {
		// close panel
		invokeListener(onEscape);
	}
};
const shellHistoryConfig = {
	historyMax: HIST_MAX,

	async getHistory () {
		const storage = await chrome.storage.local.get('histories');
		return storage.histories;
	},
	async saveHistory (alines) {
		saveHistoryDebounced(alines);
	},
	getInput () {
		return $(`${randId}-text`);
	},
	setInput (text) {
		const input = $(`${randId}-text`);
		input.value = text;
		input.setSelectionRange(input.value.length, input.value.length);
		input.focus();
		commitPanelTextCore(text);
	}
};
const foundItemList = {
	open: openFoundItemList,
	close: closeFoundItemList,
	add: addFoundItem,
	removeLast: removeLastFoundItem,
	emphasis: emphasisFoundItems,
	revert: revertFoundItems,
	activate: activateFoundItem,
	activateNext: activateNextFoundItem,
	activatePrevious: activatePreviousFoundItem,
	invalidate: invalidateFoundItems,
	copyActiveRange: copyActiveRange,
	openActiveRange: openActiveRange,
	dump: dumpFoundItems,
	item (index) {
		return foundItems?.[index];
	},
	get length () {
		return foundItems?.length;
	}
};
const SMOOTH_SCROLL_THRESHOLD_SCREEN_HEIGHT_FACTOR = 2;
const MARCHING_ANTS_WIDTH = 2;
const SCROLL_POSITION_FIX_COUNT = 10;
const SCROLL_POSITION_FIX_WAIT_MSECS = 100;

/*
 * debounced functions
 */

const commitPanelTextDebounced = debounce(commitPanelTextCore, 200);
const saveHistoryDebounced = debounce(alines => {
	chrome.storage.local.set({histories: alines}).catch(err => {});
}, 200);
const windowResizeDebounced = debounce(() => {
	invokeListener(onEscape);
}, 200);

/*
 * variables
 */

let onOpen;
let onCommitText;
let onCommitNext;
let onCommitPrevious;
let onEscape;
let onClose;

let runningListeners = new WeakSet;
let lastCommitText;
let foundItems;
let foundItemIndex;
let shellHistory;
let activeFoundItemBorder;

/*
 * classes
 */

function MarchingAntsBorder (foundItem, borderWidth = 2) {
	let elm, c1, url, iso;

	async function start () {
		const rect = elm.getBoundingClientRect();
		c1.width = Math.trunc(rect.width);
		c1.height = Math.trunc(rect.height);

		const c = c1.getContext('2d');
		c.lineWidth = borderWidth * 2;
		c.strokeStyle = 'black';
		c.clearRect(0, 0, c1.width, c1.height);
		c.strokeRect(0, 0, c1.width, c1.height);

		url = URL.createObjectURL(await new Promise(resolve => c1.toBlob(resolve)));
		elm.style.maskImage = `url(${url})`;
		elm.style.visibility = 'visible';

		iso.observe(foundItem.nodes[0]);
		if (foundItem.nodes.length > 1) {
			iso.observe(foundItem.nodes[foundItem.nodes.length - 1]);
		}

		for (let i = 0; i < SCROLL_POSITION_FIX_COUNT; i++) {
			const currentLeft = elm.style.left;
			const currentTop = elm.style.top;

			handleScroll();

			if (currentLeft === elm.style.left && currentTop === elm.style.top) {
				break;
			}

			await delay(SCROLL_POSITION_FIX_WAIT_MSECS);
		}
	}

	function stop () {
		if (url) {
			elm.style.maskImage = '';
			URL.revokeObjectURL(url);
			url = undefined;
		}

		iso.unobserve(foundItem.nodes[0]);
		if (foundItem.nodes.length > 1) {
			iso.unobserve(foundItem.nodes[foundItem.nodes.length - 1]);
		}

		window.removeEventListener('scroll', handleScroll);
	}

	function resize () {
		stop();
		return start();
	}

	function dispose () {
		stop();
		elm.parentNode.removeChild(elm);
		elm = undefined;
	}

	function handleIntersection (entries) {
		const isIntersecting = entries.some(e => e.isIntersecting);
		if (isIntersecting) {
			window.addEventListener('scroll', handleScroll);
		}
		else {
			window.removeEventListener('scroll', handleScroll);
		}
	}

	function handleScroll () {
		if (foundItem.nodes.length > 1) {
			const leftTop = foundItem.nodes.reduce((result, current) => {
				const rect = current.getBoundingClientRect();
				if (rect.left < result.left) {
					result.left = rect.left;
				}
				if (rect.top < result.top) {
					result.top = rect.top;
				}
				return result;
			}, {left: 0x7fffffff, top : 0x7fffffff});

			elm.style.left = `${leftTop.left - MARCHING_ANTS_WIDTH}px`;
			elm.style.top = `${leftTop.top - MARCHING_ANTS_WIDTH}px`;
		}
		else {
			const rect1 = foundItem.nodes[0].getBoundingClientRect();
			elm.style.left = `${rect1.left - MARCHING_ANTS_WIDTH}px`;
			elm.style.top = `${rect1.top - MARCHING_ANTS_WIDTH}px`;
		}
	}

	function init () {
		elm = document.body.appendChild(document.createElement('div'));
		elm.className = `${randId}-active-border`;
		elm.style.width = `${foundItem.width + MARCHING_ANTS_WIDTH * 2}px`;
		elm.style.height = `${foundItem.height + MARCHING_ANTS_WIDTH * 2}px`;
		c1 = document.createElement('canvas');
		iso = new IntersectionObserver(handleIntersection);
	}

	init();
	return {
		start, stop, resize, dispose,
		get element () {
			return elm;
		}
	};
}

/*
 * functions
 */

function isFixedPosition (el) {
	if (el.nodeType === 3) {
		el = el.parentNode;
	}
	for (; el && el instanceof HTMLElement; el = el.parentNode) {
		if (window.getComputedStyle(el).position === 'fixed') {
			return true;
		}
	}

	return false;
}

function createStyle () {
	let el = $(`${randId}-style`);
	if (!el) {
		el = document.head.appendChild(document.createElement('style'));
		el.type = 'text/css';
		el.id = `${randId}-style`;
		el.appendChild(document.createTextNode(getStyle(randId, {})));
	}
}

function getStroke (e) {
	const components = [];
	e.shiftKey && components.push('s');
	e.ctrlKey  && components.push('c');
	e.altKey   && components.push('a');
	components.push(e.key);
	return components.join('-');
}

function invokeListener (listener, ...args) {
	if (typeof listener !== 'function' || runningListeners.has(listener)) {
		return;
	}

	let result;
	try {
		runningListeners.add(listener);
		result = listener(...args);
	}
	catch (err) {
		console.error(err.stack);
		setMessage(err.message);
	}

	if (result instanceof Promise) {
		result.catch(err => {
			console.error(err.stack);
			setMessage(err.message);
		}).finally(() => {
			runningListeners.delete(listener);
		});
	}
	else {
		runningListeners.delete(listener);
	}
}

function getHighestZindex (node) {
	let result = 0;
	for (; node instanceof Element; node = node.parentNode) {
		const zIndex = parseInt(getComputedStyle(node).zIndex, 10);
		if (!isNaN(zIndex)) {
			result = Math.max(zIndex, result);
		}
	}
	return result;
}

/*
 * panel interface
 */

async function openPanel () {
	if ($(`${randId}-text`)) {
		$(`${randId}-text`).focus();
		return;
	}

	createStyle();

	const panel = document.body.appendChild(document.createElement('div'));
	panel.id = randId;
	panel.insertAdjacentHTML('beforeend', `\
<div id="${randId}-bar" class="${randId}-bar"><div></div></div>
<div id="${randId}-header" class="${randId}-header"></div>
<div class="${randId}-body">
	<input type="text" id="${randId}-text">
	<button id="${randId}-button">${_('search')}</button>
</div>
<div id="${randId}-footer" class="${randId}-footer">
	<div id="${randId}-message"></div>
	<div>
		<span>${_('modeSpecifiers')}:</span>
		<a id="${randId}-link-literal" href="#${MODE.LITERAL}" title="${_('titleLiteral')}"><span>\\L</span>${_('linkLiteral')}</a>
		<a id="${randId}-link-migemo" href="#${MODE.MIGEMO}" title="${_('titleMigemo')}"><span>\\M</span>${_('linkMigemo')}</a>
		<a id="${randId}-link-strict" href="#${OPT_STRICT}" title="${_('titleStrict')}"><span>\\C</span>${_('linkStrict')}</a>
	</div>
</div>
	`);
	panel.style.right = '0';
	panel.style.top = '0';
	panel.style.visibility = 'hidden';

	const text = $(`${randId}-text`);
	text.addEventListener('keydown', handlePanelTextKeyDown);
	text.addEventListener('input', handlePanelTextInput);
	text.addEventListener('compositionstart', handlePanelTextCompositionStart);
	text.addEventListener('compositionend', handlePanelTextCompositionEnd);

	$(`${randId}-button`).addEventListener('click', handlePanelButtonClick);
	$(`${randId}-link-literal`).addEventListener('click', handleLinkButtonClick);
	$(`${randId}-link-migemo`).addEventListener('click', handleLinkButtonClick);
	$(`${randId}-link-strict`).addEventListener('click', handleLinkButtonClick);

	window.addEventListener('resize', windowResizeDebounced);

	await delay(10);
	panel.style.visibility = 'visible';
	shellHistory = new ShellHistory;
	shellHistory.applyConfig(shellHistoryConfig);
	
	await delay(10);
	const p = document.elementFromPoint(
		document.documentElement.clientWidth - 8, 8);
	if (p !== panel) {
		// there is an element with a higher zindex than the panel
		panel.style.zIndex = getHighestZindex(p) + 1;
	}

	invokeListener(onOpen);
}

function closePanel (searchInfo) {
	const panel = $(randId);
	if (!panel) return;

	revertFoundItems();

	// convert emphasis range to real selection
	if (searchInfo
	 && foundItems?.length
	 && typeof foundItemIndex === 'number'
	 && 0 <= foundItemIndex && foundItemIndex < foundItems.length) {
		const match = foundItems[foundItemIndex].match;
		const re = [match.text];
		re.index = match.index;

		const r = searchInfo.sets.reduce((result, set, index) => {
			if (result) {
				return result;
			}

			if (set.text.substr(re.index, re[0].length) !== match.text) {
				return result;
			}

			try {
				const fi = getFoundItemRange(re, searchInfo, index);
				if (fi && fi.start && fi.end) {
					const r = document.createRange();
					r.setStart(fi.start.textNode, fi.start.textNodeIndex);
					r.setEnd(fi.end.textNode, fi.end.textNodeIndex);
					return r;
				}
			}
			catch (err) {
				log(`illegal range: ${err.stack}`);
			}

			return null;
		}, null);

		if (r) {
			const anchor = r.commonAncestorContainer.closest?.('a')
				?? r.commonAncestorContainer.parentNode.closest?.('a');
			if (anchor) {
				anchor.focus();
			}
			else {
				const selection = window.getSelection();
				selection.removeAllRanges();
				selection.addRange(r);
			}
		}
	}

	const text = $(`${randId}-text`);
	text.removeEventListener('keydown', handlePanelTextKeyDown);
	text.removeEventListener('input', handlePanelTextInput);
	text.removeEventListener('compositionstart', handlePanelTextCompositionStart);
	text.removeEventListener('compositionend', handlePanelTextCompositionEnd);

	$(`${randId}-button`).removeEventListener('click', handlePanelButtonClick);
	$(`${randId}-link-literal`).removeEventListener('click', handleLinkButtonClick);
	$(`${randId}-link-migemo`).removeEventListener('click', handleLinkButtonClick);
	$(`${randId}-link-strict`).removeEventListener('click', handleLinkButtonClick);

	window.removeEventListener('resize', windowResizeDebounced);

	shellHistory = undefined;
	foundItems = undefined;
	foundItemIndex = undefined;

	panel.parentNode.removeChild(panel);

	invokeListener(onClose);
}

function config (con) {
	if (typeof con?.onOpen === 'function') {
		onOpen = con.onOpen;
	}
	if (typeof con?.onCommitText === 'function') {
		onCommitText = con.onCommitText;
	}
	if (typeof con?.onCommitNext === 'function') {
		onCommitNext = con.onCommitNext;
	}
	if (typeof con?.onCommitPrevious === 'function') {
		onCommitPrevious = con.onCommitPrevious;
	}
	if (typeof con?.onEscape === 'function') {
		onEscape = con.onEscape;
	}
	if (typeof con?.onClose === 'function') {
		onClose = con.onClose;
	}
}

function setHeader (s, isAlart) {
	const header = $(`${randId}-header`);
	if (typeof s === 'string') {
		header.textContent = s;
	}
	header.classList.remove('good');
	header.classList.remove('bad');
	header.classList.add(isAlart ? 'bad' : 'good');
}

function setHeaderSeverity (s, isAlert) {
	const header = $(`${randId}-header`);
	header.appendChild(document.createTextNode(` (${s})`));
	setHeader(null, isAlert);
}

function setMessage (s) {
	const messageDiv = $(`${randId}-message`);
	messageDiv.textContent = s;
}

function showDefaultMessage () {
	setMessage(_('default'));
}

function showProcessingMessage () {
	setMessage(_('processing'));
}

function showFoundMessage (matched) {
	let message = '';

	if (typeof matched !== 'number') {
		matched = foundItems?.length;
	}
	if (typeof matched === 'number' && matched > 0) {
		if (typeof foundItemIndex === 'number') {
			message = _('foundAndIndex', matched, foundItemIndex + 1);
		}
		else {
			message = _('found', matched);
		}
	}
	else {
		message = _('notFound');
	}

	setMessage(message);
}

function setProgress (p) {
	const progress = $(`${randId}-bar`).firstChild;
	progress.style.width = `${p}%`;
	if (p >= 100) {
		progress.style.transition = 'none';
		progress.style.backgroundColor = '#0c0';
	}
	else if (p > 33) {
		progress.style.backgroundColor = '#fa0';
	}
}

function requestCommit () {
	commitPanelTextCore($(`${randId}-text`).value, false, false);
}

function isOpened () {
	return !!$(randId);
}

/*
 * commit functions
 */

function commitPanelText (text, isFinal, isShift) {
	if (isFinal) {
		if (text === lastCommitText && foundItems) {
			invokeListener(isShift ? onCommitPrevious : onCommitNext);
			return;
		}

		lastCommitText = text;
		shellHistory.addEntry(text);
		commitPanelTextCore(text, isFinal, isShift);
	}
	else {
		shellHistory.updateCurrentEntry(text);
		commitPanelTextDebounced(text, false, false);
	}
}

function commitPanelTextCore (text, isFinal, isShift) {
	// parse the mode specifiers
	let mode = MODE.REGEX;
	let strict = false;
	let strictMessage = '';
	text = text.replace(/(?<!\\)\\([LMC])/g, ($0, specifier) => {
		switch (specifier) {
		case 'L': mode = MODE.LITERAL; break;
		case 'M': mode = MODE.MIGEMO; break;
		case 'C':
			strict = true;
			strictMessage = _('strict');
			break;
		}
		return '';
	});

	// update the header text
	switch (mode) {
	case MODE.REGEX:
		setHeader(`${strictMessage}${_('regex')}:`);
		break;

	case MODE.LITERAL:
		setHeader(`${strictMessage}${_('literal')}:`);
		break;

	case MODE.MIGEMO:
		setHeader(`${strictMessage}${_('migemo')}:`);
		break;
	}

	// reset foundItems
	if (foundItems && !isFinal) {
		invalidateFoundItems();
	}

	invokeListener(onCommitText, text, {isFinal, mode, strict});
}

/*
 * found item list functions
 */

function openFoundItemList () {
	revertFoundItems();
	foundItems = [];
}

function closeFoundItemList () {
}

function addFoundItem (range) {
	if (foundItems.length
	 && range.target && foundItems[foundItems.length - 1].target
	 && range.target === foundItems[foundItems.length - 1].target) {
		return;
	}

	range.index = foundItems.length;
	/*
	 * foundItems (before emphasis) = [
	 *   {
	 *     index: <number>
	 *     match: {
	 *       text: <string>
	 *       index: <number>
	 *     },
	 *     start: {
	 *       textNode: <Text>
	 *       positionIndex: <number>
	 *       textNodeIndex: <number>
	 *     },
	 *     end: {
	 *       textNode: <Text>
	 *       positionIndex: <number>
	 *       textNodeIndex: <number>
	 *     }
	 *   }
	 * ]
	 */
	foundItems.push(range);
}

function removeLastFoundItem () {
	foundItems.pop();
}

function emphasisFoundItems () {
	function removeSurroundingEmptyTextNodes (node) {
		if (node.previousSibling?.nodeType === 3
		 && node.previousSibling.nodeValue === '') {
			node.previousSibling.parentNode.removeChild(node.previousSibling);
		}

		if (node.nextSibling?.nodeType === 3
		 && node.nextSibling.nodeValue === '') {
			node.nextSibling.parentNode.removeChild(node.nextSibling);
		}
	}

	function getEmphasisRect (fi) {
		if (fi.target) {
			return fi.target.getBoundingClientRect();
		}
		else {
			try {
				r.setStart(fi.start.textNode, fi.start.textNodeIndex);
				r.setEnd(fi.end.textNode, fi.end.textNodeIndex);
				return r.getBoundingClientRect();
			}
			catch {
				console.log([
					`*** range error on #${i} ***`,
					`start: ${tag(fi.start.textNode.parentNode)} index: ${fi.start.textNodeIndex}`,
					`  end: ${tag(fi.end.textNode.parentNode)} index: ${fi.end.textNodeIndex}`,
					`range: "${esc(r.toString())}"`
				].join('\n'));
			}
		}
	}

	if (!foundItems) return;

	const clientWidth = document.documentElement.clientWidth || 1920;
	const clientHeight = document.documentElement.clientHeight || 1080;
	const scrollWidth = document.documentElement.scrollWidth || 1920;
	const scrollHeight = document.documentElement.scrollHeight || 1080 * 4;

	const screenLeft = window.scrollX;
	const screenTop = window.scrollY;
	const screenRight = window.scrollX + clientWidth;
	const screenBottom = window.scrollY + clientHeight;
	const screenWidthHalf = clientWidth / 2;
	const screenHeightHalf = clientHeight / 2;
	const r = document.createRange();

	for (let i = foundItems.length - 1; i >= 0; i--) {
		const fi = foundItems[i];
		const fi2 = {index: fi.index, match: fi.match, nodes: []};
		const rect = getEmphasisRect(fi);

		fi2.isFixed = isFixedPosition(fi.start?.textNode ?? fi.target) ? 1 : 0;
		fi2.left = rect.left + (fi2.isFixed ? 0 : window.scrollX);
		fi2.top = rect.top + (fi2.isFixed ? 0 : window.scrollY);
		fi2.width = rect.width;
		fi2.height = rect.height;
		fi2.goalScrollX = Math.max(0, fi2.left - screenWidthHalf);
		fi2.goalScrollY = Math.max(0, fi2.top - screenHeightHalf);
		//console.log(`${fi2.left},${fi2.top} (${fi2.width}x${fi2.height})`);

		if (fi2.left < -fi2.width || fi2.left >= scrollWidth
		 || fi2.top < -fi2.height || fi2.top >= scrollHeight) {
			foundItems.splice(i, 1);
			continue;
		}

		if (fi.target) {
			fi2.nodes.push(fi.target);
			fi.target.className = `${randId}-emphasis-C`;
			foundItems[i] = fi2;
			continue;
		}

		if (fi.start.textNode === fi.end.textNode) {
			if (fi.start.textNodeIndex === 0
			 && fi.end.textNodeIndex === fi.end.textNode.nodeValue.length) {
				// class B
				const wrap = document.createElement('span');
				wrap.className = `${randId}-emphasis-B`;
				r.selectNode(fi.start.textNode);
				r.surroundContents(wrap);
				fi2.nodes.push(wrap);
			}
			else {
				// class A
				const wrap = document.createElement('span');
				wrap.className = `${randId}-emphasis-A`;
				r.setStart(fi.start.textNode, fi.start.textNodeIndex);
				r.setEnd(fi.end.textNode, fi.end.textNodeIndex);
				r.surroundContents(wrap);
				removeSurroundingEmptyTextNodes(wrap);
				fi2.nodes.push(wrap);
			}
		}
		else {
			// class C
			try {
				r.setStart(fi.start.textNode, fi.start.textNodeIndex);
				r.setEnd(fi.end.textNode, fi.end.textNodeIndex);
			}
			catch {
				console.log([
					`*** class C range error on #${i} ***`,
					`start: ${tag(fi.start.textNode.parentNode)} index: ${fi.start.textNodeIndex}`,
					`  end: ${tag(fi.end.textNode.parentNode)} index: ${fi.end.textNodeIndex}`,
					`range: "${esc(r.toString())}"`
				].join('\n'));
			}

			const itor = document.createNodeIterator(
				r.commonAncestorContainer,
				window.NodeFilter.SHOW_ELEMENT,
				node => {
					const thisRange = document.createRange();
					thisRange.selectNode(node);
					return r.compareBoundaryPoints(Range.START_TO_START, thisRange) <= 0
						&& r.compareBoundaryPoints(Range.END_TO_END, thisRange) >= 0;
				});
			for (let node; node = itor.nextNode(); ) {
				node.classList.add(`${randId}-emphasis-C`);
				fi2.nodes.push(node);
			}

			if (fi.start.textNodeIndex === 0) {
				// left text: class B
				const wrap = document.createElement('span');
				wrap.className = `${randId}-emphasis-B`;
				r.selectNode(fi.start.textNode);
				r.surroundContents(wrap);
				fi2.nodes.unshift(wrap);
			}
			else {
				// left text: class A
				const wrap = document.createElement('span');
				wrap.className = `${randId}-emphasis-A`;
				r.setStart(fi.start.textNode, fi.start.textNodeIndex);
				r.setEnd(fi.start.textNode, fi.start.textNode.nodeValue.length);
				r.surroundContents(wrap);
				removeSurroundingEmptyTextNodes(wrap);
				fi2.nodes.unshift(wrap);
			}

			if (fi.end.textNodeIndex === fi.end.textNode.nodeValue.length) {
				// right text: class B
				const wrap = document.createElement('span');
				wrap.className = `${randId}-emphasis-B`;
				r.selectNode(fi.end.textNode);
				r.surroundContents(wrap);
				fi2.nodes.push(wrap);
			}
			else {
				// right text: class A
				const wrap = document.createElement('span');
				wrap.className = `${randId}-emphasis-A`;
				r.setStart(fi.end.textNode, 0);
				r.setEnd(fi.end.textNode, fi.end.textNodeIndex);
				r.surroundContents(wrap);
				removeSurroundingEmptyTextNodes(wrap);
				fi2.nodes.push(wrap);
			}
		}

		/*
		 * foundItems (after emphasis) = [
		 *   {
		 *     index: <number>
		 *     match: {
		 *       text: <string>
		 *       index: <number>
		 *     },
		 *     nodes: [<Node>]
		 *     isFixed: <boolean>
		 *     left: <number>
		 *     top: <number>
		 *     width: <number>
		 *     height:<number>
		 *     goalScrollX: <number>
		 *     goalScrollY: <number>
		 *   }
		 * ]
		 */
		foundItems[i] = fi2;
	}

	foundItems.sort((a, b) => {
		return a.isFixed - b.isFixed
			|| a.top - b.top
			|| a.left - b.left
			|| a.index - b.index;
	});

	foundItemIndex = -1;
	for (let i = 0; i < foundItems.length; i++) {
		const fi = foundItems[i];
		if (screenLeft <= fi.left && fi.left < screenRight
		 && screenTop <= fi.top && fi.top < screenBottom) {
			foundItemIndex = i;
			break;
		}
	}

	if (foundItemIndex < 0) {
		const distances = [];

		for (let i = 0; i < foundItems.length; i++) {
			const fi = foundItems[i];
			distances.push({
				isFixed: fi.isFixed,
				distance: Math.abs(fi.goalScrollY - screenTop),
				left: fi.left,
				index: i
			});
		}

		distances.sort((a, b) => {
			return a.isFixed - b.isFixed
				|| a.distance - b.distance
				|| a.left - b.left
				|| a.index - b.index;
		});

		foundItemIndex = distances[0].index;
	}
}

function revertFoundItems () {
	/*
	 * emphasis types:
	 *
	 * class A
	 *    original: #thisisTEXTnode
	 *    emphasis: #thisis <span class="A">#TEXT</span> #node
	 *
	 * class B
	 *    original: #thisis #TEXT #node
	 *    emphasis: #thisis <span class="B">#TEXT</span> #node
	 *
	 * class C
	 *    original: ... <any-element>...</any-element>
	 *    emphasis: ... <any-element class="C">...</any-element>
	 */

	const r = document.createRange();

	for (const elm of [...document.querySelectorAll(`.${randId}-emphasis-A`)]) {
		const parent = elm.parentNode;
		r.selectNodeContents(elm);
		const df = r.extractContents();
		parent.insertBefore(df, elm);
		parent.removeChild(elm);
		parent.normalize();
	}

	for (const elm of [...document.querySelectorAll(`.${randId}-emphasis-B`)]) {
		const parent = elm.parentNode;
		r.selectNodeContents(elm);
		const df = r.extractContents();
		parent.insertBefore(df, elm);
		parent.removeChild(elm);
	}

	const pattern = new RegExp(`(\\s*)${randId}-emphasis-C(\\s*)`, 'g');
	for (const elm of [...document.querySelectorAll(`.${randId}-emphasis-C`)]) {
		elm.classList.remove(`${randId}-emphasis-C`);
		if (elm.classList.length === 0) {
			elm.removeAttribute('class');
		}
	}

	if (activeFoundItemBorder) {
		activeFoundItemBorder.dispose();
		activeFoundItemBorder = undefined;
	}
}

function activateNextFoundItem () {
	if (foundItems?.length) {
		foundItemIndex = (foundItemIndex + 1) % foundItems.length;
		activateFoundItem(foundItemIndex);
	}
}

function activatePreviousFoundItem () {
	if (foundItems?.length) {
		foundItemIndex = (foundItemIndex + foundItems.length - 1) % foundItems.length;
		activateFoundItem(foundItemIndex);
	}
}

function activateFoundItem (index) {
	if (!foundItems) return;

	if (typeof index !== 'number') index = foundItemIndex;
	if (index < 0 || index >= foundItems.length) return;
	
	const fi = foundItems[index];
	const needSmoothScroll = Math.abs(window.scrollY - fi.goalScrollY) < document.documentElement.clientHeight * SMOOTH_SCROLL_THRESHOLD_SCREEN_HEIGHT_FACTOR;

	fi.nodes[0].scrollIntoView({
		block: 'center',
		inline: 'nearest',
		behavior: needSmoothScroll ? 'smooth' : 'instant'
	});

	// remove all existing active ranges
	const selector = ['A', 'B', 'C']
		.map(ch => `.${randId}-emphasis-${ch}.${randId}-active`)
		.join(',');
	for (const elm of document.querySelectorAll(selector)) {
		elm.classList.remove(`${randId}-active`);
		// note: after removing the active class name,
		// the className is NOT empty because the emphasis class should remain.
	}

	// mark new active range
	for (const elm of fi.nodes) {
		elm.classList.add(`${randId}-active`);
	}

	// remove existing active border
	if (activeFoundItemBorder) {
		activeFoundItemBorder.dispose();
		activeFoundItemBorder = undefined;
	}

	// create new active border
	activeFoundItemBorder = new MarchingAntsBorder(fi, MARCHING_ANTS_WIDTH);
	activeFoundItemBorder.start();

	showFoundMessage();
}

function invalidateFoundItems () {
	foundItems = foundItemIndex = undefined;
}

async function copyActiveRange () {
	if (foundItems?.length) {
		const r = document.createRange();
		const fi = foundItems[foundItemIndex];
		try {
			r.setStartBefore(fi.nodes[0]);
			r.setEndAfter(fi.nodes[fi.nodes.length - 1]);
			const anchor = r.commonAncestorContainer.closest?.('a')
				?? r.commonAncestorContainer.parentNode.closest?.('a');
			const content = anchor ?
				`[${anchor.textContent}](${anchor.href})` :
				r.toString();
			await navigator.clipboard.writeText(content);
			setMessage(`Copied to clipboard`);
		}
		catch (err) {
			setMessage(err.message);
		}
	}
}

function openActiveRange () {
	if (foundItems?.length) {
		const r = document.createRange();
		const fi = foundItems[foundItemIndex];
		try {
			r.setStartBefore(fi.nodes[0]);
			r.setEndAfter(fi.nodes[fi.nodes.length - 1]);
			const anchor = r.commonAncestorContainer.closest?.('a')
				?? r.commonAncestorContainer.parentNode.closest?.('a');
			if (anchor) {
				invokeListener(onEscape);
				anchor.click();
			}
			else {
				setMessage('Link not found');
			}
		}
		catch (err) {
			setMessage(err.message);
		}
	}
}

function dumpFoundItems (searchInfo) {
	if (foundItems?.length) {
		console.log('*** dumpFoundItems ***');
		for (let i = 0; i < foundItems.length; i++) {
			const fi = foundItems[i];
			const lines = [`#${i}`];

			if (fi.start && fi.end) {
				const st = fi.start.textNode;
				const ed = fi.end.textNode;
				let line = [];

				// start text node
				line.push('start: ');
				line.push(st.parentNode ? tag(st.parentNode) : `<NO PARENT NODE>`);
				line.push(`(${isFixedPosition(st) ? 'fixed' : 'static'})`);
				if (0 <= fi.start.textNodeIndex && fi.start.textNodeIndex <= st.nodeValue.length) {
					line.push(`..."${esc(st.nodeValue.substring(fi.start.textNodeIndex))}"`);
				}
				else {
					line.push(`INVALID INDEX: ${fi.start.textNodeIndex}`);
				}
				lines.push(line.join(' '));

				// end text node
				line.length = 0;
				line.push('end: ');
				line.push(ed.parentNode ? tag(ed.parentNode) : `<NO PARENT NODE>`);
				line.push(`(${isFixedPosition(ed) ? 'fixed' : 'static'})`);
				if (0 <= fi.end.textNodeIndex && fi.end.textNodeIndex <= ed.nodeValue.length) {
					line.push(`"${esc(ed.nodeValue.substring(0, fi.end.textNodeIndex))}"...`);
				}
				else {
					line.push(`INVALID INDEX: ${fi.end.textNodeIndex}`);
				}
				lines.push(line.join(' '));

				lines.push(`match: "${esc(fi.match.text)}"`);
				lines.push(`match index: ${fi.match.index}`);
				lines.push(`match length: ${fi.match.text.length}`);
				console.log(lines.join('\n'));
			}
			else if (fi.target) {
				lines.push(`target: ${tag(fi.target)}`);
				console.log(lines.join('\n'));
			}
		}
	}
	else {
		console.log(`dumpFoundItems: no found items.`);
	}
}

/*
 * event handlers
 */

function handlePanelTextKeyDown (e) {
	if (e.isComposing) return;
	if (e.target.dataset.isComposing) return;

	const stroke = getStroke(e);
	const handler = stroke in strokeHandlers && !e.defaultPrevented ? strokeHandlers[stroke] :
		`!${stroke}` in strokeHandlers ? strokeHandlers[`!${stroke}`] :
		null;
	if (handler) {
		e.preventDefault();
		try {
			handler(e.target, e.shiftKey ? 'extend' : 'move');
		}
		catch (err) {
			console.error(err.stack);
		}
	}
}

function handlePanelTextInput (e) {
	if (e.isComposing) return;
	if (e.target.dataset.isComposing) return;
	commitPanelText(e.target.value);
}

function handlePanelTextCompositionStart (e) {
	e.target.dataset.isComposing = '1';
}

function handlePanelTextCompositionEnd (e) {
	delete e.target.dataset.isComposing;
	commitPanelText(e.target.value);
}

function handlePanelButtonClick (e) {
	e.preventDefault();
	commitPanelText($(`${randId}-text`).value, true);
}

function handleLinkButtonClick (e) {
	e.preventDefault();

	let meta;
	switch (e.target.href.match(/#(.+)/)[1]) {
	case MODE.LITERAL:
		meta = '\\L';
		break;
	case MODE.MIGEMO:
		meta = '\\M';
		break;
	case OPT_STRICT:
		meta = '\\C';
		break;
	}

	if (meta) {
		const text = $(`${randId}-text`);
		const tester = new RegExp(`(?<!\\\\)\\\\${meta.charAt(1)}`);
		let value = text.value;
		let ss = text.selectionStart;
		let se = text.selectionEnd;

		if (tester.test(value)) {
			let re;
			while ((re = tester.exec(value)) !== null) {
				const index = re.index;
				value = value.substring(0, index) + value.substring(index + meta.length);
				if (index <= ss) {
					ss -= meta.length;
				}
				if (index <= se) {
					se -= meta.length;
				}
			}
		}
		else {
			value = meta + value;
			ss += meta.length;
			se += meta.length;
		}
		text.value = value;
		text.selectionStart = ss;
		text.selectionEnd = se;
		commitPanelText(text.value);
	}
}

export {
	openPanel as open,
	closePanel as close,
	foundItemList,
	config,
	setHeader, setHeaderSeverity,
	setMessage, showDefaultMessage, showProcessingMessage, showFoundMessage,
	setProgress, requestCommit, isOpened,
	randId as id
};
