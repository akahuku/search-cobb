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

export const MODE_REGEX = 'regex';
export const MODE_MIGEMO = 'migemo';
export const MODE_LITERAL = 'literal';
export const MODE = {
	REGEX: MODE_REGEX,
	MIGEMO: MODE_MIGEMO,
	LITERAL: MODE_LITERAL
};
export const OPT_STRICT = 'strict';
export const HIST_MAX = 100;
export const MATCH_MAX = 1000;
export const MATCH_FRAGMENT_MAX_LENGTH = 200;

/*
 * functions
 */

export function esc (s) {
	if (typeof s !== 'string') return '<N/A>';
	return s.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}

export function tag (e) {
	if (e?.nodeType === 1) return esc(e.outerHTML.match(/^<[^>]*>/)[0]);
	if (e?.nodeType === 3) return esc(`#text "${e.nodeValue}"`);
	return '<N/A>';
}

export function sendNotifyMessage (message) {
	chrome.runtime.sendMessage(message).catch(() => {})
}

export function log (content, sendToBackground) {
	if (sendToBackground && typeof chrome === 'object') {
		sendNotifyMessage({type: 'log', log: `content: ${content}`});
	}
	else {
		const now = new Date;
		const h = `00${now.getHours()}`.substr(-2);
		const m = `00${now.getMinutes()}`.substr(-2);
		const s = `00${now.getSeconds()}`.substr(-2);
		console.log(`${h}:${m}:${s} ${content}`);
	}
}

export function _ (message, ...args) {
	return chrome.i18n.getMessage(message, args);
}
