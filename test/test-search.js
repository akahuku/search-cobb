import assert from 'node:assert/strict';

import {JSDOM} from 'jsdom';

import {esc, tag} from '../src/lib/common.js';
import {
	blockWalk, findPosition,
	getSearchInfo, dumpSearchInfo,
	getFoundItemRange,
	execLoop
} from '../src/lib/search.js';

/*
 * asserts:
 *   equal(actual, expected[, message])
 */

function setupDocument (html) {
	const dom = new JSDOM(html);
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	globalThis.Element = dom.window.Element;
	globalThis.Node = dom.window.Node;
	globalThis.Text = dom.window.Text;
	globalThis.window.Element.prototype.checkVisibility = () => {
		return true;
	};
	globalThis.window.Element.prototype.getBoundingClientRect = () => {
		return {
			x: 0, y: 0,
			left: 0, right: 0,
			top: 0, bottom: 0,
			width: 1, height: 1
		};
	};
	globalThis.window.getComputedStyle = node => {
		const style = {
			display: /^(?:body|div|p|h[1-6])$/i.test(node.nodeName) ?
				'block' :
				'inline',
			position: 'static',
			marginRight: '0px',
			paddingRight: '0px',
			borderRightStyle: 'none',
			borderRightWidth: '0px',

			marginLeft: '0px',
			paddingLeft: '0px',
			borderLeftStyle: 'none',
			borderLeftWidth: '0px',
		};

		const inlineStyle = node.getAttribute('style');
		if (typeof inlineStyle === 'string') {
			for (const s of inlineStyle.split(/\s*;\s*/)) {
				const re = /^\s*([^:\s]+)\s*:\s*(.+)/.exec(s);
				if (re) {
					switch (re[1]) {
					case 'position':
						style[re[1]] = re[2];
						break;
					}
				}
			}
		}

		return style;
	};
}

function terminateDocument () {
	delete globalThis.window;
	delete globalThis.document;
	delete globalThis.Element;
	delete globalThis.Node;
	delete globalThis.Text;
}

function setupDefaultDocument () {
	setupDocument(`
<html>
	<body>
		<h1>h1 <b>head</b>ing</h1>
		<div>oüter paragraph #1<p>paragraph</p> outer paragraph #2</div>
	</body>
</html>
	`);
	const div = document.querySelector('div');
	div.insertBefore(document.createTextNode('!!'), div.firstChild);
}

describe('blockWalk', () => {
	afterEach(terminateDocument);

	it('ensure TreeWalker', () => {
		setupDocument('<html>hello, world</html>');
		assert.ok(typeof document.createTreeWalker, 'function');
		assert.ok(typeof window, 'object');
		assert.ok(typeof window.NodeFilter, 'object');
	});

	it('iteration #1', async () => {
		setupDefaultDocument();

		const result = [];
		for await (const nodeInfo of blockWalk(document.body)) {
			switch (nodeInfo.type) {
			case 'block':
				result.push(`block: ${tag(nodeInfo.node)}`);
				break;
			case 'text':
				result.push(`text: "${esc(nodeInfo.node.nodeValue)}" in ${tag(nodeInfo.root)}`);
				break;
			}
		}

		const expected = [
			'text: "\\n\\t\\t" in <body>',
			'block: <h1>',
			'text: "h1 " in <h1>',
			'text: "head" in <h1>',
			'text: "ing" in <h1>',
			'block: <body>',
			'text: "\\n\\t\\t" in <body>',
			'block: <div>',
			'text: "!!" in <div>',
			'text: "oüter paragraph #1" in <div>',
			'block: <p>',
			'text: "paragraph" in <p>',
			'block: <div>',
			'text: " outer paragraph #2" in <div>'
		];
		for (let i = 0; i < expected.length; i++) {
			assert.equal(result[i], expected[i], `#${i}`);
		}
	});

	it('iteration #2', async () => {
		setupDocument(`
<html>
	<body><header id="header"><div id="header-lead"><h1><a href="#"><span>#1</span><span>#2</span></a></h1></div>#3</header><p>!?</p></body>
</html>
		`);
		const result = [];
		for await (const nodeInfo of blockWalk(document.body)) {
			switch (nodeInfo.type) {
			case 'block':
				result.push(`block: ${tag(nodeInfo.node)}`);
				break;
			case 'text':
				result.push(`text: "${esc(nodeInfo.node.nodeValue)}" in ${tag(nodeInfo.root)}`);
				break;
			}
		}

		const expected = [
			'block: <div id="header-lead">',
			'block: <h1>',
			'text: "#1" in <h1>',
			'text: "#2" in <h1>',
			'block: <div id="header-lead">',
			'block: <body>',
			'text: "#3" in <body>',
			'block: <p>',
			'text: "!?" in <p>'
		];
		for (let i = 0; i < expected.length; i++) {
			assert.equal(result[i], expected[i], `#${i}`);
		}
	});

	it('iteration #3', async () => {
		setupDocument(`
<html>
	<body><div id="header" style="position:fixed">header contents</div><div id="marker" style="position:absolute">absolute contents<p>paragraph in absolute element</p></div><p>main contents</p><p>more main contents</p>
</html>
		`);
		const result = [];
		for await (const nodeInfo of blockWalk(document.body)) {
			switch (nodeInfo.type) {
			case 'block':
				result.push(`block(${nodeInfo.position}): ${tag(nodeInfo.node)}`);
				break;
			case 'text':
				result.push(`text(${nodeInfo.position}): "${esc(nodeInfo.node.nodeValue)}" in ${tag(nodeInfo.root)}`);
				break;
			}
		}
		console.log(result.join('\n'));
	});
});

