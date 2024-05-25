import assert from 'node:assert/strict';

import {JSDOM} from 'jsdom';

import {
	foundItemList
} from '../src/lib/panel.js';

function setupDocument (html) {
	const dom = new JSDOM(html);
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	globalThis.Element = dom.window.Element;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.Node = dom.window.Node;
	globalThis.Text = dom.window.Text;
	globalThis.Range = dom.window.Range;
	globalThis.window.Element.prototype.checkVisibility = () => {
		return true;
	};
	globalThis.window.Element.prototype.getBoundingClientRect = globalThis.Range.prototype.getBoundingClientRect = () => {
		return {
			x: 0, y: 0,
			left: 0, right: 0,
			top: 0, bottom: 0,
			width: 1, height: 1
		};
	};
	globalThis.window.getComputedStyle = node => {
		return {
			display: /^(?:body|div|p|h[1-6])$/i.test(node.nodeName) ?
				'block' :
				'inline',
			marginRight: '0px',
			paddingRight: '0px',
			borderRightStyle: 'none',
			borderRightWidth: '0px',

			marginLeft: '0px',
			paddingLeft: '0px',
			borderLeftStyle: 'none',
			borderLeftWidth: '0px',
		}
	};
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

function terminateDocument () {
	delete globalThis.window;
	delete globalThis.document;
	delete globalThis.Element;
	delete globalThis.Node;
	delete globalThis.Text;
	delete globalThis.Range;
}

function dumpChildren (node) {
	console.log('*'.repeat(30));
	console.log(`outerHTML: "${node.outerHTML}"`);
	for (let i = 0; i < node.childNodes.length; i++) {
		console.log(`childNodes[${i}]: "${node.childNodes[i].outerHTML ?? node.childNodes[i].nodeValue}"`);
	}
}

describe('emphasis', () => {
	afterEach(terminateDocument);

	it('emphasis single node, class A', () => {
		setupDocument('<html><p>thisisTEXTnode</p></html>');

		// <<<
		const p = document.querySelector('p');
		foundItemList.open();
		foundItemList.add({
			start: {
				textNode: p.firstChild,
				positionIndex: 0,
				textNodeIndex: 6
			},
			end: {
				textNode: p.firstChild,
				positionIndex: 0,
				textNodeIndex: 10
			}
		});
		foundItemList.close();

		// emphasis
		foundItemList.emphasis();
		assert.match(
			document.body.innerHTML,
			/<p>thisis<span[^>]+>TEXT<\/span>node<\/p>/, 'em#innerHTML');
		assert.match(
			p.querySelector('span').className,
			/-emphasis-A$/, 'em#className');
		assert.equal(
			p.childNodes.length,
			3, 'em#number of child nodes');
		assert.equal(
			foundItemList.length,
			1, 'em#number of found items');
		// >>>
	});

	it('emphasis single node, class B', () => {
		setupDocument('<html><p></p></html>');

		// <<<
		const p = document.querySelector('p');
		p.appendChild(document.createTextNode('thisis'));
		p.appendChild(document.createTextNode('TEXT'));
		p.appendChild(document.createTextNode('node'));
		foundItemList.open();
		foundItemList.add({
			start: {
				textNode: p.childNodes[1],
				positionIndex: 0,
				textNodeIndex: 0
			},
			end: {
				textNode: p.childNodes[1],
				positionIndex: 0,
				textNodeIndex: 4
			}
		});
		foundItemList.close();

		// emphasis
		foundItemList.emphasis();
		assert.match(
			document.body.innerHTML,
			/<p>thisis<span[^>]+>TEXT<\/span>node<\/p>/, 'em#innerHTML');
		assert.match(
			p.querySelector('span').className,
			/-emphasis-B$/, 'em#className');
		assert.equal(
			p.childNodes.length,
			3, 'em#number of child nodes');
		assert.equal(
			foundItemList.length,
			1, 'em#number of found items');
		// >>>
	});

	it('emphasis multiple ranges in single node, class A', () => {
		setupDocument('<html><p>thisisTEXTnode</p></html>');

		// <<<
		const p = document.querySelector('p');
		foundItemList.open();
		foundItemList.add({
			start: {
				textNode: p.firstChild,
				positionIndex: 0,
				textNodeIndex: 6
			},
			end: {
				textNode: p.firstChild,
				positionIndex: 0,
				textNodeIndex: 8
			}
		});
		foundItemList.add({
			start: {
				textNode: p.firstChild,
				positionIndex: 0,
				textNodeIndex: 8
			},
			end: {
				textNode: p.firstChild,
				positionIndex: 0,
				textNodeIndex: 10
			}
		});
		foundItemList.close();

		// emphasis
		foundItemList.emphasis();
		assert.match(
			document.body.innerHTML,
			/<p>thisis<span[^>]+>TE<\/span><span[^>]+>XT<\/span>node<\/p>/, 'em#innerHTML');
		assert.match(
			p.querySelector('span').className,
			/-emphasis-A$/, 'em#className');
		assert.equal(
			p.childNodes.length,
			4, 'em#number of child nodes');
		assert.equal(
			foundItemList.length,
			2, 'em#number of found items');
		// >>>
	});

	it('emphasis multiple nodes, class A', () => {
		setupDocument('<html><div>thisis<p>TEXT</p>node</div></html>');

		// <<<
		const div = document.querySelector('div');
		foundItemList.open();
		foundItemList.add({
			start: {
				textNode: div.firstChild,
				positionIndex: 0,
				textNodeIndex: 4
			},
			end: {
				textNode: div.lastChild,
				positionIndex: 0,
				textNodeIndex: 2
			}
		});
		foundItemList.close();

		foundItemList.emphasis();

		assert.match(document.body.innerHTML, /<div>this<span[^>]+>is<\/span><p[^>]+>TEXT<\/p><span[^>]+>no<\/span>de<\/div>/, 'em#1');
		assert.match(div.childNodes[1].className, /-emphasis-A$/, 'em#2');
		assert.match(div.childNodes[2].className, /-emphasis-C$/, 'em#3');
		assert.match(div.childNodes[3].className, /-emphasis-A$/, 'em#4');
		assert.equal(div.childNodes.length, 5, 'em#5');
		// >>>
	});

	it('emphasis multiple nodes, class B', () => {
		setupDocument('<html><div>thisis<p>TEXT</p>node</div></html>');

		// <<<
		const div = document.querySelector('div');
		foundItemList.open();
		foundItemList.add({
			start: {
				textNode: div.firstChild,
				positionIndex: 0,
				textNodeIndex: 0
			},
			end: {
				textNode: div.lastChild,
				positionIndex: 0,
				textNodeIndex: 4
			}
		});
		foundItemList.close();

		foundItemList.emphasis();

		assert.match(document.body.innerHTML, /<div><span[^>]+>thisis<\/span><p[^>]+>TEXT<\/p><span[^>]+>node<\/span><\/div>/, 'em#1');
		assert.match(div.childNodes[0].className, /-emphasis-B$/, 'em#2');
		assert.match(div.childNodes[1].className, /-emphasis-C$/, 'em#3');
		assert.match(div.childNodes[2].className, /-emphasis-B$/, 'em#4');
		assert.equal(div.childNodes.length, 3, 'em#5');
	});
});

describe('Range#surroundingContents', () => {
	afterEach(terminateDocument);

	/*
	 * range
	 * #####
	 * abcdeFGHIJKL  -->  #(empty text node) <span>abcde</span> #FGHIJKL
	 * ^    ^             ^
	 * st   |             st,ed
	 *      |
	 *      ed
	 */
	it('surround a leading text', async () => {
		setupDefaultDocument();
		const div = document.querySelector('div');
		let startText = div.childNodes[1];
		let endText = startText;
		const wrap = document.createElement('span');
		const r = document.createRange();
		r.setStart(startText, 0);
		r.setEnd(endText, 6);
		r.surroundContents(wrap);

		assert.equal(startText.nodeValue, '');
		assert.equal(endText.nodeValue, '');

		div.normalize();
		dumpChildren(div);

		r.selectNodeContents(wrap);
		const parent = wrap.parentNode;
		const df = r.extractContents();
		parent.insertBefore(df, wrap);
		startText = wrap.previousSibling;
		parent.removeChild(wrap);

		if (startText.nextSibling?.nodeType === 3) {
			const next = startText.nextSibling;
			startText.nodeValue += next.nodeValue;
			next.parentNode.removeChild(next);
			endText = startText;
		}

		console.log([
			'*** after revert ***',
			`start: "${startText.nodeValue}"`,
			`  end: "${endText.nodeValue}"`
		].join('\n'));

		dumpChildren(div);
	});

	/*
	 *    range
	 *    #####
	 * abcDEFGHijkl  -->  #abc <span>DEFHI</span> #ijkl
	 *    ^    ^          ^
	 *    st   |          st,ed
	 *         |
	 *         ed
	 */
	it('surround a middle text', async () => {
		setupDefaultDocument();
		const div = document.querySelector('div');
		const startText = div.childNodes[1];
		const endText = startText;
		const wrap = document.createElement('span');
		const r = document.createRange();
		r.setStart(startText, 7);
		r.setEnd(endText, 11);
		r.surroundContents(wrap);

		assert.equal(startText.nodeValue, 'oüter ');
		assert.equal(endText.nodeValue, 'oüter ');
	});

	/*
	 *        range
	 *        #####
	 * abcdefgHIJKL  -->  #abcdefg <span>HIJKL</span> #(empty text node)
	 *        ^    ^      ^
	 *        st   |      st,ed
	 *             |
	 *             ed
	 */
	it('surround a bottom text', async () => {
		setupDefaultDocument();
		const div = document.querySelector('div');
		const startText = div.childNodes[1];
		const endText = startText;
		const wrap = document.createElement('span');
		const r = document.createRange();
		r.setStart(startText, 17);
		r.setEnd(endText, 19);
		r.surroundContents(wrap);

		assert.equal(startText.nodeValue, 'oüter paragraph ');
		assert.equal(endText.nodeValue, 'oüter paragraph ');
	});
});

// vim:set ts=4 sw=4 fenc=UTF-8 ff=unix ft=javascript fdm=marker fmr=<<<,>>> :
