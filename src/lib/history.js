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

export function ShellHistory () {
	let historyMax = 100;
	let getHistoryHandler, saveHistoryHandler;
	let getInputHandler, setInputHandler;
	let index, histories;

	async function applyConfig (config) {
		historyMax = config.historyMax ?? historyMax;

		getHistoryHandler = config.getHistory;
		saveHistoryHandler = config.saveHistory;
		getInputHandler = config.getInput;
		setInputHandler = config.setInput;

		await getHistory();
		setInput(histories[histories.length - 1]);
	}

	async function getHistory () {
		if (histories === undefined) {
			histories = await getHistoryHandler();
			if (!Array.isArray(histories) || histories.length === 0) {
				histories = [''];
			}
			index = histories.length - 1;
		}
	}

	async function saveHistory () {
		await saveHistoryHandler(histories);
	}

	function getInput () {
		return getInputHandler();
	}

	function setInput (text) {
		setInputHandler(text);
	}

	async function back () {
		if (typeof index !== 'number' || index >= histories.length) {
			index = histories.length - 1;
		}

		const input = getInput();
		while (index > 0) {
			index--;
			if (input.value !== histories[index]) {
				setInput(histories[index]);
				break;
			}
		}
	}

	async function advance () {
		if (typeof index !== 'number' || index >= histories.length) {
			index = histories.length - 1;
		}

		const input = getInput();
		while (index < histories.length - 1) {
			index++;
			if (input.value !== histories[index]) {
				setInput(histories[index]);
				break;
			}
		}
	}

	async function updateCurrentEntry (text) {
		histories[histories.length - 1] = text ?? getInput().value;
		await saveHistory();
	}

	async function addEntry (text) {
		await updateCurrentEntry();

		text = text ?? getInput().value;
		for (let i = 0; i < histories.length - 1; i++) {
			if (histories[i] === text) {
				histories.splice(i, 1);
				i--;
			}
		}
		histories.push(text);

		if (histories.length > historyMax) {
			histories.splice(0, histories.length - historyMax);
		}

		index = histories.length - 1;
		await saveHistory();
	}

	return {
		back, advance, updateCurrentEntry, addEntry, applyConfig,
		get historyMax () {
			return historyMax;
		},
		get lines () {
			return histories;
		},
		get lastLine () {
			return histories ? histories[histories.length - 1] : '';
		},
		get index () {
			return index;
		}
	};
}
