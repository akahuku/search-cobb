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

export function getStyle (id, style) {
	return `\
#${id} {
	position:fixed;
	box-sizing:border-box;
	width:50%;
	margin:0 auto 0 auto;
	padding:0 8px 8px 16px;
	border:none;
	border-radius:0 0 0 8px;
	box-shadow:0px 4px 15px 0px rgba(0,0,0,.3);
	background-color:rgba(255,255,255,.9);
	color:#333;
	font-size:x-small;
	font-family:system-ui;
	font-weight:normal;
	letter-spacing:normal;
	line-height:1;
	text-shadow:none;
	z-index:16777215;
}

#${id} a {
	display:inline;
}

#${id} .${id}-bar {
	margin:0 -8px 6px -16px;
	padding:0;
}

#${id} .${id}-bar > div {
	width:1%;
	height:3px;
	border:none;
	padding:0;
	background-color:#e00;
	overflow:hidden;
	transition:background-color .25s;
}

#${id} .${id}-header,
#${id} .${id}-footer {
	text-align:left;
	color:#333;
	font-size:x-small;
	font-family:system-ui;
	font-weight:normal;
	letter-spacing:normal;
	line-height:1;
	text-shadow:none;
}

#${id} .${id}-header.good {
	color:#00aa00;
}

#${id} .${id}-header.bad {
	color:#aa0000;
}

#${id} .${id}-body {
	display:flex;
	margin:4px 0 4px 0;
}

#${id} .${id}.body > * {
	margin:0;
}

#${id} .${id}-footer {
	display:flex;
}

#${id} .${id}-footer > :last-child {
	text-align:right;
}

#${id} .${id}-footer > :last-child > * {
	white-space:nowrap;
	color:#333;
	font-size:x-small;
	font-family:system-ui;
	font-weight:normal;
	letter-spacing:normal;
	line-height:1;
	text-shadow:none;
}

#${id}-message {
	padding:0 8px 0 0;
	flex-grow:1;
	color:#333;
	font-size:x-small;
	font-family:system-ui;
	font-weight:normal;
	letter-spacing:normal;
	line-height:1;
	text-shadow:none;
}

@media screen and (max-width: 800px) {
	#${id} .${id}-footer a {
		display:block;
		margin:2px 0 2px 0;
	}
}

#${id} .${id}-footer a span {
	display:inline-block;
	margin:0 2px 0 2px;
	padding:2px;
	line-height:1;
	background-color:#69c;
	color:#fff;
	border-radius:2px;
	font-size:x-small;
	font-family:monospace;
	font-weight:normal;
	letter-spacing:normal;
	line-height:1;
	text-shadow:none;
}

#${id}-text {
	box-sizing:border-box;
	width:auto;
	height:auto;
	flex-grow:1;
	margin:0 2px 0 0;
	padding:4px;
	border:1px solid silver;
	border-radius:3px;
	font-family:monospace;
	font-size:small;
}

#${id}-text:focus {
	outline:none;
}

#${id}-button {
	box-sizing:border-box;
	width:auto;
	height:auto;
	margin:0;
	padding:0 4px 0 4px;
	border:2px solid #0b57d0;
	background-color:#fff;
	color:333;
	border-radius:3px;
	font-size:x-small;
	font-family:system-ui !important;
	font-weight:normal;
	letter-spacing:normal;
	line-height:1;
	text-shadow:none;
}

#${id}-button:hover {
	background-color:#e8f0fe;
	color:#0b57d0;
}

.${id}-emphasis-A,
.${id}-emphasis-B,
.${id}-emphasis-C {
	display:inline !important;
	background-color:#ffff00 !important;
	color:#333 !important;
}

.${id}-emphasis-A.${id}-active,
.${id}-emphasis-B.${id}-active,
.${id}-emphasis-C.${id}-active {
	background-color:#ff9632 !important;
	color:#333 !important;
}

.${id}-active-border {
	position:fixed;
	background-image:url(${chrome.runtime.getURL('image/march-ants.gif')});
	border:none;
	visibility:hidden;
	z-index:16777215;
}
	`;
}
