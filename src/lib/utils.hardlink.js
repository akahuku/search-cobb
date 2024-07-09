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

export function delay (wait) {
	return new Promise(resolve => {
		setTimeout(resolve, wait);
	});
}

export function $ (id) {
	return typeof id == 'string' ? document.getElementById(id) : id;
}

export function $qs (selector, node) {
	return ($(node) || document).querySelector(selector);
}

export function $qsa (selector, node) {
	return ($(node) || document).querySelectorAll(selector);
}

export function empty (node) {
	node = $(node);
	if (!node) return;
	const r = document.createRange();
	r.selectNodeContents(node);
	r.deleteContents();
}

export function updateI18n () {
	document.querySelectorAll('[data-i18n]').forEach(node => {
		const key = node.dataset.i18n;
		const localized = chrome.i18n.getMessage(key);
		if (typeof localized == 'string' && localized != '') {
			node.textContent = localized;
		}
	});
}

export function getErrorDescription (err) {
	let result = '';
	if ('stack' in err) {
		result += err.stack;
	}
	else {
		result += err.message;
		if ('fileName' in err) {
			result += ' at ' + err.fileName;
		}
		if ('lineNumber' in err) {
			result += ':' + err.lineNumber;
		}
	}
	return result;
}

export async function load (url, options = {}, type) {
	const result = {};
	let response;

	try {
		response = await fetch(url, options);
	}
	catch (err) {
		// network error (network down, dns lookup failed...)
		result.error = 'network error: ' + getErrorDescription(err);
		return result;
	}

	if ('headers' in response) {
		const headers = {};
		for (let h of response.headers) {
			headers[h[0].toLowerCase()] = h[1];
		}
		result.headers = headers;

		if (typeof response.headers.getSetCookie == 'function') {
			result.cookies = response.headers.getSetCookie();
		}
	}

	if ('status' in response) {
		result.status = response.status;
	}

	if ('statusText' in response) {
		result.statusText = response.statusText;
	}

	if (!response.ok) {
		// server error (server down, not found, not modified...)
		result.error = `server error: ${response.statusText} (${response.status})`;
		return result;
	}

	try {
		let content;
		switch (type) {
		case 'text':
			content = await response.text();
			break;

		case 'blob':
			content = await response.blob();
			break;

		case 'arraybuffer':
			content = await response.arrayBuffer();
			break;

		case /^text\s*;\s*charset\s*=\s*(.+)$/i.test(type) && type:
			{
				const encoding = RegExp.$1;
				const blob = await response.blob();
				content = await new Promise((resolve, reject) => {
					const reader = new FileReader;
					reader.onload = () => {resolve(reader.result)};
					reader.onerror = () => {reject(reader.error.message)};
					reader.readAsText(blob, encoding);
				});
			}
			break;

		case /^data(?:\s*;\s*fold\s*=\s*(\d+))?/.test(type) && type:
			{
				const fold = RegExp.$1 ? RegExp.$1 - 0 : 0;
				const blob = await response.blob();
				content = await new Promise((resolve, reject) => {
					const reader = new FileReader;
					reader.onload = () => {
						resolve(fold === 0 ?
							reader.result :
							reader.result.replace(new RegExp(`.{${fold}}`, 'g'), '$&\n')
						);
					};
					reader.onerror = () => {reject(reader.error.message)};
					reader.readAsDataURL(blob);
				});
			}
			break;

		default:
			content = await response.json();
			break;
		}

		result.content = content;
		return result;
	}
	catch (err) {
		// response error (invalid json...)
		result.error = 'response error: ' + getErrorDescription(err);
		return result;
	}
}

/*
 * offscreen utilities
 */

export const offscreenUrl = typeof chrome != 'undefined' ?
	chrome?.runtime?.getURL?.('asset/offscreen.html') ?? '' : '';
export const offscreenCloseAlarm = typeof chrome != 'undefined' ?
	`offscreen-close-alarm-${chrome?.runtime?.id ?? ''}` : '';
let offscreenDocumentCreating;

async function hasOffscreenDocument () {
	if (typeof chrome.runtime.getContexts == 'function') {
		return await chrome.runtime.getContexts({
			contextTypes: ['OFFSCREEN_DOCUMENT'],
			documentUrls: [offscreenUrl]
		});
	}
	else {
		const matchedClients = await clients.matchAll();
		for (const client of matchedClients) {
			if (client.url === offscreenUrl) {
				return true;
			}
		}
		return false;
	}
}

async function setupOffscreenDocument () {
	if (offscreenUrl == '') {
		throw new Error('this runtime is not a chrome extension');
	}

	const existingContexts = await hasOffscreenDocument();

	if (existingContexts.length > 0) {
		return offscreenUrl;
	}

	// create offscreen document
	if (offscreenDocumentCreating) {
		await offscreenDocumentCreating;
	}
	else {
		offscreenDocumentCreating = chrome.offscreen.createDocument({
			url: offscreenUrl,
			reasons: [
				chrome.offscreen.Reason.AUDIO_PLAYBACK,
				chrome.offscreen.Reason.BLOBS
			],
			justification: 'reason for needing the document',
		});
		await offscreenDocumentCreating;
		offscreenDocumentCreating = null;
	}
	return offscreenUrl;
}

async function registerOffscreenDocumentCloser () {
	await chrome.alarms.clear(offscreenCloseAlarm);
	await chrome.alarms.create(offscreenCloseAlarm, {
		delayInMinutes: 1
	});
}