describe('findPosition', () => {
	const positions = [
		[0],
		[6],
		[20],
		[22],
		[28],
		[33],
		[38],
		[40]
	];

	function dumbFind (index) {
		for (let i = 0; i < positions.length; i++) {
			if (i === positions.length - 1 && positions[i][0] <= index
			 || positions[i][0] <= index && index < positions[i + 1][0]) {
				return i;
			}
		}
		return -1;
	}

	function dumbFindExclusive (index) {
		for (let i = 0; i < positions.length; i++) {
			if (i === positions.length - 1 && positions[i][0] < index
			 || positions[i][0] < index && index <= positions[i + 1][0]) {
				return i;
			}
		}
		return -1;
	}
	
	it(`findPosition`, () => {
		for (let i = 0; i < 50; i++) {
			assert.equal(findPosition(i, positions), dumbFind(i), `#${i}`);
		}
	});

	it(`findPosition (exclusive)`, () => {
		for (let i = 0; i < 50; i++) {
			assert.equal(findPosition(i, positions, true), dumbFindExclusive(i), `#${i}`);
		}
	});
});

describe('getSearchInfo', () => {
	afterEach(terminateDocument);

	it('getSearchInfo', async () => {
		setupDefaultDocument();
		const si = await getSearchInfo({}, {ignoreCache: true});

		const expected = [
			'h1 heading',
			'!!outer paragraph #1',
			'paragraph',
			'outer paragraph #2'
		];
		for (let i = 0; i < expected.length; i++) {
			assert.equal(si.sets[0].lines[i], expected[i], `#${i}`);
		}

		assert.equal(si.sets[0].positions.map(p => JSON.stringify(p, (k,v) => v instanceof Element ? tag(v) : v)).join('\n'), `\
[0,"<h1>",0]
[3,1,0]
[7,2]
[11,"<div>",0]
[32,"<p>",0]
[42,"<div>",2]`);
	});

	it('with set', async () => {
		setupDocument(`
<html>
	<body><div id="header" style="position:fixed">header contents</div><div id="marker" style="position:absolute">absolute contents<p>paragraph in absolute element</p></div><p>main contents</p><p>more main contents</p>
</html>
		`);

		const si = await getSearchInfo({}, {ignoreCache: true});
		assert.equal(si.sets.length, 3);
		assert.equal(si.sets[0].text, 'main contents\nmore main contents');
		assert.equal(si.sets[1].text, 'header contents');
		assert.equal(si.sets[2].text, 'absolute contents\nparagraph in absolute element');
	});
});

