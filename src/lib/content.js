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

/*
 * consts
 */

const interceptMap = {
	shift_control_n_intercept: {
		bubbles: true,
		cancelable: true,
		key: 'N',
		code: 'KeyN',
		shiftKey: true,
		ctrlKey: true,
		charCode: 0,
		keyCode: 78,
		which: 78
	},
	control_n_intercept: {
		bubbles: true,
		cancelable: true,
		key: 'n',
		code: 'KeyN',
		ctrlKey: true,
		charCode: 0,
		keyCode: 110,
		which: 110
	},
	control_t_intercept: {
		bubbles: true,
		cancelable: true,
		key: 't',
		code: 'KeyT',
		ctrlKey: true,
		charCode: 0,
		keyCode: 116,
		which: 116
	}
};

/*
 * variables
 */

let MATCH_MAX, MATCH_FRAGMENT_MAX_LENGTH;
let sessionKey;
let esc, tag, log, debounce;
let mutob, search, panel;
let searchInfo = {promise: undefined, data: undefined};

/*
 * functions
 */

function isContentEditable (el) {
	if (!el) return false;
	if (el.isContentEditable) return true;
	if (el.tagName === 'TEXTAREA') return !el.readOnly;
	if (el.tagName === 'INPUT') {
		if (el.readOnly) return false;
		return typeof el.selectionStart === 'number';
	}

	return false;
}

/*
 * event handlers
 */

function handleKeyDown (e) {
	if (panel && !e.target.id.includes(panel.id)
	 && !e.shiftKey && !e.altKey && !e.isComposing
	 && (e.key === 'Escape' && !e.ctrlKey || e.key === '[' && e.ctrlKey)) {
		handleEscape();
	}
}

function handleOpen () {
	mutob.disconnect();
}

function handleProgress (percent) {
}

async function handleCommitText (text, detail) {
	if (searchInfo.promise) {
		panel.setProgress(100);
	}
	else {
		searchInfo.promise = search.getSearchInfo(detail, {onProgress: panel.setProgress})
			.then(si => {
				if (searchInfo.promise) {
					searchInfo.data = si;
					panel.requestCommit();
					return searchInfo.data;
				}
			});
	}

	if (text === '') {
		panel.showDefaultMessage();
		return;
	}

	let pattern, matched = 0;
	try {
		pattern = await search.getPattern(
			text,
			detail.isFinal && searchInfo.data ? searchInfo.data.sets[0].text : null,
			{extendDot: true, ...detail});
	}
	catch (err) {
		console.error(err.message);
		panel.setHeaderSeverity(err.message, true);
		return;
	}

	if (detail.isFinal) {
		if (!searchInfo.data) {
			panel.showProcessingMessage();
			return;
		}

		const si = searchInfo.data;
		search.dumpSearchInfo(si);

		panel.foundItemList.open();
		try {
			loop: for (let i = 0; i < si.sets.length; i++) {
				const set = si.sets[i];

				try {
					pattern = await search.getPattern(
						text,
						set.text,
						{extendDot: true, ...detail});
				}
				catch (err) {
					console.error(err.message);
					panel.setHeaderSeverity(err.message, true);
					return;
				}

				let lastMatch, lastMatchLength;
				for (let re of search.execLoop(pattern, set.text, MATCH_FRAGMENT_MAX_LENGTH)) {
					/*
					 * combine a series of matches with only one grapheme into a chunk
					 */
					if (lastMatch
					 && lastMatch.index + lastMatch[0].length === re.index
					 && re.graphemes.length === 1
					 && lastMatchLength + re.graphemes.length <= MATCH_FRAGMENT_MAX_LENGTH) {
						panel.foundItemList.removeLast();
						lastMatch[0] += re[0];
						lastMatchLength += re.graphemes.length;
						re = lastMatch;
					}
					else {
						lastMatch = re;
						lastMatchLength = re.graphemes.length;
					}

					const range = search.getFoundItemRange(re, si, i);
					if (!range) {
						const range2 = search.getFoundItemRange(re, si, i);
						console.dir(range2);
						continue;
					}

					//console.dir(range);

					panel.foundItemList.add(range);
					if (++matched > MATCH_MAX) break loop;
				}

				//console.log(`#${i} text: "${set.text}"`);
			}
		}
		finally {
			panel.foundItemList.close();
			//panel.foundItemList.dump(si);
			matched = panel.foundItemList.length;
		}
	}
	else if (searchInfo.data) {
		matched = searchInfo.data.sets.reduce((result, set) => {
			return result + (set.text.match(pattern)?.length ?? 0);
		}, 0);
	}

	panel.foundItemList.revert();

	if (matched) {
		panel.foundItemList.emphasis();
		panel.foundItemList.activate();
		matched = panel.foundItemList.length ?? matched;
	}

	panel.showFoundMessage(matched);
}