export async function openOffscreenDocument (command, params) {
	await setupOffscreenDocument();

	const existingContexts = await hasOffscreenDocument();
	let result;
	if (existingContexts.length) {
		result = await new Promise(resolve => {
			chrome.runtime.sendMessage({
				target: 'offscreen',
				log: {
					enabled: enableLogFunction,
					enableExternalLog: enableExternalLog,
					name: logName
				},
				command,
				params
			}, response => {
				resolve(response);
			});
		});
		await registerOffscreenDocumentCloser();
	}
	return result;
}

/*
 * tts function
 */

export function Speech () {
	const con = {
		voice: 'tts',
		volume: 0.5,
		pitch: 1.0,
		rate: 1.0,
		voiceTextApiKey: null,
		fallback: false
	};

	async function openPopup (params) {
		await chrome.storage.local.set({
			speechParams: params
		});

		const url = chrome.runtime.getURL('asset/speech.html');
		const popup = await chrome.windows.create({
			type: 'popup',
			focused: false,
			top: 1, left: 1,
			height: 1, width: 1,
			url
		});
		const tabId = popup.tabs[0].id;

		await Promise.all([
			chrome.storage.local.set({
				speechTab: tabId
			}),
			new Promise(resolve => {
				chrome.tabs.onRemoved.addListener(function onRemoved (tabId) {
					if (tabId == tabId) {
						chrome.tabs.onRemoved.removeListener(onRemoved);
						resolve();
					}
				})
			})
		]);
	}

	function startTTS (text) {
		return new Promise(resolve => {
			chrome.tts.speak(
				text,
				{
					lang: 'ja-JP',
					volume: con.volume,
					pitch: con.pitch,
					rate: con.rate,
					onEvent: e => {
						switch (e.type) {
						case 'end':
						case 'interrupted':
						case 'cancelled':
						case 'error':
							resolve();
							break;
						}
					},
				}
			);
		});
	}

	function startWebSpeech (text) {
		return openOffscreenDocument('speech', {
			type: 'webspeech',
			volume: con.volume,
			pitch: con.pitch,
			rate: con.rate,
			lang: 'ja-JP',
			text
		});
	}

	function startVoiceText (text, voice) {
		return openOffscreenDocument('speech', {
			type: 'voicetext',
			voice: voice,
			volume: con.volume,
			pitch: con.pitch,
			rate: con.rate,
			text
		});
	}

	function config (newconfig) {
		for (const p in con) {
			if (p in newconfig) {
				con[p] = newconfig[p];
			}
		}
		return this;
	}

	function start (text) {
		let p;

		switch (con.voice) {
		case 'voicetext/hikari':
		case 'voicetext/show':
			p = startVoiceText(text, con.voice.split('/')[1]);
			break;
		case 'webspeech':
			p = startWebSpeech(text);
			break;
		case 'tts':
			return startTTS(text);
		default:
			return Promise.reject(new Error('unknown voice type'));
		}

		if (con.fallback) {
			p = p.catch(err => {
				return startTTS(text);
			});
		}

		return p;
	}

	return {config, start};
}

export function getReadableSize (size) {
	const s = typeof size == 'string' ? size - 0 : size;
	if (typeof s != 'number' || isNaN(s) || !isFinite(s) || s < 0) return size;

	const UNIT = 1024;
	const index = Math.log(size) / Math.log(UNIT) | 0;
	if (index == 0) {
		return s == 1 ? `${s}Byte` : `${s}Bytes`;
	}

	return (s / Math.pow(UNIT, index)).toFixed(20).replace(/(\...).*/, '$1') +
		' KMGTPEZY'.charAt(index) +
		'iB';
}

export function debounce (fn, interval = 100) {
	let timerId;
	return (...args) => {
		timerId && clearTimeout(timerId);
		timerId = setTimeout(() => {
			timerId = undefined;
			fn.apply(null, args);
		}, interval);
	}
}

let logName;
let logCount = 0;
let {enableLogFunction, enableExternalLog} = (manifest => {
	return {
		// enable logging on developer mode
		enableLogFunction: !('key' in manifest),

		// enable external logging on debug manifest
		enableExternalLog: !('key' in manifest)
			&& ('version_name' in manifest)
			&& /(?:develop|debug)/.test(manifest.version_name)
	};
})(typeof chrome !== 'undefined' ? chrome.runtime?.getManifest?.() ?? {} : {});

export function log (s) {
	if (!enableLogFunction) return;

	// append log index
	s = `[${++logCount}] ${s}`;

	// append logged date&time
	const now = new Date;
	s = `${now.toLocaleTimeString()}.${('000' + now.getMilliseconds()).substr(-3)}\t${s}`;

	// ###DEBUG CODE START###
	if (enableExternalLog) {
		try {
			fetch('http://dev.appsweets.net/extension-beacon/index.php', {
				method: 'POST',
				mode: 'cors',
				body: new URLSearchParams({
					message: s,
					name: logName ?? ''
				})
			});
		}
		catch (e) {
			console.log(s);
		}
	}
	else {
		console.log(s);
	}

	return;
	// ###DEBUG CODE END###
	console.log(s);
}

log.config = con => {
	if ('enabled' in con) {
		enableLogFunction = !!con.enabled;
	}
	if ('enableExternalLog' in con) {
		enableExternalLog = !!con.enableExternalLog;
	}
	if ('name' in con) {
		logName = con.name;
	}
};

export function createFormData (data) {
	const result = new URLSearchParams;

	for (const name in data) {
		result.append(name, data[name]);
	}

	return result;
}

export function parseJson (s, defaultValue) {
	let result;
	if (s !== undefined && s !== '') {
		try {
			result = JSON.parse(s);
		}
		catch (err) {
			result = undefined;
		}
	}
	return result;
}

// vim:set ts=4 sw=4 fenc=UTF-8 ff=unix ft=javascript fdm=marker fmr=<<<,>>> :