describe('getFoundItemRange', () => {
	afterEach(terminateDocument);

	it('multiple elements', async () => {
		setupDefaultDocument();
		const si = await getSearchInfo({}, {ignoreCache: true});
		const re = /#1.+outer/s.exec(si.sets[0].text);
		const range = getFoundItemRange(re, si, 0);

		assert.equal(range.start.textNode, document.querySelector('div').childNodes[0]);
		assert.equal(range.start.textNodeIndex, '!!oüter paragraph '.length);

		assert.equal(range.end.textNode, document.querySelector('div').childNodes[2]);
		assert.equal(range.end.textNodeIndex, ' outer'.length);
	});

	it('last character', async () => {
		setupDefaultDocument();
		const si = await getSearchInfo({}, {ignoreCache: true});
		const re = /#1/.exec(si.sets[0].text);
		const range = getFoundItemRange(re, si, 0);

		assert.equal(range.start.textNode, document.querySelector('div').childNodes[0]);
		assert.equal(range.start.textNodeIndex, '!!oüter paragraph '.length);

		assert.equal(range.end.textNode, document.querySelector('div').childNodes[0]);
		assert.equal(range.end.textNodeIndex, '!!oüter paragraph #1'.length);
	});

	it('emphasis bug #1', async () => {
		setupDocument(`<html><body><small>ID</small> / <span>16</span></body></html>`);

		const expectedData = [
			// start node, start index, end node, end index
			[
				// #0: I
				document.querySelector('small').firstChild, 0,
				document.querySelector('small').firstChild, 1,
			],
			[
				// #1: D
				document.querySelector('small').firstChild, 1,
				document.querySelector('small').firstChild, 2,
			],
			/*
			[
				// #2: U+0020,
				document.querySelector('small').nextSibling, 0,
				document.querySelector('small').nextSibling, 1,
			],
			*/
			[
				// #2: /
				document.querySelector('small').nextSibling, 1,
				document.querySelector('small').nextSibling, 2,
			],
			[
				// #3: U+0020,
				document.querySelector('small').nextSibling, 2,
				document.querySelector('small').nextSibling, 3,
			],
			[
				// #4: 1,
				document.querySelector('span').firstChild, 0,
				document.querySelector('span').firstChild, 1,
			],
			[
				// #5: 6,
				document.querySelector('span').firstChild, 1,
				document.querySelector('span').firstChild, 2,
			]
		];

		const detail = {mode: 'regex'};
		const si = await getSearchInfo(detail, {ignoreCache: true});
		const pattern = /./g;
		let i = 0;

		for (const re of execLoop(pattern, si.sets[0].text)) {
			const actual = getFoundItemRange(re, si, 0);
			const e = expectedData[i];
			assert.equal(actual.start.textNode, e[0], `#${i} start node`);
			assert.equal(actual.start.textNodeIndex, e[1], `#${i} start node index`);
			assert.equal(actual.end.textNode, e[2], `#${i} end node`);
			assert.equal(actual.end.textNodeIndex, e[3], `#${i} end node index`);
			i++;
		}

		assert.equal(i, expectedData.length, 'number of found items');
	});

	it('emphasis bug #2', async () => {
		setupDocument(`<html><body><span>foo</span> bar</body></html>`);
		const detail = {mode: 'regex'};
		const si = await getSearchInfo(detail, {ignoreCache: true});
		const pattern = /bar/g;
		const actual = getFoundItemRange(pattern.exec(si.sets[0].text), si, 0);
		assert.equal(actual.start.textNode.nodeValue.substring(
			actual.start.textNodeIndex,
			actual.end.textNodeIndex), 'bar');
	});

	it('emphasis bug #3', async () => {
		// 0 2 4 6 8 10
		// ㉑㉒㉓͔㉔㉚㉛
		setupDocument(`<html><body>\u3251\n\u3252\n\u3253\n\u3254\n\u325A\n\u325B</body></html>`);
		const detail = {mode: 'regex'};
		const si = await getSearchInfo(detail, {ignoreCache: true});
		const pattern = /3/g;

		const actual1 = getFoundItemRange(pattern.exec(si.sets[0].text), si, 0);
		assert.equal(actual1.start.textNodeIndex, 4);
		assert.equal(actual1.end.textNodeIndex, 5);
		assert.equal(actual1.start.textNode.nodeValue.substring(
			actual1.start.textNodeIndex,
			actual1.end.textNodeIndex), '\u3253');

		const actual2 = getFoundItemRange(pattern.exec(si.sets[0].text), si, 0);
		assert.equal(actual2.start.textNodeIndex, 8);
		assert.equal(actual2.end.textNodeIndex, 9);
		assert.equal(actual2.start.textNode.nodeValue.substring(
			actual2.start.textNodeIndex,
			actual2.end.textNodeIndex), '\u325A');
	});

	it('emphasis bug #4', async () => {
		setupDocument(`<html><body>丸囲みの数字13： (白)<em>&#9324;</em> , (黒)<em>&#9453;</em></body></html>`);
		const detail = {mode: 'regex'};
		const si = await getSearchInfo(detail, {ignoreCache: true});
		const pattern = /3/g;

		//console.log(`     raw body: "${esc(document.body.innerHTML)}"`);
		//console.log(`compiled body: "${esc(si.sets[0].text)}"`);

		const actual1 = getFoundItemRange(pattern.exec(si.sets[0].text), si, 0);
		assert.equal(actual1.start.textNodeIndex, 7);
		assert.equal(actual1.end.textNodeIndex, 8);
		assert.equal(actual1.start.textNode.nodeValue.substring(
			actual1.start.textNodeIndex,
			actual1.end.textNodeIndex), '3');

		const actual2 = getFoundItemRange(pattern.exec(si.sets[0].text), si, 0);
		assert.equal(actual2.start.textNodeIndex, 0);
		assert.equal(actual2.end.textNodeIndex, 1);
		assert.equal(actual2.start.textNode.nodeValue.substring(
			actual2.start.textNodeIndex,
			actual2.end.textNodeIndex), '\u246c');
	});
});

describe('some RegExp tweaks', () => {
	function limitExec (pattern, text, limit = 10) {
		const result = [];
		for (const re of execLoop(pattern, text, limit)) {
			result.push(re[0]);
		}
		return result;
	}

	it('should be devided by limit length', () => {
		const limit = 10;
		const text = 'ae\u0301u\u0308'.repeat(100);
		const result = limitExec(/.*/gu, text, limit);
		assert.equal(result.length, Math.ceil([...(new Intl.Segmenter).segment(text)].length / limit));
	});
});