function handleCommitNext () {
	panel.foundItemList.activateNext();
}

function handleCommitPrevious () {
	panel.foundItemList.activatePrevious();
}

function handleEscape () {
	panel.close(searchInfo.data);
	search.close();
}

function handleClose () {
	mutob.takeRecords();
	mutob.observe(document.body, {
		subtree: true,
		childList: true,
		characterData: true
	});
}

function handleMutation (list) {
	if (panel && !panel.isOpened()) {
		searchInfo.promise = searchInfo.data = undefined;
	}
}

function handleCrossdocumentMessage (e) {
	try {
		if (e.data.sessionKey !== sessionKey) {
			console.log([
				`*** handleCrossdocumentMessage ***`,
				`!!! invalid sessionKey !!!`
			].join('\n'));
			return;
		}

		switch (e.data.command) {
		case 'getSearchTarget':
			(async () => {
				const search = await import('./search.js');
				search.setSessionKey(sessionKey);
				searchInfo.promise = search.getSearchInfo(e.data.detail);
				searchInfo.data = await searchInfo.promise;
				e.source.postMessage({
					unified: searchInfo.data.unified,
					sets: [
						{
							type: 'iframe',
							lines: searchInfo.data.sets[0].lines,
							text: searchInfo.data.sets[0].text,
							positions: null
						}
					]
				}, e.origin);
			})();
			break;
		}
	}
	catch (err) {
		console.error(err.stack);
	}
}

async function handleMessage (request, sendResponse) {
	switch (request.command) {
	case 'popup_clicked':
	case 'open_search_panel':
		{
			if (isContentEditable(document.activeElement)) {
				return;
			}

			sessionKey = request.randKey;

			if (window.parent !== window) {
				window.addEventListener('message', handleCrossdocumentMessage);
			}
			else {
				if (!panel) {
					await Promise.all([
						import('./common.js').then(module => {
							({esc, tag, log, MATCH_MAX, MATCH_FRAGMENT_MAX_LENGTH} = module);
						}),
						import('./utils.js').then(module => {
							({debounce} = module);
						}),
						import('./search.js').then(module => {
							search = module;
						}),
						import('./panel.js').then(module => {
							panel = module;
						})
					]);
					panel.config({
						onOpen: handleOpen,
						onCommitText: handleCommitText,
						onCommitNext: handleCommitNext,
						onCommitPrevious: handleCommitPrevious,
						onEscape: handleEscape,
						onClose: handleClose
					});
					search.setSessionKey(sessionKey);
					search.exceptElementIds.add(panel.id);
					mutob = new MutationObserver(debounce(handleMutation, 1000));
				}
				await panel.open();
			}
		}
		break;

	case 'shift_control_n_intercept':
	case 'control_n_intercept':
	case 'control_t_intercept':
		{
			const dict = interceptMap[request.command];
			const keyEvents = ['keydown', 'keypress', 'keyup'];

			// emulate capturing phase
			const capturingResult = keyEvents.reduce((result, eventName) => {
				let consumed;
				try {
					const kev = new KeyboardEvent(eventName, dict);
					consumed = window.dispatchEvent(kev) === false;
				}
				catch {
					consumed = false;
				}
				return result | consumed;
			}, 0);
			if (capturingResult) return capturingResult;

			// emulate bubbling phase
			const bubblingResult = keyEvents.reduce((result, eventName) => {
				let consumed;
				try {
					const kev = new KeyboardEvent(eventName, dict);
					consumed = document.activeElement.dispatchEvent(kev) === false;
				}
				catch {
					consumed = false;
				}
				return result | consumed;
			}, 0);
			return bubblingResult;
		}
		break;
	}
}

export function run () {
	document.addEventListener('keydown', handleKeyDown, true);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	let response = true;
	handleMessage(request)
		.then(resp => {
			if (resp !== undefined) {
				response = resp;
			}
		})
		.catch(err => {
			console.error(`exception ${err.stack}`);
		})
		.finally(() => {
			sendResponse(response);
		});
	return true;
});
