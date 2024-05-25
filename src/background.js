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

import {log} from './lib/utils.js';
import * as jsmigemo from './lib/jsmigemo.js';

log.config({name: 'sachico'});

/*
 * consts
 */

const interceptMap = {
	shift_control_n_intercept: {
		emulateDefault: () => {
			chrome.windows.create({incognito: true});
		}
	},
	control_n_intercept: {
		emulateDefault: () => {
			chrome.windows.create({});
		}
	},
	control_t_intercept: {
		emulateDefault: () => {
			chrome.tabs.create({});
		}
	}
};

/*
 * variables
 */

let migemo;

/*
 * functions
 */

function loadMigemoDict () {
	return fetch(chrome.runtime.getURL('dict/migemo-compact-dict'))
		.then(response => response.arrayBuffer());
}

async function handleMigemoQuery (query) {
	if (migemo === undefined) {
		try {
			migemo = new jsmigemo.Migemo;
			migemo.setRxop([
				'|', '(?:', ')', '[', ']', '',
				'\\.[]{}()*+?^$|'
			]);
			migemo.setDict(new jsmigemo.CompactDictionary(await loadMigemoDict()));
		}
		catch (err) {
			migemo = null;
		}
	}
	if (migemo !== null) {
		return migemo.query(query);
	}
	else {
		return null;
	}
}

async function handleCommand (command) {
	try {
		const tabs = await chrome.tabs.query({currentWindow: true, active: true});
		if (!Array.isArray(tabs)) return;
		if (tabs.length === 0) return;

		if (/_intercept$/.test(command)) {
			const result = await chrome.tabs.sendMessage(
				tabs[0].id, {command}).catch(err => {});

			if (!result) {
				interceptMap[command].emulateDefault();
			}
		}
		else {
			await chrome.tabs.sendMessage(
				tabs[0].id, {
					command,
					randKey: crypto.randomUUID()
				}).catch(err => {});
		}
	}
	catch (err) {
		log(`commands.onCommand: ${err.stack}`);
	}
}

/*
 * event handlers
 */

chrome.commands.onCommand.addListener(command => {
	handleCommand(command);
});

chrome.action.onClicked.addListener(tab => {
	chrome.tabs.sendMessage(tab.id, {command: 'popup_clicked'}, {frameId: 0}).catch(err => {
		log(`action.onClicked: ${err.stack}`);
	});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	switch (message.type) {
	case 'migemoQuery':
		handleMigemoQuery(message.query)
			.then(migemoQuery => {
				sendResponse({migemoQuery});
			})
			.catch(err => {
				log(`onMessage(${message.type}): ${err.stack}`);
			});
		break;

	case 'log':
		log(message.log);
		break;
	}
	return true;
});

log('*** Page Search background service worker started ***');

// vim:set ts=4 sw=4 fenc=UTF-8 ff=unix ft=javascript fdm=marker fmr=<<<,>>> :
