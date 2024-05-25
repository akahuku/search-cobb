import assert from 'node:assert/strict';

import {JSDOM} from 'jsdom';

import {ShellHistory} from '../src/lib/history.js';

describe('history', () => {
	let input;
	let lines;
	let history;

	beforeEach(async () => {
		input = {
			value: '',
			setSelectionRange: () => {}
		};
		lines = [];

		history = new ShellHistory;
		await history.applyConfig({
			historyMax: 3,

			async getHistory () {
				return lines;
			},
			async saveHistory (alines) {
				lines = alines;
			},
			getInput () {
				return input;
			},
			setInput (text) {
				input.value = text;
			}
		});
	});

	it('update last text', async () => {
		input.value = 'update last text';
		await history.updateCurrentEntry();
		assert.deepEqual(lines, ['update last text']);
	});

	it('add history entry', async () => {
		input.value = 'foo'; await history.addEntry();
		assert.deepEqual(lines, ['foo', 'foo']);

		input.value = 'bar'; await history.addEntry();
		input.value = 'baz'; await history.addEntry();
		input.value = 'bax'; await history.addEntry();
		assert.deepEqual(lines, ['baz', 'bax', 'bax']);
		assert.equal(history.index, 2);
	});

	it('back history', async () => {
		input.value = 'foo'; await history.addEntry();
		input.value = 'bar'; await history.addEntry();
		/*
		 * current state:
		 *   #0 foo
		 *   #1 bar
		 *   #2 bar *
		 */

		await history.back();
		assert.equal(input.value, 'foo');
		assert.equal(history.index, 0);

		input.value = 'FOO';
		await history.updateCurrentEntry();
		assert.deepEqual(lines, ['foo', 'bar', 'FOO']);
	});

	it('advance history', async () => {
		input.value = 'foo'; await history.addEntry();
		input.value = 'bar'; await history.addEntry();
		/*
		 * current state:
		 *   #0 foo
		 *   #1 bar
		 *   #2 bar *
		 */

		await history.back();
		assert.equal(input.value, 'foo');
		assert.equal(history.index, 0);

		await history.advance();
		assert.equal(input.value, 'bar');
		assert.equal(history.index, 1);
	});
});
