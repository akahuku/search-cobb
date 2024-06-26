/*
 * grapheme-regex.js - Returns a regular expression matching a grapheme cluster
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
 * The unicode version compatible with this source code is 15.1.0
 */
let groupCount = 0;
const gcExtendStr = "[\\u0300-\\u036F\\u0483-\\u0489\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED\\u0711\\u0730-\\u074A\\u07A6-\\u07B0\\u07EB-\\u07F3\\u07FD\\u0816-\\u0819\\u081B-\\u0823\\u0825-\\u0827\\u0829-\\u082D\\u0859-\\u085B\\u0898-\\u089F\\u08CA-\\u08E1\\u08E3-\\u0902\\u093A\\u093C\\u0941-\\u0948\\u094D\\u0951-\\u0957\\u0962\\u0963\\u0981\\u09BC\\u09BE\\u09C1-\\u09C4\\u09CD\\u09D7\\u09E2\\u09E3\\u09FE\\u0A01\\u0A02\\u0A3C\\u0A41\\u0A42\\u0A47\\u0A48\\u0A4B-\\u0A4D\\u0A51\\u0A70\\u0A71\\u0A75\\u0A81\\u0A82\\u0ABC\\u0AC1-\\u0AC5\\u0AC7\\u0AC8\\u0ACD\\u0AE2\\u0AE3\\u0AFA-\\u0AFF\\u0B01\\u0B3C\\u0B3E\\u0B3F\\u0B41-\\u0B44\\u0B4D\\u0B55-\\u0B57\\u0B62\\u0B63\\u0B82\\u0BBE\\u0BC0\\u0BCD\\u0BD7\\u0C00\\u0C04\\u0C3C\\u0C3E-\\u0C40\\u0C46-\\u0C48\\u0C4A-\\u0C4D\\u0C55\\u0C56\\u0C62\\u0C63\\u0C81\\u0CBC\\u0CBF\\u0CC2\\u0CC6\\u0CCC\\u0CCD\\u0CD5\\u0CD6\\u0CE2\\u0CE3\\u0D00\\u0D01\\u0D3B\\u0D3C\\u0D3E\\u0D41-\\u0D44\\u0D4D\\u0D57\\u0D62\\u0D63\\u0D81\\u0DCA\\u0DCF\\u0DD2-\\u0DD4\\u0DD6\\u0DDF\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E\\u0EB1\\u0EB4-\\u0EBC\\u0EC8-\\u0ECE\\u0F18\\u0F19\\u0F35\\u0F37\\u0F39\\u0F71-\\u0F7E\\u0F80-\\u0F84\\u0F86\\u0F87\\u0F8D-\\u0F97\\u0F99-\\u0FBC\\u0FC6\\u102D-\\u1030\\u1032-\\u1037\\u1039\\u103A\\u103D\\u103E\\u1058\\u1059\\u105E-\\u1060\\u1071-\\u1074\\u1082\\u1085\\u1086\\u108D\\u109D\\u135D-\\u135F\\u1712-\\u1714\\u1732\\u1733\\u1752\\u1753\\u1772\\u1773\\u17B4\\u17B5\\u17B7-\\u17BD\\u17C6\\u17C9-\\u17D3\\u17DD\\u180B-\\u180D\\u180F\\u1885\\u1886\\u18A9\\u1920-\\u1922\\u1927\\u1928\\u1932\\u1939-\\u193B\\u1A17\\u1A18\\u1A1B\\u1A56\\u1A58-\\u1A5E\\u1A60\\u1A62\\u1A65-\\u1A6C\\u1A73-\\u1A7C\\u1A7F\\u1AB0-\\u1ACE\\u1B00-\\u1B03\\u1B34-\\u1B3A\\u1B3C\\u1B42\\u1B6B-\\u1B73\\u1B80\\u1B81\\u1BA2-\\u1BA5\\u1BA8\\u1BA9\\u1BAB-\\u1BAD\\u1BE6\\u1BE8\\u1BE9\\u1BED\\u1BEF-\\u1BF1\\u1C2C-\\u1C33\\u1C36\\u1C37\\u1CD0-\\u1CD2\\u1CD4-\\u1CE0\\u1CE2-\\u1CE8\\u1CED\\u1CF4\\u1CF8\\u1CF9\\u1DC0-\\u1DFF\\u200C\\u20D0-\\u20F0\\u2CEF-\\u2CF1\\u2D7F\\u2DE0-\\u2DFF\\u302A-\\u302F\\u3099\\u309A\\uA66F-\\uA672\\uA674-\\uA67D\\uA69E\\uA69F\\uA6F0\\uA6F1\\uA802\\uA806\\uA80B\\uA825\\uA826\\uA82C\\uA8C4\\uA8C5\\uA8E0-\\uA8F1\\uA8FF\\uA926-\\uA92D\\uA947-\\uA951\\uA980-\\uA982\\uA9B3\\uA9B6-\\uA9B9\\uA9BC\\uA9BD\\uA9E5\\uAA29-\\uAA2E\\uAA31\\uAA32\\uAA35\\uAA36\\uAA43\\uAA4C\\uAA7C\\uAAB0\\uAAB2-\\uAAB4\\uAAB7\\uAAB8\\uAABE\\uAABF\\uAAC1\\uAAEC\\uAAED\\uAAF6\\uABE5\\uABE8\\uABED\\uFB1E\\uFE00-\\uFE0F\\uFE20-\\uFE2F\\uFF9E\\uFF9F\\u{101FD}\\u{102E0}\\u{10376}-\\u{1037A}\\u{10A01}-\\u{10A03}\\u{10A05}\\u{10A06}\\u{10A0C}-\\u{10A0F}\\u{10A38}-\\u{10A3A}\\u{10A3F}\\u{10AE5}\\u{10AE6}\\u{10D24}-\\u{10D27}\\u{10EAB}\\u{10EAC}\\u{10EFD}-\\u{10EFF}\\u{10F46}-\\u{10F50}\\u{10F82}-\\u{10F85}\\u{11001}\\u{11038}-\\u{11046}\\u{11070}\\u{11073}\\u{11074}\\u{1107F}-\\u{11081}\\u{110B3}-\\u{110B6}\\u{110B9}\\u{110BA}\\u{110C2}\\u{11100}-\\u{11102}\\u{11127}-\\u{1112B}\\u{1112D}-\\u{11134}\\u{11173}\\u{11180}\\u{11181}\\u{111B6}-\\u{111BE}\\u{111C9}-\\u{111CC}\\u{111CF}\\u{1122F}-\\u{11231}\\u{11234}\\u{11236}\\u{11237}\\u{1123E}\\u{11241}\\u{112DF}\\u{112E3}-\\u{112EA}\\u{11300}\\u{11301}\\u{1133B}\\u{1133C}\\u{1133E}\\u{11340}\\u{11357}\\u{11366}-\\u{1136C}\\u{11370}-\\u{11374}\\u{11438}-\\u{1143F}\\u{11442}-\\u{11444}\\u{11446}\\u{1145E}\\u{114B0}\\u{114B3}-\\u{114B8}\\u{114BA}\\u{114BD}\\u{114BF}\\u{114C0}\\u{114C2}\\u{114C3}\\u{115AF}\\u{115B2}-\\u{115B5}\\u{115BC}\\u{115BD}\\u{115BF}\\u{115C0}\\u{115DC}\\u{115DD}\\u{11633}-\\u{1163A}\\u{1163D}\\u{1163F}\\u{11640}\\u{116AB}\\u{116AD}\\u{116B0}-\\u{116B5}\\u{116B7}\\u{1171D}-\\u{1171F}\\u{11722}-\\u{11725}\\u{11727}-\\u{1172B}\\u{1182F}-\\u{11837}\\u{11839}\\u{1183A}\\u{11930}\\u{1193B}\\u{1193C}\\u{1193E}\\u{11943}\\u{119D4}-\\u{119D7}\\u{119DA}\\u{119DB}\\u{119E0}\\u{11A01}-\\u{11A0A}\\u{11A33}-\\u{11A38}\\u{11A3B}-\\u{11A3E}\\u{11A47}\\u{11A51}-\\u{11A56}\\u{11A59}-\\u{11A5B}\\u{11A8A}-\\u{11A96}\\u{11A98}\\u{11A99}\\u{11C30}-\\u{11C36}\\u{11C38}-\\u{11C3D}\\u{11C3F}\\u{11C92}-\\u{11CA7}\\u{11CAA}-\\u{11CB0}\\u{11CB2}\\u{11CB3}\\u{11CB5}\\u{11CB6}\\u{11D31}-\\u{11D36}\\u{11D3A}\\u{11D3C}\\u{11D3D}\\u{11D3F}-\\u{11D45}\\u{11D47}\\u{11D90}\\u{11D91}\\u{11D95}\\u{11D97}\\u{11EF3}\\u{11EF4}\\u{11F00}\\u{11F01}\\u{11F36}-\\u{11F3A}\\u{11F40}\\u{11F42}\\u{13440}\\u{13447}-\\u{13455}\\u{16AF0}-\\u{16AF4}\\u{16B30}-\\u{16B36}\\u{16F4F}\\u{16F8F}-\\u{16F92}\\u{16FE4}\\u{1BC9D}\\u{1BC9E}\\u{1CF00}-\\u{1CF2D}\\u{1CF30}-\\u{1CF46}\\u{1D165}\\u{1D167}-\\u{1D169}\\u{1D16E}-\\u{1D172}\\u{1D17B}-\\u{1D182}\\u{1D185}-\\u{1D18B}\\u{1D1AA}-\\u{1D1AD}\\u{1D242}-\\u{1D244}\\u{1DA00}-\\u{1DA36}\\u{1DA3B}-\\u{1DA6C}\\u{1DA75}\\u{1DA84}\\u{1DA9B}-\\u{1DA9F}\\u{1DAA1}-\\u{1DAAF}\\u{1E000}-\\u{1E006}\\u{1E008}-\\u{1E018}\\u{1E01B}-\\u{1E021}\\u{1E023}\\u{1E024}\\u{1E026}-\\u{1E02A}\\u{1E08F}\\u{1E130}-\\u{1E136}\\u{1E2AE}\\u{1E2EC}-\\u{1E2EF}\\u{1E4EC}-\\u{1E4EF}\\u{1E8D0}-\\u{1E8D6}\\u{1E944}-\\u{1E94A}\\u{1F3FB}-\\u{1F3FF}\\u{E0020}-\\u{E007F}\\u{E0100}-\\u{E01EF}]";
const gcZWJStr = "[\\u200D]";
const gcSpacingMarkStr = "[\\u0903\\u093B\\u093E-\\u0940\\u0949-\\u094C\\u094E\\u094F\\u0982\\u0983\\u09BE-\\u09C0\\u09C7\\u09C8\\u09CB\\u09CC\\u09D7\\u0A03\\u0A3E-\\u0A40\\u0A83\\u0ABE-\\u0AC0\\u0AC9\\u0ACB\\u0ACC\\u0B02\\u0B03\\u0B3E\\u0B40\\u0B47\\u0B48\\u0B4B\\u0B4C\\u0B57\\u0BBE\\u0BBF\\u0BC1\\u0BC2\\u0BC6-\\u0BC8\\u0BCA-\\u0BCC\\u0BD7\\u0C01-\\u0C03\\u0C41-\\u0C44\\u0C82\\u0C83\\u0CBE\\u0CC0-\\u0CC4\\u0CC7\\u0CC8\\u0CCA\\u0CCB\\u0CD5\\u0CD6\\u0CF3\\u0D02\\u0D03\\u0D3E-\\u0D40\\u0D46-\\u0D48\\u0D4A-\\u0D4C\\u0D57\\u0D82\\u0D83\\u0DCF-\\u0DD1\\u0DD8-\\u0DDF\\u0DF2\\u0DF3\\u0E33\\u0EB3\\u0F3E\\u0F3F\\u0F7F\\u1031\\u103B\\u103C\\u1056\\u1057\\u1084\\u1715\\u1734\\u17B6\\u17BE-\\u17C5\\u17C7\\u17C8\\u1923-\\u1926\\u1929-\\u192B\\u1930\\u1931\\u1933-\\u1938\\u1A19\\u1A1A\\u1A55\\u1A57\\u1A6D-\\u1A72\\u1B04\\u1B35\\u1B3B\\u1B3D-\\u1B41\\u1B43\\u1B44\\u1B82\\u1BA1\\u1BA6\\u1BA7\\u1BAA\\u1BE7\\u1BEA-\\u1BEC\\u1BEE\\u1BF2\\u1BF3\\u1C24-\\u1C2B\\u1C34\\u1C35\\u1CE1\\u1CF7\\u302E\\u302F\\uA823\\uA824\\uA827\\uA880\\uA881\\uA8B4-\\uA8C3\\uA952\\uA953\\uA983\\uA9B4\\uA9B5\\uA9BA\\uA9BB\\uA9BE-\\uA9C0\\uAA2F\\uAA30\\uAA33\\uAA34\\uAA4D\\uAAEB\\uAAEE\\uAAEF\\uAAF5\\uABE3\\uABE4\\uABE6\\uABE7\\uABE9\\uABEA\\uABEC\\u{11000}\\u{11002}\\u{11082}\\u{110B0}-\\u{110B2}\\u{110B7}\\u{110B8}\\u{1112C}\\u{11145}\\u{11146}\\u{11182}\\u{111B3}-\\u{111B5}\\u{111BF}\\u{111C0}\\u{111CE}\\u{1122C}-\\u{1122E}\\u{11232}\\u{11233}\\u{11235}\\u{112E0}-\\u{112E2}\\u{11302}\\u{11303}\\u{1133E}\\u{1133F}\\u{11341}-\\u{11344}\\u{11347}\\u{11348}\\u{1134B}-\\u{1134D}\\u{11357}\\u{11362}\\u{11363}\\u{11435}-\\u{11437}\\u{11440}\\u{11441}\\u{11445}\\u{114B0}-\\u{114B2}\\u{114B9}\\u{114BB}-\\u{114BE}\\u{114C1}\\u{115AF}-\\u{115B1}\\u{115B8}-\\u{115BB}\\u{115BE}\\u{11630}-\\u{11632}\\u{1163B}\\u{1163C}\\u{1163E}\\u{116AC}\\u{116AE}\\u{116AF}\\u{116B6}\\u{11726}\\u{1182C}-\\u{1182E}\\u{11838}\\u{11930}-\\u{11935}\\u{11937}\\u{11938}\\u{1193D}\\u{11940}\\u{11942}\\u{119D1}-\\u{119D3}\\u{119DC}-\\u{119DF}\\u{119E4}\\u{11A39}\\u{11A57}\\u{11A58}\\u{11A97}\\u{11C2F}\\u{11C3E}\\u{11CA9}\\u{11CB1}\\u{11CB4}\\u{11D8A}-\\u{11D8E}\\u{11D93}\\u{11D94}\\u{11D96}\\u{11EF5}\\u{11EF6}\\u{11F03}\\u{11F34}\\u{11F35}\\u{11F3E}\\u{11F3F}\\u{11F41}\\u{16F51}-\\u{16F87}\\u{16FF0}\\u{16FF1}\\u{1D165}\\u{1D166}\\u{1D16D}-\\u{1D172}]";
const gcCrlfStr = "\\u000D\\u000A?|\\u000A";
const gcControlStr = "[\\x00-\\x09\\x0B\\x0C\\x0E-\\x1F\\x7F-\\x9F\\xAD\\u061C\\u180E\\u200B\\u200E\\u200F\\u2028-\\u202E\\u2060-\\u2064\\u2066-\\u206F\\uFEFF\\uFFF9-\\uFFFB\\u{13430}-\\u{1343F}\\u{1BCA0}-\\u{1BCA3}\\u{1D173}-\\u{1D17A}\\u{E0001}\\u{E0020}-\\u{E007F}]";
const gcPrecoreStr = "[\\u0600-\\u0605\\u06DD\\u070F\\u0890\\u0891\\u08E2\\u0D4E\\u{110BD}\\u{110CD}\\u{111C2}\\u{111C3}\\u{1193F}\\u{11941}\\u{11A3A}\\u{11A84}-\\u{11A89}\\u{11D46}\\u{11F02}]";
const gcPostcoreStr = "[\\u0300-\\u036F\\u0483-\\u0489\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED\\u0711\\u0730-\\u074A\\u07A6-\\u07B0\\u07EB-\\u07F3\\u07FD\\u0816-\\u0819\\u081B-\\u0823\\u0825-\\u0827\\u0829-\\u082D\\u0859-\\u085B\\u0898-\\u089F\\u08CA-\\u08E1\\u08E3-\\u0903\\u093A-\\u093C\\u093E-\\u094F\\u0951-\\u0957\\u0962\\u0963\\u0981-\\u0983\\u09BC\\u09BE-\\u09C4\\u09C7\\u09C8\\u09CB-\\u09CD\\u09D7\\u09E2\\u09E3\\u09FE\\u0A01-\\u0A03\\u0A3C\\u0A3E-\\u0A42\\u0A47\\u0A48\\u0A4B-\\u0A4D\\u0A51\\u0A70\\u0A71\\u0A75\\u0A81-\\u0A83\\u0ABC\\u0ABE-\\u0AC5\\u0AC7-\\u0AC9\\u0ACB-\\u0ACD\\u0AE2\\u0AE3\\u0AFA-\\u0AFF\\u0B01-\\u0B03\\u0B3C\\u0B3E-\\u0B44\\u0B47\\u0B48\\u0B4B-\\u0B4D\\u0B55-\\u0B57\\u0B62\\u0B63\\u0B82\\u0BBE-\\u0BC2\\u0BC6-\\u0BC8\\u0BCA-\\u0BCD\\u0BD7\\u0C00-\\u0C04\\u0C3C\\u0C3E-\\u0C44\\u0C46-\\u0C48\\u0C4A-\\u0C4D\\u0C55\\u0C56\\u0C62\\u0C63\\u0C81-\\u0C83\\u0CBC\\u0CBE-\\u0CC4\\u0CC6-\\u0CC8\\u0CCA-\\u0CCD\\u0CD5\\u0CD6\\u0CE2\\u0CE3\\u0CF3\\u0D00-\\u0D03\\u0D3B\\u0D3C\\u0D3E-\\u0D44\\u0D46-\\u0D48\\u0D4A-\\u0D4D\\u0D57\\u0D62\\u0D63\\u0D81-\\u0D83\\u0DCA\\u0DCF-\\u0DD4\\u0DD6\\u0DD8-\\u0DDF\\u0DF2\\u0DF3\\u0E31\\u0E33-\\u0E3A\\u0E47-\\u0E4E\\u0EB1\\u0EB3-\\u0EBC\\u0EC8-\\u0ECE\\u0F18\\u0F19\\u0F35\\u0F37\\u0F39\\u0F3E\\u0F3F\\u0F71-\\u0F84\\u0F86\\u0F87\\u0F8D-\\u0F97\\u0F99-\\u0FBC\\u0FC6\\u102D-\\u1037\\u1039-\\u103E\\u1056-\\u1059\\u105E-\\u1060\\u1071-\\u1074\\u1082\\u1084-\\u1086\\u108D\\u109D\\u135D-\\u135F\\u1712-\\u1715\\u1732-\\u1734\\u1752\\u1753\\u1772\\u1773\\u17B4-\\u17D3\\u17DD\\u180B-\\u180D\\u180F\\u1885\\u1886\\u18A9\\u1920-\\u192B\\u1930-\\u193B\\u1A17-\\u1A1B\\u1A55-\\u1A5E\\u1A60\\u1A62\\u1A65-\\u1A7C\\u1A7F\\u1AB0-\\u1ACE\\u1B00-\\u1B04\\u1B34-\\u1B44\\u1B6B-\\u1B73\\u1B80-\\u1B82\\u1BA1-\\u1BAD\\u1BE6-\\u1BF3\\u1C24-\\u1C37\\u1CD0-\\u1CD2\\u1CD4-\\u1CE8\\u1CED\\u1CF4\\u1CF7-\\u1CF9\\u1DC0-\\u1DFF\\u200C\\u200D\\u20D0-\\u20F0\\u2CEF-\\u2CF1\\u2D7F\\u2DE0-\\u2DFF\\u302A-\\u302F\\u3099\\u309A\\uA66F-\\uA672\\uA674-\\uA67D\\uA69E\\uA69F\\uA6F0\\uA6F1\\uA802\\uA806\\uA80B\\uA823-\\uA827\\uA82C\\uA880\\uA881\\uA8B4-\\uA8C5\\uA8E0-\\uA8F1\\uA8FF\\uA926-\\uA92D\\uA947-\\uA953\\uA980-\\uA983\\uA9B3-\\uA9C0\\uA9E5\\uAA29-\\uAA36\\uAA43\\uAA4C\\uAA4D\\uAA7C\\uAAB0\\uAAB2-\\uAAB4\\uAAB7\\uAAB8\\uAABE\\uAABF\\uAAC1\\uAAEB-\\uAAEF\\uAAF5\\uAAF6\\uABE3-\\uABEA\\uABEC\\uABED\\uFB1E\\uFE00-\\uFE0F\\uFE20-\\uFE2F\\uFF9E\\uFF9F\\u{101FD}\\u{102E0}\\u{10376}-\\u{1037A}\\u{10A01}-\\u{10A03}\\u{10A05}\\u{10A06}\\u{10A0C}-\\u{10A0F}\\u{10A38}-\\u{10A3A}\\u{10A3F}\\u{10AE5}\\u{10AE6}\\u{10D24}-\\u{10D27}\\u{10EAB}\\u{10EAC}\\u{10EFD}-\\u{10EFF}\\u{10F46}-\\u{10F50}\\u{10F82}-\\u{10F85}\\u{11000}-\\u{11002}\\u{11038}-\\u{11046}\\u{11070}\\u{11073}\\u{11074}\\u{1107F}-\\u{11082}\\u{110B0}-\\u{110BA}\\u{110C2}\\u{11100}-\\u{11102}\\u{11127}-\\u{11134}\\u{11145}\\u{11146}\\u{11173}\\u{11180}-\\u{11182}\\u{111B3}-\\u{111C0}\\u{111C9}-\\u{111CC}\\u{111CE}\\u{111CF}\\u{1122C}-\\u{11237}\\u{1123E}\\u{11241}\\u{112DF}-\\u{112EA}\\u{11300}-\\u{11303}\\u{1133B}\\u{1133C}\\u{1133E}-\\u{11344}\\u{11347}\\u{11348}\\u{1134B}-\\u{1134D}\\u{11357}\\u{11362}\\u{11363}\\u{11366}-\\u{1136C}\\u{11370}-\\u{11374}\\u{11435}-\\u{11446}\\u{1145E}\\u{114B0}-\\u{114C3}\\u{115AF}-\\u{115B5}\\u{115B8}-\\u{115C0}\\u{115DC}\\u{115DD}\\u{11630}-\\u{11640}\\u{116AB}-\\u{116B7}\\u{1171D}-\\u{1171F}\\u{11722}-\\u{1172B}\\u{1182C}-\\u{1183A}\\u{11930}-\\u{11935}\\u{11937}\\u{11938}\\u{1193B}-\\u{1193E}\\u{11940}\\u{11942}\\u{11943}\\u{119D1}-\\u{119D7}\\u{119DA}-\\u{119E0}\\u{119E4}\\u{11A01}-\\u{11A0A}\\u{11A33}-\\u{11A39}\\u{11A3B}-\\u{11A3E}\\u{11A47}\\u{11A51}-\\u{11A5B}\\u{11A8A}-\\u{11A99}\\u{11C2F}-\\u{11C36}\\u{11C38}-\\u{11C3F}\\u{11C92}-\\u{11CA7}\\u{11CA9}-\\u{11CB6}\\u{11D31}-\\u{11D36}\\u{11D3A}\\u{11D3C}\\u{11D3D}\\u{11D3F}-\\u{11D45}\\u{11D47}\\u{11D8A}-\\u{11D8E}\\u{11D90}\\u{11D91}\\u{11D93}-\\u{11D97}\\u{11EF3}-\\u{11EF6}\\u{11F00}\\u{11F01}\\u{11F03}\\u{11F34}-\\u{11F3A}\\u{11F3E}-\\u{11F42}\\u{13440}\\u{13447}-\\u{13455}\\u{16AF0}-\\u{16AF4}\\u{16B30}-\\u{16B36}\\u{16F4F}\\u{16F51}-\\u{16F87}\\u{16F8F}-\\u{16F92}\\u{16FE4}\\u{16FF0}\\u{16FF1}\\u{1BC9D}\\u{1BC9E}\\u{1CF00}-\\u{1CF2D}\\u{1CF30}-\\u{1CF46}\\u{1D165}-\\u{1D169}\\u{1D16D}-\\u{1D172}\\u{1D17B}-\\u{1D182}\\u{1D185}-\\u{1D18B}\\u{1D1AA}-\\u{1D1AD}\\u{1D242}-\\u{1D244}\\u{1DA00}-\\u{1DA36}\\u{1DA3B}-\\u{1DA6C}\\u{1DA75}\\u{1DA84}\\u{1DA9B}-\\u{1DA9F}\\u{1DAA1}-\\u{1DAAF}\\u{1E000}-\\u{1E006}\\u{1E008}-\\u{1E018}\\u{1E01B}-\\u{1E021}\\u{1E023}\\u{1E024}\\u{1E026}-\\u{1E02A}\\u{1E08F}\\u{1E130}-\\u{1E136}\\u{1E2AE}\\u{1E2EC}-\\u{1E2EF}\\u{1E4EC}-\\u{1E4EF}\\u{1E8D0}-\\u{1E8D6}\\u{1E944}-\\u{1E94A}\\u{1F3FB}-\\u{1F3FF}\\u{E0020}-\\u{E007F}\\u{E0100}-\\u{E01EF}]";
const gcCoreLStr = "[\\u1100-\\u115F\\uA960-\\uA97C]";
const gcCoreVStr = "[\\u1160-\\u11A7\\uD7B0-\\uD7C6]";
const gcCoreTStr = "[\\u11A8-\\u11FF\\uD7CB-\\uD7FB]";
const gcCoreLVStr = "[\\uAC00\\uAC1C\\uAC38\\uAC54\\uAC70\\uAC8C\\uACA8\\uACC4\\uACE0\\uACFC\\uAD18\\uAD34\\uAD50\\uAD6C\\uAD88\\uADA4\\uADC0\\uADDC\\uADF8\\uAE14\\uAE30\\uAE4C\\uAE68\\uAE84\\uAEA0\\uAEBC\\uAED8\\uAEF4\\uAF10\\uAF2C\\uAF48\\uAF64\\uAF80\\uAF9C\\uAFB8\\uAFD4\\uAFF0\\uB00C\\uB028\\uB044\\uB060\\uB07C\\uB098\\uB0B4\\uB0D0\\uB0EC\\uB108\\uB124\\uB140\\uB15C\\uB178\\uB194\\uB1B0\\uB1CC\\uB1E8\\uB204\\uB220\\uB23C\\uB258\\uB274\\uB290\\uB2AC\\uB2C8\\uB2E4\\uB300\\uB31C\\uB338\\uB354\\uB370\\uB38C\\uB3A8\\uB3C4\\uB3E0\\uB3FC\\uB418\\uB434\\uB450\\uB46C\\uB488\\uB4A4\\uB4C0\\uB4DC\\uB4F8\\uB514\\uB530\\uB54C\\uB568\\uB584\\uB5A0\\uB5BC\\uB5D8\\uB5F4\\uB610\\uB62C\\uB648\\uB664\\uB680\\uB69C\\uB6B8\\uB6D4\\uB6F0\\uB70C\\uB728\\uB744\\uB760\\uB77C\\uB798\\uB7B4\\uB7D0\\uB7EC\\uB808\\uB824\\uB840\\uB85C\\uB878\\uB894\\uB8B0\\uB8CC\\uB8E8\\uB904\\uB920\\uB93C\\uB958\\uB974\\uB990\\uB9AC\\uB9C8\\uB9E4\\uBA00\\uBA1C\\uBA38\\uBA54\\uBA70\\uBA8C\\uBAA8\\uBAC4\\uBAE0\\uBAFC\\uBB18\\uBB34\\uBB50\\uBB6C\\uBB88\\uBBA4\\uBBC0\\uBBDC\\uBBF8\\uBC14\\uBC30\\uBC4C\\uBC68\\uBC84\\uBCA0\\uBCBC\\uBCD8\\uBCF4\\uBD10\\uBD2C\\uBD48\\uBD64\\uBD80\\uBD9C\\uBDB8\\uBDD4\\uBDF0\\uBE0C\\uBE28\\uBE44\\uBE60\\uBE7C\\uBE98\\uBEB4\\uBED0\\uBEEC\\uBF08\\uBF24\\uBF40\\uBF5C\\uBF78\\uBF94\\uBFB0\\uBFCC\\uBFE8\\uC004\\uC020\\uC03C\\uC058\\uC074\\uC090\\uC0AC\\uC0C8\\uC0E4\\uC100\\uC11C\\uC138\\uC154\\uC170\\uC18C\\uC1A8\\uC1C4\\uC1E0\\uC1FC\\uC218\\uC234\\uC250\\uC26C\\uC288\\uC2A4\\uC2C0\\uC2DC\\uC2F8\\uC314\\uC330\\uC34C\\uC368\\uC384\\uC3A0\\uC3BC\\uC3D8\\uC3F4\\uC410\\uC42C\\uC448\\uC464\\uC480\\uC49C\\uC4B8\\uC4D4\\uC4F0\\uC50C\\uC528\\uC544\\uC560\\uC57C\\uC598\\uC5B4\\uC5D0\\uC5EC\\uC608\\uC624\\uC640\\uC65C\\uC678\\uC694\\uC6B0\\uC6CC\\uC6E8\\uC704\\uC720\\uC73C\\uC758\\uC774\\uC790\\uC7AC\\uC7C8\\uC7E4\\uC800\\uC81C\\uC838\\uC854\\uC870\\uC88C\\uC8A8\\uC8C4\\uC8E0\\uC8FC\\uC918\\uC934\\uC950\\uC96C\\uC988\\uC9A4\\uC9C0\\uC9DC\\uC9F8\\uCA14\\uCA30\\uCA4C\\uCA68\\uCA84\\uCAA0\\uCABC\\uCAD8\\uCAF4\\uCB10\\uCB2C\\uCB48\\uCB64\\uCB80\\uCB9C\\uCBB8\\uCBD4\\uCBF0\\uCC0C\\uCC28\\uCC44\\uCC60\\uCC7C\\uCC98\\uCCB4\\uCCD0\\uCCEC\\uCD08\\uCD24\\uCD40\\uCD5C\\uCD78\\uCD94\\uCDB0\\uCDCC\\uCDE8\\uCE04\\uCE20\\uCE3C\\uCE58\\uCE74\\uCE90\\uCEAC\\uCEC8\\uCEE4\\uCF00\\uCF1C\\uCF38\\uCF54\\uCF70\\uCF8C\\uCFA8\\uCFC4\\uCFE0\\uCFFC\\uD018\\uD034\\uD050\\uD06C\\uD088\\uD0A4\\uD0C0\\uD0DC\\uD0F8\\uD114\\uD130\\uD14C\\uD168\\uD184\\uD1A0\\uD1BC\\uD1D8\\uD1F4\\uD210\\uD22C\\uD248\\uD264\\uD280\\uD29C\\uD2B8\\uD2D4\\uD2F0\\uD30C\\uD328\\uD344\\uD360\\uD37C\\uD398\\uD3B4\\uD3D0\\uD3EC\\uD408\\uD424\\uD440\\uD45C\\uD478\\uD494\\uD4B0\\uD4CC\\uD4E8\\uD504\\uD520\\uD53C\\uD558\\uD574\\uD590\\uD5AC\\uD5C8\\uD5E4\\uD600\\uD61C\\uD638\\uD654\\uD670\\uD68C\\uD6A8\\uD6C4\\uD6E0\\uD6FC\\uD718\\uD734\\uD750\\uD76C\\uD788]";
const gcCoreLVTStr = "[\\uAC01-\\uAC1B\\uAC1D-\\uAC37\\uAC39-\\uAC53\\uAC55-\\uAC6F\\uAC71-\\uAC8B\\uAC8D-\\uACA7\\uACA9-\\uACC3\\uACC5-\\uACDF\\uACE1-\\uACFB\\uACFD-\\uAD17\\uAD19-\\uAD33\\uAD35-\\uAD4F\\uAD51-\\uAD6B\\uAD6D-\\uAD87\\uAD89-\\uADA3\\uADA5-\\uADBF\\uADC1-\\uADDB\\uADDD-\\uADF7\\uADF9-\\uAE13\\uAE15-\\uAE2F\\uAE31-\\uAE4B\\uAE4D-\\uAE67\\uAE69-\\uAE83\\uAE85-\\uAE9F\\uAEA1-\\uAEBB\\uAEBD-\\uAED7\\uAED9-\\uAEF3\\uAEF5-\\uAF0F\\uAF11-\\uAF2B\\uAF2D-\\uAF47\\uAF49-\\uAF63\\uAF65-\\uAF7F\\uAF81-\\uAF9B\\uAF9D-\\uAFB7\\uAFB9-\\uAFD3\\uAFD5-\\uAFEF\\uAFF1-\\uB00B\\uB00D-\\uB027\\uB029-\\uB043\\uB045-\\uB05F\\uB061-\\uB07B\\uB07D-\\uB097\\uB099-\\uB0B3\\uB0B5-\\uB0CF\\uB0D1-\\uB0EB\\uB0ED-\\uB107\\uB109-\\uB123\\uB125-\\uB13F\\uB141-\\uB15B\\uB15D-\\uB177\\uB179-\\uB193\\uB195-\\uB1AF\\uB1B1-\\uB1CB\\uB1CD-\\uB1E7\\uB1E9-\\uB203\\uB205-\\uB21F\\uB221-\\uB23B\\uB23D-\\uB257\\uB259-\\uB273\\uB275-\\uB28F\\uB291-\\uB2AB\\uB2AD-\\uB2C7\\uB2C9-\\uB2E3\\uB2E5-\\uB2FF\\uB301-\\uB31B\\uB31D-\\uB337\\uB339-\\uB353\\uB355-\\uB36F\\uB371-\\uB38B\\uB38D-\\uB3A7\\uB3A9-\\uB3C3\\uB3C5-\\uB3DF\\uB3E1-\\uB3FB\\uB3FD-\\uB417\\uB419-\\uB433\\uB435-\\uB44F\\uB451-\\uB46B\\uB46D-\\uB487\\uB489-\\uB4A3\\uB4A5-\\uB4BF\\uB4C1-\\uB4DB\\uB4DD-\\uB4F7\\uB4F9-\\uB513\\uB515-\\uB52F\\uB531-\\uB54B\\uB54D-\\uB567\\uB569-\\uB583\\uB585-\\uB59F\\uB5A1-\\uB5BB\\uB5BD-\\uB5D7\\uB5D9-\\uB5F3\\uB5F5-\\uB60F\\uB611-\\uB62B\\uB62D-\\uB647\\uB649-\\uB663\\uB665-\\uB67F\\uB681-\\uB69B\\uB69D-\\uB6B7\\uB6B9-\\uB6D3\\uB6D5-\\uB6EF\\uB6F1-\\uB70B\\uB70D-\\uB727\\uB729-\\uB743\\uB745-\\uB75F\\uB761-\\uB77B\\uB77D-\\uB797\\uB799-\\uB7B3\\uB7B5-\\uB7CF\\uB7D1-\\uB7EB\\uB7ED-\\uB807\\uB809-\\uB823\\uB825-\\uB83F\\uB841-\\uB85B\\uB85D-\\uB877\\uB879-\\uB893\\uB895-\\uB8AF\\uB8B1-\\uB8CB\\uB8CD-\\uB8E7\\uB8E9-\\uB903\\uB905-\\uB91F\\uB921-\\uB93B\\uB93D-\\uB957\\uB959-\\uB973\\uB975-\\uB98F\\uB991-\\uB9AB\\uB9AD-\\uB9C7\\uB9C9-\\uB9E3\\uB9E5-\\uB9FF\\uBA01-\\uBA1B\\uBA1D-\\uBA37\\uBA39-\\uBA53\\uBA55-\\uBA6F\\uBA71-\\uBA8B\\uBA8D-\\uBAA7\\uBAA9-\\uBAC3\\uBAC5-\\uBADF\\uBAE1-\\uBAFB\\uBAFD-\\uBB17\\uBB19-\\uBB33\\uBB35-\\uBB4F\\uBB51-\\uBB6B\\uBB6D-\\uBB87\\uBB89-\\uBBA3\\uBBA5-\\uBBBF\\uBBC1-\\uBBDB\\uBBDD-\\uBBF7\\uBBF9-\\uBC13\\uBC15-\\uBC2F\\uBC31-\\uBC4B\\uBC4D-\\uBC67\\uBC69-\\uBC83\\uBC85-\\uBC9F\\uBCA1-\\uBCBB\\uBCBD-\\uBCD7\\uBCD9-\\uBCF3\\uBCF5-\\uBD0F\\uBD11-\\uBD2B\\uBD2D-\\uBD47\\uBD49-\\uBD63\\uBD65-\\uBD7F\\uBD81-\\uBD9B\\uBD9D-\\uBDB7\\uBDB9-\\uBDD3\\uBDD5-\\uBDEF\\uBDF1-\\uBE0B\\uBE0D-\\uBE27\\uBE29-\\uBE43\\uBE45-\\uBE5F\\uBE61-\\uBE7B\\uBE7D-\\uBE97\\uBE99-\\uBEB3\\uBEB5-\\uBECF\\uBED1-\\uBEEB\\uBEED-\\uBF07\\uBF09-\\uBF23\\uBF25-\\uBF3F\\uBF41-\\uBF5B\\uBF5D-\\uBF77\\uBF79-\\uBF93\\uBF95-\\uBFAF\\uBFB1-\\uBFCB\\uBFCD-\\uBFE7\\uBFE9-\\uC003\\uC005-\\uC01F\\uC021-\\uC03B\\uC03D-\\uC057\\uC059-\\uC073\\uC075-\\uC08F\\uC091-\\uC0AB\\uC0AD-\\uC0C7\\uC0C9-\\uC0E3\\uC0E5-\\uC0FF\\uC101-\\uC11B\\uC11D-\\uC137\\uC139-\\uC153\\uC155-\\uC16F\\uC171-\\uC18B\\uC18D-\\uC1A7\\uC1A9-\\uC1C3\\uC1C5-\\uC1DF\\uC1E1-\\uC1FB\\uC1FD-\\uC217\\uC219-\\uC233\\uC235-\\uC24F\\uC251-\\uC26B\\uC26D-\\uC287\\uC289-\\uC2A3\\uC2A5-\\uC2BF\\uC2C1-\\uC2DB\\uC2DD-\\uC2F7\\uC2F9-\\uC313\\uC315-\\uC32F\\uC331-\\uC34B\\uC34D-\\uC367\\uC369-\\uC383\\uC385-\\uC39F\\uC3A1-\\uC3BB\\uC3BD-\\uC3D7\\uC3D9-\\uC3F3\\uC3F5-\\uC40F\\uC411-\\uC42B\\uC42D-\\uC447\\uC449-\\uC463\\uC465-\\uC47F\\uC481-\\uC49B\\uC49D-\\uC4B7\\uC4B9-\\uC4D3\\uC4D5-\\uC4EF\\uC4F1-\\uC50B\\uC50D-\\uC527\\uC529-\\uC543\\uC545-\\uC55F\\uC561-\\uC57B\\uC57D-\\uC597\\uC599-\\uC5B3\\uC5B5-\\uC5CF\\uC5D1-\\uC5EB\\uC5ED-\\uC607\\uC609-\\uC623\\uC625-\\uC63F\\uC641-\\uC65B\\uC65D-\\uC677\\uC679-\\uC693\\uC695-\\uC6AF\\uC6B1-\\uC6CB\\uC6CD-\\uC6E7\\uC6E9-\\uC703\\uC705-\\uC71F\\uC721-\\uC73B\\uC73D-\\uC757\\uC759-\\uC773\\uC775-\\uC78F\\uC791-\\uC7AB\\uC7AD-\\uC7C7\\uC7C9-\\uC7E3\\uC7E5-\\uC7FF\\uC801-\\uC81B\\uC81D-\\uC837\\uC839-\\uC853\\uC855-\\uC86F\\uC871-\\uC88B\\uC88D-\\uC8A7\\uC8A9-\\uC8C3\\uC8C5-\\uC8DF\\uC8E1-\\uC8FB\\uC8FD-\\uC917\\uC919-\\uC933\\uC935-\\uC94F\\uC951-\\uC96B\\uC96D-\\uC987\\uC989-\\uC9A3\\uC9A5-\\uC9BF\\uC9C1-\\uC9DB\\uC9DD-\\uC9F7\\uC9F9-\\uCA13\\uCA15-\\uCA2F\\uCA31-\\uCA4B\\uCA4D-\\uCA67\\uCA69-\\uCA83\\uCA85-\\uCA9F\\uCAA1-\\uCABB\\uCABD-\\uCAD7\\uCAD9-\\uCAF3\\uCAF5-\\uCB0F\\uCB11-\\uCB2B\\uCB2D-\\uCB47\\uCB49-\\uCB63\\uCB65-\\uCB7F\\uCB81-\\uCB9B\\uCB9D-\\uCBB7\\uCBB9-\\uCBD3\\uCBD5-\\uCBEF\\uCBF1-\\uCC0B\\uCC0D-\\uCC27\\uCC29-\\uCC43\\uCC45-\\uCC5F\\uCC61-\\uCC7B\\uCC7D-\\uCC97\\uCC99-\\uCCB3\\uCCB5-\\uCCCF\\uCCD1-\\uCCEB\\uCCED-\\uCD07\\uCD09-\\uCD23\\uCD25-\\uCD3F\\uCD41-\\uCD5B\\uCD5D-\\uCD77\\uCD79-\\uCD93\\uCD95-\\uCDAF\\uCDB1-\\uCDCB\\uCDCD-\\uCDE7\\uCDE9-\\uCE03\\uCE05-\\uCE1F\\uCE21-\\uCE3B\\uCE3D-\\uCE57\\uCE59-\\uCE73\\uCE75-\\uCE8F\\uCE91-\\uCEAB\\uCEAD-\\uCEC7\\uCEC9-\\uCEE3\\uCEE5-\\uCEFF\\uCF01-\\uCF1B\\uCF1D-\\uCF37\\uCF39-\\uCF53\\uCF55-\\uCF6F\\uCF71-\\uCF8B\\uCF8D-\\uCFA7\\uCFA9-\\uCFC3\\uCFC5-\\uCFDF\\uCFE1-\\uCFFB\\uCFFD-\\uD017\\uD019-\\uD033\\uD035-\\uD04F\\uD051-\\uD06B\\uD06D-\\uD087\\uD089-\\uD0A3\\uD0A5-\\uD0BF\\uD0C1-\\uD0DB\\uD0DD-\\uD0F7\\uD0F9-\\uD113\\uD115-\\uD12F\\uD131-\\uD14B\\uD14D-\\uD167\\uD169-\\uD183\\uD185-\\uD19F\\uD1A1-\\uD1BB\\uD1BD-\\uD1D7\\uD1D9-\\uD1F3\\uD1F5-\\uD20F\\uD211-\\uD22B\\uD22D-\\uD247\\uD249-\\uD263\\uD265-\\uD27F\\uD281-\\uD29B\\uD29D-\\uD2B7\\uD2B9-\\uD2D3\\uD2D5-\\uD2EF\\uD2F1-\\uD30B\\uD30D-\\uD327\\uD329-\\uD343\\uD345-\\uD35F\\uD361-\\uD37B\\uD37D-\\uD397\\uD399-\\uD3B3\\uD3B5-\\uD3CF\\uD3D1-\\uD3EB\\uD3ED-\\uD407\\uD409-\\uD423\\uD425-\\uD43F\\uD441-\\uD45B\\uD45D-\\uD477\\uD479-\\uD493\\uD495-\\uD4AF\\uD4B1-\\uD4CB\\uD4CD-\\uD4E7\\uD4E9-\\uD503\\uD505-\\uD51F\\uD521-\\uD53B\\uD53D-\\uD557\\uD559-\\uD573\\uD575-\\uD58F\\uD591-\\uD5AB\\uD5AD-\\uD5C7\\uD5C9-\\uD5E3\\uD5E5-\\uD5FF\\uD601-\\uD61B\\uD61D-\\uD637\\uD639-\\uD653\\uD655-\\uD66F\\uD671-\\uD68B\\uD68D-\\uD6A7\\uD6A9-\\uD6C3\\uD6C5-\\uD6DF\\uD6E1-\\uD6FB\\uD6FD-\\uD717\\uD719-\\uD733\\uD735-\\uD74F\\uD751-\\uD76B\\uD76D-\\uD787\\uD789-\\uD7A3]";
const gcCoreRIStr = "[\\u{1F1E6}-\\u{1F1FF}]{2}";
const gcCoreExpicStr = "[\\xA9\\xAE\\u203C\\u2049\\u2122\\u2139\\u2194-\\u2199\\u21A9\\u21AA\\u231A\\u231B\\u2328\\u2388\\u23CF\\u23E9-\\u23F3\\u23F8-\\u23FA\\u24C2\\u25AA\\u25AB\\u25B6\\u25C0\\u25FB-\\u25FE\\u2600-\\u2605\\u2607-\\u2612\\u2614-\\u2685\\u2690-\\u2705\\u2708-\\u2712\\u2714\\u2716\\u271D\\u2721\\u2728\\u2733\\u2734\\u2744\\u2747\\u274C\\u274E\\u2753-\\u2755\\u2757\\u2763-\\u2767\\u2795-\\u2797\\u27A1\\u27B0\\u27BF\\u2934\\u2935\\u2B05-\\u2B07\\u2B1B\\u2B1C\\u2B50\\u2B55\\u3030\\u303D\\u3297\\u3299\\u{1F000}-\\u{1F0FF}\\u{1F10D}-\\u{1F10F}\\u{1F12F}\\u{1F16C}-\\u{1F171}\\u{1F17E}\\u{1F17F}\\u{1F18E}\\u{1F191}-\\u{1F19A}\\u{1F1AD}-\\u{1F1E5}\\u{1F201}-\\u{1F20F}\\u{1F21A}\\u{1F22F}\\u{1F232}-\\u{1F23A}\\u{1F23C}-\\u{1F23F}\\u{1F249}-\\u{1F3FA}\\u{1F400}-\\u{1F53D}\\u{1F546}-\\u{1F64F}\\u{1F680}-\\u{1F6FF}\\u{1F774}-\\u{1F77F}\\u{1F7D5}-\\u{1F7FF}\\u{1F80C}-\\u{1F80F}\\u{1F848}-\\u{1F84F}\\u{1F85A}-\\u{1F85F}\\u{1F888}-\\u{1F88F}\\u{1F8AE}-\\u{1F8FF}\\u{1F90C}-\\u{1F93A}\\u{1F93C}-\\u{1F945}\\u{1F947}-\\u{1FAFF}\\u{1FC00}-\\u{1FFFD}]";
const gcCoreIncbConsonantStr = "[\\u0915-\\u0939\\u0958-\\u095F\\u0978-\\u097F\\u0995-\\u09A8\\u09AA-\\u09B0\\u09B2\\u09B6-\\u09B9\\u09DC\\u09DD\\u09DF\\u09F0\\u09F1\\u0A95-\\u0AA8\\u0AAA-\\u0AB0\\u0AB2\\u0AB3\\u0AB5-\\u0AB9\\u0AF9\\u0B15-\\u0B28\\u0B2A-\\u0B30\\u0B32\\u0B33\\u0B35-\\u0B39\\u0B5C\\u0B5D\\u0B5F\\u0B71\\u0C15-\\u0C28\\u0C2A-\\u0C39\\u0C58-\\u0C5A\\u0D15-\\u0D3A]";
const gcCoreIncbLinkerStr = "[\\u094D\\u09CD\\u0ACD\\u0B4D\\u0C4D\\u0D4D]";
const gcCoreIncbExLkStr = "[\\u0300-\\u034E\\u0350-\\u036F\\u0483-\\u0487\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED\\u0711\\u0730-\\u074A\\u07EB-\\u07F3\\u07FD\\u0816-\\u0819\\u081B-\\u0823\\u0825-\\u0827\\u0829-\\u082D\\u0859-\\u085B\\u0898-\\u089F\\u08CA-\\u08E1\\u08E3-\\u08FF\\u093C\\u094D\\u0951-\\u0954\\u09BC\\u09CD\\u09FE\\u0A3C\\u0ABC\\u0ACD\\u0B3C\\u0B4D\\u0C3C\\u0C4D\\u0C55\\u0C56\\u0CBC\\u0D3B\\u0D3C\\u0D4D\\u0E38-\\u0E3A\\u0E48-\\u0E4B\\u0EB8-\\u0EBA\\u0EC8-\\u0ECB\\u0F18\\u0F19\\u0F35\\u0F37\\u0F39\\u0F71\\u0F72\\u0F74\\u0F7A-\\u0F7D\\u0F80\\u0F82-\\u0F84\\u0F86\\u0F87\\u0FC6\\u1037\\u1039\\u103A\\u108D\\u135D-\\u135F\\u1714\\u17D2\\u17DD\\u18A9\\u1939-\\u193B\\u1A17\\u1A18\\u1A60\\u1A75-\\u1A7C\\u1A7F\\u1AB0-\\u1ABD\\u1ABF-\\u1ACE\\u1B34\\u1B6B-\\u1B73\\u1BAB\\u1BE6\\u1C37\\u1CD0-\\u1CD2\\u1CD4-\\u1CE0\\u1CE2-\\u1CE8\\u1CED\\u1CF4\\u1CF8\\u1CF9\\u1DC0-\\u1DFF\\u200D\\u20D0-\\u20DC\\u20E1\\u20E5-\\u20F0\\u2CEF-\\u2CF1\\u2D7F\\u2DE0-\\u2DFF\\u302A-\\u302F\\u3099\\u309A\\uA66F\\uA674-\\uA67D\\uA69E\\uA69F\\uA6F0\\uA6F1\\uA82C\\uA8E0-\\uA8F1\\uA92B-\\uA92D\\uA9B3\\uAAB0\\uAAB2-\\uAAB4\\uAAB7\\uAAB8\\uAABE\\uAABF\\uAAC1\\uAAF6\\uABED\\uFB1E\\uFE20-\\uFE2F\\u{101FD}\\u{102E0}\\u{10376}-\\u{1037A}\\u{10A0D}\\u{10A0F}\\u{10A38}-\\u{10A3A}\\u{10A3F}\\u{10AE5}\\u{10AE6}\\u{10D24}-\\u{10D27}\\u{10EAB}\\u{10EAC}\\u{10EFD}-\\u{10EFF}\\u{10F46}-\\u{10F50}\\u{10F82}-\\u{10F85}\\u{11070}\\u{1107F}\\u{110BA}\\u{11100}-\\u{11102}\\u{11133}\\u{11134}\\u{11173}\\u{111CA}\\u{11236}\\u{112E9}\\u{112EA}\\u{1133B}\\u{1133C}\\u{11366}-\\u{1136C}\\u{11370}-\\u{11374}\\u{11446}\\u{1145E}\\u{114C3}\\u{115C0}\\u{116B7}\\u{1172B}\\u{1183A}\\u{1193E}\\u{11943}\\u{11A34}\\u{11A47}\\u{11A99}\\u{11D42}\\u{11D44}\\u{11D45}\\u{11D97}\\u{11F42}\\u{16AF0}-\\u{16AF4}\\u{16B30}-\\u{16B36}\\u{1BC9E}\\u{1D165}\\u{1D167}-\\u{1D169}\\u{1D16E}-\\u{1D172}\\u{1D17B}-\\u{1D182}\\u{1D185}-\\u{1D18B}\\u{1D1AA}-\\u{1D1AD}\\u{1D242}-\\u{1D244}\\u{1E000}-\\u{1E006}\\u{1E008}-\\u{1E018}\\u{1E01B}-\\u{1E021}\\u{1E023}\\u{1E024}\\u{1E026}-\\u{1E02A}\\u{1E08F}\\u{1E130}-\\u{1E136}\\u{1E2AE}\\u{1E2EC}-\\u{1E2EF}\\u{1E4EC}-\\u{1E4EF}\\u{1E8D0}-\\u{1E8D6}\\u{1E944}-\\u{1E94A}]";
const gcCoreNonControlStr = "[^\\x00-\\x1F\\x7F-\\x9F\\xAD\\u061C\\u180E\\u200B\\u200E\\u200F\\u2028-\\u202E\\u2060-\\u2064\\u2066-\\u206F\\uFEFF\\uFFF9-\\uFFFB\\u{13430}-\\u{1343F}\\u{1BCA0}-\\u{1BCA3}\\u{1D173}-\\u{1D17A}\\u{E0001}\\u{E0020}-\\u{E007F}]";
function q2pl (s, q = '*') {
	/*
	 * convert quantifier to positive lookahead
	 *
	 *   A* -> (?=(?<gcr0>A*))\k<gcr0>
	 *
	 * @see https://wanago.io/2019/09/23/regex-course-part-four-avoiding-catastrophic-backtracking-using-lookahead/
	 */
	//return s + q;
	const tag = `<gcr${groupCount++}>`;
	switch (q) {
	case '*':
		return `(?=(?${tag}${s}*))\\k${tag}`;
	case '+':
		return `(?=(?${tag}${s}+))\\k${tag}`;
	default:
		throw new Error(`q2pl: unknown quantifier: "${q}"`);
	}
}
function gcCore (target, group) {
	/*
	 * core := hangul-syllable
	 * | RI-Sequence
	 * | xpicto-sequence
	 * | conjunctCluster
	 * | [^Control CR LF]
	 *
	 * hangul-syllable :=
	 *   L* (V+ | LV V* | LVT) T*
	 *   | L+
	 *   | T+
	 *
	 * RI-Sequence :=
	 *   RI RI
	 *
	 * xpicto-sequence :=
	 *   \p{Extended_Pictographic} (Extend* ZWJ \p{Extended_Pictographic})*
	 *
	 * conjunctCluster :=
	 *   \p{InCB=Consonant} ([\p{InCB=Extend} \p{InCB=Linker}]* \p{InCB=Linker} [\p{InCB=Extend} \p{InCB=Linker}]* \p{InCB=Consonant})+
	 */
	const components = [];

	// hangul-syllable
	if (typeof target !== 'string'
	 || (new RegExp(gcCoreLStr, 'u')).test(target)
	 || (new RegExp(gcCoreVStr, 'u')).test(target)
	 || (new RegExp(gcCoreTStr, 'u')).test(target)
	 || (new RegExp(gcCoreLVStr, 'u')).test(target)
	 || (new RegExp(gcCoreLVTStr, 'u')).test(target)) {
		components.push(`${gcCoreLStr}*(?:${gcCoreVStr}+|${gcCoreLVStr}${gcCoreVStr}*|${gcCoreLVTStr})${gcCoreTStr}*|${gcCoreLStr}+|${gcCoreTStr}+`);
	}

	// RI-Sequence
	if (typeof target !== 'string'
	 || (new RegExp(gcCoreRIStr, 'u')).test(target)) {
		components.push(gcCoreRIStr);
	}

	// xpicto-sequence
	if (typeof target !== 'string'
	 || (new RegExp(gcCoreExpicStr, 'u')).test(target)) {
		components.push(`${gcCoreExpicStr}(?:${gcExtendStr}*${gcZWJStr}${gcCoreExpicStr})*`);
	}

	// conjunctCluster
	if (typeof target !== 'string'
	 || (new RegExp(gcCoreIncbConsonantStr, 'u')).test(target) && (new RegExp(gcCoreIncbLinkerStr, 'u')).test(target)) {
		components.push(`${gcCoreIncbConsonantStr}(?:${gcCoreIncbExLkStr}*${gcCoreIncbLinkerStr}${gcCoreIncbExLkStr}*${gcCoreIncbConsonantStr})+`);
	}

	// non-control characters
	if (typeof target !== 'string'
	 || (new RegExp(gcCoreNonControlStr, 'u')).test(target)) {
		components.push(gcCoreNonControlStr);
	}

	return group ?
		`(?:(${components.join(')|(')}))` :
		`(?:${components.join('|')})`;
}
export function graphemeRegex (target) {
	/*
	 * extended grapheme cluster :=
	 *   crlf
	 *   | Control
	 *   | precore* core postcore*
	 */
	groupCount = 0;
	if (typeof target === 'string') {
		let result = '(?:';

		result += gcCrlfStr;

		if ((new RegExp(gcControlStr, 'u')).test(target)) {
			result += '|' + gcControlStr;
		}

		let result2 = '';
		if ((new RegExp(gcPrecoreStr, 'u')).test(target)) {
			/*
			 * note: Backtracking is necessary here
			 *       because of the characters commonly included in precore and core.
			 *       Therefore, q2pl() not used.
			 */
			//result2 += q2pl(gcPrecoreStr, '*');
			result2 += `${gcPrecoreStr}*`;
		}
		result2 += gcCore(target);

		if ((new RegExp(gcPostcoreStr, 'u')).test(target)) {
			result2 += q2pl(gcPostcoreStr, '*');
		}
		if (result2 !== '') {
			result += '|' + result2;
		}

		result += ')';
		return result;
	}
	else {
		return `(?:` +
			`${gcCrlfStr}` +
			`|${gcControlStr}` +
			// Again, precore is used as is.
			`|${gcPrecoreStr}*${gcCore()}${q2pl(gcPostcoreStr)}` +
			`)`;
	}
}
export function coreExtractRegex (group) {
	groupCount = 0;
	/*
	 * 1: CRLF
	 * 2: Control
	 * 3: core (hangul-syllable)
	 * 4: core (RI-Sequence)
	 * 5: core (xpicto-sequence)
	 * 6: core (conjunctCluster)
	 * 7: core (non-control)
	 */
	return `(?:` +
		`(${gcCrlfStr})` +
		`|(${gcControlStr})` +
		`|${gcPrecoreStr}*${gcCore(undefined, group)}${gcPostcoreStr}*` +
		`)`;
}
