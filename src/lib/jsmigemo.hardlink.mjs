class BitList {
    constructor(size) {
        if (size == undefined) {
            this.words = new Uint32Array(8);
            this.size = 0;
        }
        else {
            this.words = new Uint32Array((size + 31) >> 5);
            this.size = size;
        }
    }
    add(value) {
        if (this.words.length < (this.size + 1 + 31) >> 5) {
            const newWords = new Uint32Array(this.words.length * 2);
            newWords.set(this.words, 0);
            this.words = newWords;
        }
        this.set(this.size, value);
        this.size++;
    }
    set(pos, value) {
        if (this.size < pos) {
            throw new Error();
        }
        if (value) {
            this.words[pos >> 5] |= 1 << (pos & 31);
        }
        else {
            this.words[pos >> 5] &= ~(1 << (pos & 31));
        }
    }
    get(pos) {
        if (this.size < pos) {
            throw new Error();
        }
        return ((this.words[pos >> 5] >> (pos & 31)) & 1) == 1;
    }
}

function binarySearch(a, fromIndex, toIndex, key) {
    let low = fromIndex;
    let high = toIndex - 1;
    while (low <= high) {
        const mid = (low + high) >>> 1;
        const midVal = a[mid];
        if (midVal < key)
            low = mid + 1;
        else if (midVal > key)
            high = mid - 1;
        else
            return mid;
    }
    return -(low + 1);
}
function binarySearchUint16(a, fromIndex, toIndex, key) {
    let low = fromIndex;
    let high = toIndex - 1;
    while (low <= high) {
        const mid = (low + high) >>> 1;
        const midVal = a[mid];
        if (midVal < key)
            low = mid + 1;
        else if (midVal > key)
            high = mid - 1;
        else
            return mid;
    }
    return -(low + 1);
}
function binarySearchString(a, fromIndex, toIndex, key) {
    let low = fromIndex;
    let high = toIndex - 1;
    while (low <= high) {
        const mid = (low + high) >>> 1;
        const midVal = a[mid];
        if (midVal < key)
            low = mid + 1;
        else if (midVal > key)
            high = mid - 1;
        else
            return mid;
    }
    return -(low + 1);
}
function bitCount(i) {
    i = i - ((i >>> 1) & 0x55555555);
    i = (i & 0x33333333) + ((i >>> 2) & 0x33333333);
    i = (i + (i >>> 4)) & 0x0f0f0f0f;
    i = i + (i >>> 8);
    i = i + (i >>> 16);
    return i & 0x3f;
}
function numberOfTrailingZeros(i) {
    let x, y;
    if (i == 0)
        return 64;
    let n = 63;
    y = i;
    if (y != 0) {
        n = n - 32;
        x = y;
    }
    else
        x = (i >>> 32);
    y = x << 16;
    if (y != 0) {
        n = n - 16;
        x = y;
    }
    y = x << 8;
    if (y != 0) {
        n = n - 8;
        x = y;
    }
    y = x << 4;
    if (y != 0) {
        n = n - 4;
        x = y;
    }
    y = x << 2;
    if (y != 0) {
        n = n - 2;
        x = y;
    }
    return n - ((x << 1) >>> 31);
}

class BitVector {
    constructor(words, sizeInBits) {
        const expectedWordsLength = ((sizeInBits + 63) >> 6) * 2;
        if (expectedWordsLength != words.length) {
            throw new Error(`expected: ${expectedWordsLength} actual: ${words.length}`);
        }
        this.words = words;
        this.sizeInBits = sizeInBits;
        this.lb = new Uint32Array((sizeInBits + 511) >>> 9);
        this.sb = new Uint16Array(this.lb.length * 8);
        let sum = 0;
        let sumInLb = 0;
        for (let i = 0; i < this.sb.length; i++) {
            const bc = i < (this.words.length >>> 1) ? bitCount(this.words[i * 2]) + bitCount(this.words[i * 2 + 1]) : 0;
            this.sb[i] = sumInLb;
            sumInLb += bc;
            if ((i & 7) == 7) {
                this.lb[i >>> 3] = sum;
                sum += sumInLb;
                sumInLb = 0;
            }
        }
    }
    rank(pos, b) {
        if (pos < 0 && this.sizeInBits <= pos) {
            throw new RangeError();
        }
        let count1 = this.sb[pos >>> 6] + this.lb[pos >>> 9];
        const posInDWord = pos & 63;
        if (posInDWord >= 32) {
            count1 += bitCount(this.words[(pos >>> 5) & 0xFFFFFFFE]);
        }
        const posInWord = pos & 31;
        const mask = 0x7FFFFFFF >>> (31 - posInWord);
        count1 += bitCount(this.words[pos >>> 5] & mask);
        return b ? count1 : (pos - count1);
    }
    select(count, b) {
        const lbIndex = this.lowerBoundBinarySearchLB(count, b) - 1;
        if (lbIndex == -1) {
            return 0;
        }
        const countInLb = count - (b ? this.lb[lbIndex] : (512 * lbIndex - this.lb[lbIndex]));
        const sbIndex = this.lowerBoundBinarySearchSB(countInLb, lbIndex * 8, lbIndex * 8 + 8, b) - 1;
        let countInSb = countInLb - (b ? this.sb[sbIndex] : (64 * (sbIndex % 8) - this.sb[sbIndex]));
        let wordL = this.words[sbIndex * 2];
        let wordU = this.words[sbIndex * 2 + 1];
        if (!b) {
            wordL = ~wordL;
            wordU = ~wordU;
        }
        const lowerBitCount = bitCount(wordL);
        let i = 0;
        if (countInSb > lowerBitCount) {
            wordL = wordU;
            countInSb -= lowerBitCount;
            i = 32;
        }
        while (countInSb > 0) {
            countInSb -= wordL & 1;
            wordL >>>= 1;
            i++;
        }
        return sbIndex * 64 + (i - 1);
    }
    lowerBoundBinarySearchLB(key, b) {
        let high = this.lb.length;
        let low = -1;
        if (b) {
            while (high - low > 1) {
                let mid = (high + low) >>> 1;
                if (this.lb[mid] < key) {
                    low = mid;
                }
                else {
                    high = mid;
                }
            }
        }
        else {
            while (high - low > 1) {
                let mid = (high + low) >>> 1;
                if (512 * mid - this.lb[mid] < key) {
                    low = mid;
                }
                else {
                    high = mid;
                }
            }
        }
        return high;
    }
    lowerBoundBinarySearchSB(key, fromIndex, toIndex, b) {
        let high = toIndex;
        let low = fromIndex - 1;
        if (b) {
            while (high - low > 1) {
                const mid = (high + low) >>> 1;
                if (this.sb[mid] < key) {
                    low = mid;
                }
                else {
                    high = mid;
                }
            }
        }
        else {
            while (high - low > 1) {
                const mid = (high + low) >>> 1;
                if (64 * (mid & 7) - this.sb[mid] < key) {
                    low = mid;
                }
                else {
                    high = mid;
                }
            }
        }
        return high;
    }
    nextClearBit(fromIndex) {
        let u = fromIndex >> 5;
        let word = ~this.words[u] & (0xffffffff << fromIndex);
        while (true) {
            if (word != 0)
                return (u * 32) + numberOfTrailingZeros(word);
            if (++u == this.words.length)
                return -1;
            word = ~this.words[u];
        }
    }
    size() {
        return this.sizeInBits;
    }
    get(pos) {
        if (pos < 0 && this.sizeInBits <= pos) {
            throw new RangeError();
        }
        return ((this.words[pos >>> 5] >>> (pos & 31)) & 1) == 1;
    }
    toString() {
        let s = "";
        for (let i = 0; i < this.sizeInBits; i++) {
            const bit = ((this.words[i >>> 6] >>> (i & 63)) & 1) == 1;
            s += bit ? '1' : '0';
            if ((i & 63) == 63) {
                s += ' ';
            }
        }
        return s;
    }
}

const han2zen = new Map();
han2zen.set('!', '！');
han2zen.set('"', '”');
han2zen.set('#', '＃');
han2zen.set('$', '＄');
han2zen.set('%', '％');
han2zen.set('&', '＆');
han2zen.set('\'', '’');
han2zen.set('(', '（');
han2zen.set(')', '）');
han2zen.set('*', '＊');
han2zen.set('+', '＋');
han2zen.set(',', '，');
han2zen.set('-', '－');
han2zen.set('.', '．');
han2zen.set('/', '／');
han2zen.set('0', '０');
han2zen.set('1', '１');
han2zen.set('2', '２');
han2zen.set('3', '３');
han2zen.set('4', '４');
han2zen.set('5', '５');
han2zen.set('6', '６');
han2zen.set('7', '７');
han2zen.set('8', '８');
han2zen.set('9', '９');
han2zen.set(':', '：');
han2zen.set(';', '；');
han2zen.set('<', '＜');
han2zen.set('=', '＝');
han2zen.set('>', '＞');
han2zen.set('?', '？');
han2zen.set('@', '＠');
han2zen.set('A', 'Ａ');
han2zen.set('B', 'Ｂ');
han2zen.set('C', 'Ｃ');
han2zen.set('D', 'Ｄ');
han2zen.set('E', 'Ｅ');
han2zen.set('F', 'Ｆ');
han2zen.set('G', 'Ｇ');
han2zen.set('H', 'Ｈ');
han2zen.set('I', 'Ｉ');
han2zen.set('J', 'Ｊ');
han2zen.set('K', 'Ｋ');
han2zen.set('L', 'Ｌ');
han2zen.set('M', 'Ｍ');
han2zen.set('N', 'Ｎ');
han2zen.set('O', 'Ｏ');
han2zen.set('P', 'Ｐ');
han2zen.set('Q', 'Ｑ');
han2zen.set('R', 'Ｒ');
han2zen.set('S', 'Ｓ');
han2zen.set('T', 'Ｔ');
han2zen.set('U', 'Ｕ');
han2zen.set('V', 'Ｖ');
han2zen.set('W', 'Ｗ');
han2zen.set('X', 'Ｘ');
han2zen.set('Y', 'Ｙ');
han2zen.set('Z', 'Ｚ');
han2zen.set('[', '［');
han2zen.set('\\', '￥');
han2zen.set(']', '］');
han2zen.set('^', '＾');
han2zen.set('_', '＿');
han2zen.set('`', '‘');
han2zen.set('a', 'ａ');
han2zen.set('b', 'ｂ');
han2zen.set('c', 'ｃ');
han2zen.set('d', 'ｄ');
han2zen.set('e', 'ｅ');
han2zen.set('f', 'ｆ');
han2zen.set('g', 'ｇ');
han2zen.set('h', 'ｈ');
han2zen.set('i', 'ｉ');
han2zen.set('j', 'ｊ');
han2zen.set('k', 'ｋ');
han2zen.set('l', 'ｌ');
han2zen.set('m', 'ｍ');
han2zen.set('n', 'ｎ');
han2zen.set('o', 'ｏ');
han2zen.set('p', 'ｐ');
han2zen.set('q', 'ｑ');
han2zen.set('r', 'ｒ');
han2zen.set('s', 'ｓ');
han2zen.set('t', 'ｔ');
han2zen.set('u', 'ｕ');
han2zen.set('v', 'ｖ');
han2zen.set('w', 'ｗ');
han2zen.set('x', 'ｘ');
han2zen.set('y', 'ｙ');
han2zen.set('z', 'ｚ');
han2zen.set('{', '｛');
han2zen.set('|', '｜');
han2zen.set('}', '｝');
han2zen.set('~', '～');
han2zen.set('｡', '。');
han2zen.set('｢', '「');
han2zen.set('｣', '」');
han2zen.set('､', '、');
han2zen.set('･', '・');
han2zen.set('ｦ', 'ヲ');
han2zen.set('ｧ', 'ァ');
han2zen.set('ｨ', 'ィ');
han2zen.set('ｩ', 'ゥ');
han2zen.set('ｪ', 'ェ');
han2zen.set('ｫ', 'ォ');
han2zen.set('ｬ', 'ャ');
han2zen.set('ｭ', 'ュ');
han2zen.set('ｮ', 'ョ');
han2zen.set('ｯ', 'ッ');
han2zen.set('ｰ', 'ー');
han2zen.set('ｱ', 'ア');
han2zen.set('ｲ', 'イ');
han2zen.set('ｳ', 'ウ');
han2zen.set('ｴ', 'エ');
han2zen.set('ｵ', 'オ');
han2zen.set('ｶ', 'カ');
han2zen.set('ｷ', 'キ');
han2zen.set('ｸ', 'ク');
han2zen.set('ｹ', 'ケ');
han2zen.set('ｺ', 'コ');
han2zen.set('ｻ', 'サ');
han2zen.set('ｼ', 'シ');
han2zen.set('ｽ', 'ス');
han2zen.set('ｾ', 'セ');
han2zen.set('ｿ', 'ソ');
han2zen.set('ﾀ', 'タ');
han2zen.set('ﾁ', 'チ');
han2zen.set('ﾂ', 'ツ');
han2zen.set('ﾃ', 'テ');
han2zen.set('ﾄ', 'ト');
han2zen.set('ﾅ', 'ナ');
han2zen.set('ﾆ', 'ニ');
han2zen.set('ﾇ', 'ヌ');
han2zen.set('ﾈ', 'ネ');
han2zen.set('ﾉ', 'ノ');
han2zen.set('ﾊ', 'ハ');
han2zen.set('ﾋ', 'ヒ');
han2zen.set('ﾌ', 'フ');
han2zen.set('ﾍ', 'ヘ');
han2zen.set('ﾎ', 'ホ');
han2zen.set('ﾏ', 'マ');
han2zen.set('ﾐ', 'ミ');
han2zen.set('ﾑ', 'ム');
han2zen.set('ﾒ', 'メ');
han2zen.set('ﾓ', 'モ');
han2zen.set('ﾔ', 'ヤ');
han2zen.set('ﾕ', 'ユ');
han2zen.set('ﾖ', 'ヨ');
han2zen.set('ﾗ', 'ラ');
han2zen.set('ﾘ', 'リ');
han2zen.set('ﾙ', 'ル');
han2zen.set('ﾚ', 'レ');
han2zen.set('ﾛ', 'ロ');
han2zen.set('ﾜ', 'ワ');
han2zen.set('ﾝ', 'ン');
han2zen.set('ﾞ', '゛');
han2zen.set('ﾟ', '゜');
const zen2han = new Map();
zen2han.set('！', "!");
zen2han.set('”', "\"");
zen2han.set('＃', "#");
zen2han.set('＄', "$");
zen2han.set('％', "%");
zen2han.set('＆', "&");
zen2han.set('’', "'");
zen2han.set('（', "(");
zen2han.set('）', ")");
zen2han.set('＊', "*");
zen2han.set('＋', "+");
zen2han.set('，', ",");
zen2han.set('－', "-");
zen2han.set('．', ".");
zen2han.set('／', "/");
zen2han.set('０', "0");
zen2han.set('１', "1");
zen2han.set('２', "2");
zen2han.set('３', "3");
zen2han.set('４', "4");
zen2han.set('５', "5");
zen2han.set('６', "6");
zen2han.set('７', "7");
zen2han.set('８', "8");
zen2han.set('９', "9");
zen2han.set('：', ":");
zen2han.set('；', ";");
zen2han.set('＜', "<");
zen2han.set('＝', "=");
zen2han.set('＞', ">");
zen2han.set('？', "?");
zen2han.set('＠', "@");
zen2han.set('Ａ', "A");
zen2han.set('Ｂ', "B");
zen2han.set('Ｃ', "C");
zen2han.set('Ｄ', "D");
zen2han.set('Ｅ', "E");
zen2han.set('Ｆ', "F");
zen2han.set('Ｇ', "G");
zen2han.set('Ｈ', "H");
zen2han.set('Ｉ', "I");
zen2han.set('Ｊ', "J");
zen2han.set('Ｋ', "K");
zen2han.set('Ｌ', "L");
zen2han.set('Ｍ', "M");
zen2han.set('Ｎ', "N");
zen2han.set('Ｏ', "O");
zen2han.set('Ｐ', "P");
zen2han.set('Ｑ', "Q");
zen2han.set('Ｒ', "R");
zen2han.set('Ｓ', "S");
zen2han.set('Ｔ', "T");
zen2han.set('Ｕ', "U");
zen2han.set('Ｖ', "V");
zen2han.set('Ｗ', "W");
zen2han.set('Ｘ', "X");
zen2han.set('Ｙ', "Y");
zen2han.set('Ｚ', "Z");
zen2han.set('［', "[");
zen2han.set('￥', "\\");
zen2han.set('］', "]");
zen2han.set('＾', "^");
zen2han.set('＿', "_");
zen2han.set('‘', "`");
zen2han.set('ａ', "a");
zen2han.set('ｂ', "b");
zen2han.set('ｃ', "c");
zen2han.set('ｄ', "d");
zen2han.set('ｅ', "e");
zen2han.set('ｆ', "f");
zen2han.set('ｇ', "g");
zen2han.set('ｈ', "h");
zen2han.set('ｉ', "i");
zen2han.set('ｊ', "j");
zen2han.set('ｋ', "k");
zen2han.set('ｌ', "l");
zen2han.set('ｍ', "m");
zen2han.set('ｎ', "n");
zen2han.set('ｏ', "o");
zen2han.set('ｐ', "p");
zen2han.set('ｑ', "q");
zen2han.set('ｒ', "r");
zen2han.set('ｓ', "s");
zen2han.set('ｔ', "t");
zen2han.set('ｕ', "u");
zen2han.set('ｖ', "v");
zen2han.set('ｗ', "w");
zen2han.set('ｘ', "x");
zen2han.set('ｙ', "y");
zen2han.set('ｚ', "z");
zen2han.set('｛', "{");
zen2han.set('｜', "|");
zen2han.set('｝', "}");
zen2han.set('～', "~");
zen2han.set('。', "｡");
zen2han.set('「', "｢");
zen2han.set('」', "｣");
zen2han.set('、', "､");
zen2han.set('・', "･");
zen2han.set('ヲ', "ｦ");
zen2han.set('ァ', "ｧ");
zen2han.set('ィ', "ｨ");
zen2han.set('ゥ', "ｩ");
zen2han.set('ェ', "ｪ");
zen2han.set('ォ', "ｫ");
zen2han.set('ャ', "ｬ");
zen2han.set('ュ', "ｭ");
zen2han.set('ョ', "ｮ");
zen2han.set('ッ', "ｯ");
zen2han.set('ー', "ｰ");
zen2han.set('ア', "ｱ");
zen2han.set('イ', "ｲ");
zen2han.set('ウ', "ｳ");
zen2han.set('エ', "ｴ");
zen2han.set('オ', "ｵ");
zen2han.set('カ', "ｶ");
zen2han.set('キ', "ｷ");
zen2han.set('ク', "ｸ");
zen2han.set('ケ', "ｹ");
zen2han.set('コ', "ｺ");
zen2han.set('サ', "ｻ");
zen2han.set('シ', "ｼ");
zen2han.set('ス', "ｽ");
zen2han.set('セ', "ｾ");
zen2han.set('ソ', "ｿ");
zen2han.set('タ', "ﾀ");
zen2han.set('チ', "ﾁ");
zen2han.set('ツ', "ﾂ");
zen2han.set('テ', "ﾃ");
zen2han.set('ト', "ﾄ");
zen2han.set('ナ', "ﾅ");
zen2han.set('ニ', "ﾆ");
zen2han.set('ヌ', "ﾇ");
zen2han.set('ネ', "ﾈ");
zen2han.set('ノ', "ﾉ");
zen2han.set('ハ', "ﾊ");
zen2han.set('ヒ', "ﾋ");
zen2han.set('フ', "ﾌ");
zen2han.set('ヘ', "ﾍ");
zen2han.set('ホ', "ﾎ");
zen2han.set('マ', "ﾏ");
zen2han.set('ミ', "ﾐ");
zen2han.set('ム', "ﾑ");
zen2han.set('メ', "ﾒ");
zen2han.set('モ', "ﾓ");
zen2han.set('ヤ', "ﾔ");
zen2han.set('ユ', "ﾕ");
zen2han.set('ヨ', "ﾖ");
zen2han.set('ラ', "ﾗ");
zen2han.set('リ', "ﾘ");
zen2han.set('ル', "ﾙ");
zen2han.set('レ', "ﾚ");
zen2han.set('ロ', "ﾛ");
zen2han.set('ワ', "ﾜ");
zen2han.set('ン', "ﾝ");
zen2han.set('゛', "ﾞ");
zen2han.set('゜', "ﾟ");
zen2han.set('ヴ', "ｳﾞ");
zen2han.set('ガ', "ｶﾞ");
zen2han.set('ギ', "ｷﾞ");
zen2han.set('グ', "ｸﾞ");
zen2han.set('ゲ', "ｹﾞ");
zen2han.set('ゴ', "ｺﾞ");
zen2han.set('ザ', "ｻﾞ");
zen2han.set('ジ', "ｼﾞ");
zen2han.set('ズ', "ｽﾞ");
zen2han.set('ゼ', "ｾﾞ");
zen2han.set('ゾ', "ｿﾞ");
zen2han.set('ダ', "ﾀﾞ");
zen2han.set('ヂ', "ﾁﾞ");
zen2han.set('ヅ', "ﾂﾞ");
zen2han.set('デ', "ﾃﾞ");
zen2han.set('ド', "ﾄﾞ");
zen2han.set('バ', "ﾊﾞ");
zen2han.set('ビ', "ﾋﾞ");
zen2han.set('ブ', "ﾌﾞ");
zen2han.set('ベ', "ﾍﾞ");
zen2han.set('ボ', "ﾎﾞ");
zen2han.set('パ', "ﾊﾟ");
zen2han.set('ピ', "ﾋﾟ");
zen2han.set('プ', "ﾌﾟ");
zen2han.set('ペ', "ﾍﾟ");
zen2han.set('ポ', "ﾎﾟ");
function han2zen_conv(source) {
    let sb = "";
    for (let c of source) {
        let a = han2zen.get(c);
        if (a == undefined) {
            sb += c;
        }
        else {
            sb += a;
        }
    }
    return sb;
}
function zen2han_conv(source) {
    let sb = "";
    for (let c of source) {
        let a = zen2han.get(c);
        if (a == undefined) {
            sb += c;
        }
        else {
            sb += a;
        }
    }
    return sb;
}
function hira2kata_conv(source) {
    let sb = "";
    for (let i = 0; i < source.length; i++) {
        const c = source.charCodeAt(i);
        if ('ぁ'.charCodeAt(0) <= c && c <= 'ゔ'.charCodeAt(0)) {
            sb += String.fromCharCode((c - 'ぁ'.charCodeAt(0) + 'ァ'.charCodeAt(0)));
        }
        else {
            sb += String.fromCharCode(c);
        }
    }
    return sb;
}

class LOUDSTrie {
    constructor(bitVector, edges) {
        this.bitVector = bitVector;
        this.edges = edges;
    }
    reverseLookup(index) {
        if (index <= 0 || this.edges.length <= index) {
            throw new RangeError();
        }
        const sb = new Array();
        while (index > 1) {
            sb.push(this.edges[index]);
            index = this.parent(index);
        }
        return String.fromCharCode(...sb.reverse());
    }
    parent(x) {
        return this.bitVector.rank(this.bitVector.select(x, true), false);
    }
    firstChild(x) {
        const y = this.bitVector.select(x, false) + 1;
        if (this.bitVector.get(y)) {
            return this.bitVector.rank(y, true) + 1;
        }
        else {
            return -1;
        }
    }
    traverse(index, c) {
        const firstChild = this.firstChild(index);
        if (firstChild == -1) {
            return -1;
        }
        const childStartBit = this.bitVector.select(firstChild, true);
        const childEndBit = this.bitVector.nextClearBit(childStartBit);
        const childSize = childEndBit - childStartBit;
        const result = binarySearchUint16(this.edges, firstChild, firstChild + childSize, c);
        return result >= 0 ? result : -1;
    }
    lookup(key) {
        let nodeIndex = 1;
        for (let i = 0; i < key.length; i++) {
            const c = key.charCodeAt(i);
            nodeIndex = this.traverse(nodeIndex, c);
            if (nodeIndex == -1) {
                break;
            }
        }
        return (nodeIndex >= 0) ? nodeIndex : -1;
    }
    *predictiveSearch(index) {
        let lower = index;
        let upper = index + 1;
        while (upper - lower > 0) {
            for (let i = lower; i < upper; i++) {
                yield i;
            }
            lower = this.bitVector.rank(this.bitVector.select(lower, false) + 1, true) + 1;
            upper = this.bitVector.rank(this.bitVector.select(upper, false) + 1, true) + 1;
        }
    }
    size() {
        return this.edges.length - 2;
    }
}

class CompactDictionary {
    constructor(buffer) {
        const dv = new DataView(buffer);
        let offset = 0;
        [this.keyTrie, offset] = CompactDictionary.readTrie(dv, offset, true);
        [this.valueTrie, offset] = CompactDictionary.readTrie(dv, offset, false);
        const mappingBitVectorSize = dv.getUint32(offset);
        offset += 4;
        const mappingBitVectorWords = new Uint32Array(((mappingBitVectorSize + 63) >> 6) * 2);
        for (let i = 0; i < mappingBitVectorWords.length >> 1; i++) {
            mappingBitVectorWords[i * 2 + 1] = dv.getUint32(offset);
            offset += 4;
            mappingBitVectorWords[i * 2] = dv.getUint32(offset);
            offset += 4;
        }
        this.mappingBitVector = new BitVector(mappingBitVectorWords, mappingBitVectorSize);
        const mappingSize = dv.getUint32(offset);
        offset += 4;
        this.mapping = new Int32Array(mappingSize);
        for (let i = 0; i < mappingSize; i++) {
            this.mapping[i] = dv.getInt32(offset);
            offset += 4;
        }
        if (offset != buffer.byteLength) {
            throw new Error();
        }
        this.hasMappingBitList = CompactDictionary.createHasMappingBitList(this.mappingBitVector);
    }
    static readTrie(dv, offset, compactHiragana) {
        const keyTrieEdgeSize = dv.getInt32(offset);
        offset += 4;
        const keyTrieEdges = new Uint16Array(keyTrieEdgeSize);
        for (let i = 0; i < keyTrieEdgeSize; i++) {
            let c;
            if (compactHiragana) {
                c = this.decode(dv.getUint8(offset));
                offset += 1;
            }
            else {
                c = dv.getUint16(offset);
                offset += 2;
            }
            keyTrieEdges[i] = c;
        }
        const keyTrieBitVectorSize = dv.getUint32(offset);
        offset += 4;
        const keyTrieBitVectorWords = new Uint32Array(((keyTrieBitVectorSize + 63) >> 6) * 2);
        for (let i = 0; i < keyTrieBitVectorWords.length >>> 1; i++) {
            keyTrieBitVectorWords[i * 2 + 1] = dv.getUint32(offset);
            offset += 4;
            keyTrieBitVectorWords[i * 2] = dv.getUint32(offset);
            offset += 4;
        }
        return [new LOUDSTrie(new BitVector(keyTrieBitVectorWords, keyTrieBitVectorSize), keyTrieEdges), offset];
    }
    static decode(c) {
        if (0x20 <= c && c <= 0x7e) {
            return c;
        }
        if (0xa1 <= c && c <= 0xf6) {
            return (c + 0x3040 - 0xa0);
        }
        if (c === 0xf7) {
            return 0x30fc;
        }
        throw new RangeError();
    }
    static encode(c) {
        if (0x20 <= c && c <= 0x7e) {
            return c;
        }
        if (0x3041 <= c && c <= 0x3096) {
            return (c - 0x3040 + 0xa0);
        }
        if (c === 0x30fc) {
            return 0xf7;
        }
        throw new RangeError();
    }
    static createHasMappingBitList(mappingBitVector) {
        const numOfNodes = mappingBitVector.rank(mappingBitVector.size() + 1, false);
        const bitList = new BitList(numOfNodes);
        let bitPosition = 0;
        for (let node = 1; node < numOfNodes; node++) {
            let hasMapping = mappingBitVector.get(bitPosition + 1);
            bitList.set(node, hasMapping);
            bitPosition = mappingBitVector.nextClearBit(bitPosition + 1);
        }
        return bitList;
    }
    *search(key) {
        const keyIndex = this.keyTrie.lookup(key);
        if (keyIndex != -1 && this.hasMappingBitList.get(keyIndex)) {
            const valueStartPos = this.mappingBitVector.select(keyIndex, false);
            const valueEndPos = this.mappingBitVector.nextClearBit(valueStartPos + 1);
            const size = valueEndPos - valueStartPos - 1;
            if (size > 0) {
                const offset = this.mappingBitVector.rank(valueStartPos, false);
                for (let i = 0; i < size; i++) {
                    yield this.valueTrie.reverseLookup(this.mapping[valueStartPos - offset + i]);
                }
            }
        }
    }
    *predictiveSearch(key) {
        const keyIndex = this.keyTrie.lookup(key);
        if (keyIndex > 1) {
            for (let i of this.keyTrie.predictiveSearch(keyIndex)) {
                if (this.hasMappingBitList.get(i)) {
                    const valueStartPos = this.mappingBitVector.select(i, false);
                    const valueEndPos = this.mappingBitVector.nextClearBit(valueStartPos + 1);
                    const size = valueEndPos - valueStartPos - 1;
                    const offset = this.mappingBitVector.rank(valueStartPos, false);
                    for (let j = 0; j < size; j++) {
                        yield this.valueTrie.reverseLookup(this.mapping[valueStartPos - offset + j]);
                    }
                }
            }
        }
    }
}

class LOUDSTrieBuilder {
    static build(keys) {
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] == null) {
                throw new Error();
            }
            if (i > 0 && keys[i - 1] > keys[i]) {
                throw new Error();
            }
        }
        const nodes = new Uint32Array(keys.length);
        for (let i = 0; i < nodes.length; i++) {
            nodes[i] = 1;
        }
        let cursor = 0;
        let currentNode = 1;
        let edges = "  ";
        const louds = new BitList();
        louds.add(true);
        while (true) {
            let lastChar = 0;
            let lastParent = 0;
            let restKeys = 0;
            for (let i = 0; i < keys.length; i++) {
                if (keys[i].length < cursor) {
                    continue;
                }
                if (keys[i].length == cursor) {
                    louds.add(false);
                    lastParent = nodes[i];
                    lastChar = 0;
                    continue;
                }
                const currentChar = keys[i].charCodeAt(cursor);
                const currentParent = nodes[i];
                if (lastParent != currentParent) {
                    louds.add(false);
                    louds.add(true);
                    edges += String.fromCharCode(currentChar);
                    currentNode = currentNode + 1;
                }
                else if (lastChar != currentChar) {
                    louds.add(true);
                    edges += String.fromCharCode(currentChar);
                    currentNode = currentNode + 1;
                }
                nodes[i] = currentNode;
                lastChar = currentChar;
                lastParent = currentParent;
                restKeys++;
            }
            if (restKeys == 0) {
                break;
            }
            cursor++;
        }
        const bitVectorWords = new Uint32Array(louds.words.buffer, 0, ((louds.size + 63) >> 6) * 2);
        const bitVector = new BitVector(bitVectorWords, louds.size);
        const uint16Edges = new Uint16Array(edges.length);
        for (let i = 0; i < edges.length; i++) {
            uint16Edges[i] = edges.charCodeAt(i);
        }
        return [new LOUDSTrie(bitVector, uint16Edges), nodes];
    }
}

class CompactHiraganaString {
    static decodeBytes(bytes) {
        let result = "";
        for (let i = 0; i < bytes.length; i++) {
            result += CompactHiraganaString.decodeByte(bytes[i]);
        }
        return result;
    }
    static decodeByte(c) {
        if (0x20 <= c && c <= 0x7e) {
            return String.fromCharCode(c);
        }
        if (0xa1 <= c && c <= 0xf6) {
            return String.fromCharCode(c + 0x3040 - 0xa0);
        }
        if (c === 0xf7) {
            return '\u30fc';
        }
        throw new RangeError();
    }
    static encodeString(str) {
        const result = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            result[i] = CompactHiraganaString.encodeChar(str.charCodeAt(i));
        }
        return result;
    }
    static encodeChar(b) {
        if (b == 0) {
            return 0;
        }
        if (0x20 <= b && b <= 0x7e) {
            return b;
        }
        if (0x3041 <= b && b <= 0x3096) {
            return b - 0x3040 + 0xa0;
        }
        if (b === 0x30fc) {
            return 0xf7;
        }
        throw new RangeError('unknown character to encode: ' + b);
    }
}

class CompactDictionaryBuilder {
    static build(dict) {
        // remove some keys
        const keysToRemove = new Array();
        for (const key of dict.keys()) {
            try {
                CompactHiraganaString.encodeString(key);
            }
            catch (e) {
                keysToRemove.push(key);
                console.log("skipped the world: " + key);
            }
        }
        for (const key of keysToRemove) {
            dict.delete(key);
        }
        // build key trie
        const keys = Array.from(dict.keys()).sort();
        const keyTrie = LOUDSTrieBuilder.build(keys)[0];
        // build value trie
        const valuesSet = new Set();
        for (const value of dict.values()) {
            for (const v of value) {
                valuesSet.add(v);
            }
        }
        const values = Array.from(valuesSet.values()).sort();
        const valueTrie = LOUDSTrieBuilder.build(values)[0];
        // build trie mapping
        let mappingCount = 0;
        for (const i of dict.values()) {
            mappingCount += i.length;
        }
        const mapping = new Uint32Array(mappingCount);
        let mappingIndex = 0;
        const mappingBitList = new BitList();
        for (let i = 1; i <= keyTrie.size() + 1; i++) {
            let key = keyTrie.reverseLookup(i);
            mappingBitList.add(false);
            let values = dict.get(key);
            if (values != undefined) {
                for (let j = 0; j < values.length; j++) {
                    mappingBitList.add(true);
                    mapping[mappingIndex] = valueTrie.lookup(values[j]);
                    mappingIndex++;
                }
            }
        }
        // calculate output size
        const keyTrieDataSize = 8 + keyTrie.edges.length + ((keyTrie.bitVector.size() + 63) >>> 6) * 8;
        const valueTrieDataSize = 8 + valueTrie.edges.length * 2 + ((valueTrie.bitVector.size() + 63) >>> 6) * 8;
        const mappingDataSize = 8 + ((mappingBitList.size + 63) >>> 6) * 8 + mapping.length * 4;
        const outputDataSize = keyTrieDataSize + valueTrieDataSize + mappingDataSize;
        // ready output
        const arrayBuffer = new ArrayBuffer(outputDataSize);
        const dataView = new DataView(arrayBuffer);
        let dataViewIndex = 0;
        // output key trie
        dataView.setInt32(dataViewIndex, keyTrie.edges.length);
        dataViewIndex += 4;
        for (let i = 0; i < keyTrie.edges.length; i++) {
            const compactChar = CompactHiraganaString.encodeChar(keyTrie.edges[i]);
            dataView.setUint8(dataViewIndex, compactChar);
            dataViewIndex += 1;
        }
        dataView.setInt32(dataViewIndex, keyTrie.bitVector.size());
        dataViewIndex += 4;
        const keyTrieBitVectorWords = keyTrie.bitVector.words;
        for (let i = 0; i < keyTrieBitVectorWords.length >>> 1; i++) {
            dataView.setUint32(dataViewIndex, keyTrieBitVectorWords[i * 2 + 1]);
            dataViewIndex += 4;
            dataView.setUint32(dataViewIndex, keyTrieBitVectorWords[i * 2]);
            dataViewIndex += 4;
        }
        // output value trie
        dataView.setInt32(dataViewIndex, valueTrie.edges.length);
        dataViewIndex += 4;
        for (let i = 0; i < valueTrie.edges.length; i++) {
            dataView.setUint16(dataViewIndex, valueTrie.edges[i]);
            dataViewIndex += 2;
        }
        dataView.setInt32(dataViewIndex, valueTrie.bitVector.size());
        dataViewIndex += 4;
        const valueTrieBitVectorWords = valueTrie.bitVector.words;
        for (let i = 0; i < valueTrieBitVectorWords.length >>> 1; i++) {
            dataView.setUint32(dataViewIndex, valueTrieBitVectorWords[i * 2 + 1]);
            dataViewIndex += 4;
            dataView.setUint32(dataViewIndex, valueTrieBitVectorWords[i * 2]);
            dataViewIndex += 4;
        }
        // output mapping
        dataView.setInt32(dataViewIndex, mappingBitList.size);
        dataViewIndex += 4;
        const mappingWordsLen = (mappingBitList.size + 63) >> 6;
        for (let i = 0; i < mappingWordsLen; i++) {
            dataView.setUint32(dataViewIndex, mappingBitList.words[i * 2 + 1]);
            dataViewIndex += 4;
            dataView.setUint32(dataViewIndex, mappingBitList.words[i * 2]);
            dataViewIndex += 4;
        }
        // TODO: padding to 64bit words
        dataView.setInt32(dataViewIndex, mapping.length);
        dataViewIndex += 4;
        for (let i = 0; i < mapping.length; i++) {
            dataView.setUint32(dataViewIndex, mapping[i]);
            dataViewIndex += 4;
        }
        // check data size
        if (dataViewIndex !== outputDataSize) {
            throw new Error(`file size is not valid: expected=${outputDataSize} actual=${dataViewIndex}`);
        }
        return arrayBuffer;
    }
}

class DoubleArray {
    constructor(base, check, charConverter, charSize) {
        this.base = base;
        this.check = check;
        this.charConverter = charConverter;
        this.charSize = charSize;
    }
    traverse(n, k) {
        const m = this.base[n] + k;
        if (this.check[m] == n) {
            return m;
        }
        else {
            return -1;
        }
    }
    lookup(str) {
        if (str.length == 0) {
            return 0;
        }
        let n = 0;
        for (let i = 0; i < str.length; i++) {
            const c = this.charConverter(str.charCodeAt(i));
            if (c < 1) {
                throw new Error();
            }
            n = this.traverse(n, c);
            if (n == -1) {
                return -1;
            }
        }
        return n;
    }
    *commonPrefixSearch(key) {
        let index = 0;
        let offset = 0;
        while (index != -1) {
            const lastIndex = index;
            if (offset == key.length) {
                index = -1;
            }
            else {
                const c = this.charConverter(key.charCodeAt(offset));
                index = this.traverse(index, c);
                offset++;
            }
            yield lastIndex;
        }
    }
    *predictiveSearch(key) {
        const n = this.lookup(key);
        if (n == -1) {
            return;
        }
        yield* this.visitRecursive(n);
    }
    *visitRecursive(n) {
        yield n;
        for (let i = 0; i < this.charSize; i++) {
            const m = this.base[n] + i + 1;
            if (m >= this.check.length) {
                return;
            }
            if (this.check[m] == n) {
                yield* this.visitRecursive(m);
            }
        }
    }
}

class TernaryRegexNode {
    constructor() {
        this.value = 0;
        this.child = null;
        this.left = null;
        this.right = null;
        this.level = 0;
    }
    successor() {
        let t = this.right;
        while (t.left != null) {
            t = t.left;
        }
        return t;
    }
    predecessor() {
        let t = this.left;
        while (t.left != null) {
            t = t.left;
        }
        while (t.right != null) {
            t = t.right;
        }
        return t;
    }
}
function skew(t) {
    if (t == null) {
        return null;
    }
    else if (t.left == null) {
        return t;
    }
    else if (t.left.level == t.level) {
        let l = t.left;
        t.left = l.right;
        l.right = t;
        return l;
    }
    else {
        return t;
    }
}
function split(t) {
    if (t == null) {
        return null;
    }
    else if (t.right == null || t.right.right == null) {
        return t;
    }
    else if (t.level == t.right.right.level) {
        let r = t.right;
        t.right = r.left;
        r.left = t;
        r.level = r.level + 1;
        return r;
    }
    else {
        return t;
    }
}
function add(node, word, offset) {
    if (offset < word.length) {
        let [node_, target, inserted] = insert(word.charCodeAt(offset), node);
        if (inserted || target.child != null) {
            target.child = add(target.child, word, offset + 1);
        }
        return node_;
    }
    else {
        return null;
    }
}
function* traverseSiblings(node) {
    if (node != null) {
        yield* traverseSiblings(node.left);
        yield node;
        yield* traverseSiblings(node.right);
    }
}
function insert(x, t) {
    let r;
    let inserted = false;
    if (t == null) {
        r = new TernaryRegexNode();
        r.value = x;
        r.level = 1;
        r.left = null;
        r.right = null;
        return [r, r, true];
    }
    else if (x < t.value) {
        [t.left, r, inserted] = insert(x, t.left);
    }
    else if (x > t.value) {
        [t.right, r, inserted] = insert(x, t.right);
    }
    else {
        return [t, t, false];
    }
    t = skew(t);
    t = split(t);
    return [t, r, inserted];
}
class TernaryRegexGenerator {
    constructor(or, beginGroup, endGroup, beginClass, endClass, newline, escape) {
        this.or = or;
        this.beginGroup = beginGroup;
        this.endGroup = endGroup;
        this.beginClass = beginClass;
        this.endClass = endClass;
        this.newline = newline;
        this.root = null;
        this.escapedCharacters = TernaryRegexGenerator.initializeEscapeCharacters(escape);
        this.escapeCharacterLeader = '\\';
    }
    static getDEFAULT() {
        const ESCAPE = "\\.[]{}()*+-?^$|";
        return new TernaryRegexGenerator("|", "(", ")", "[", "]", "", ESCAPE);
    }
    static initializeEscapeCharacters(escape) {
        const bits = new BitList(128);
        for (let i = 0; i < escape.length; i++) {
            const c = escape.charCodeAt(i);
            if (c < 128) {
                bits.set(c, true);
            }
            else {
                throw new Error("アスキー文字のみエスケープできます");
            }
        }
        return bits;
    }
    add(word) {
        if (word.length == 0) {
            return;
        }
        this.root = add(this.root, word, 0);
    }
    generateStub(node) {
        let buf = "";
        let brother = 0;
        let haschild = 0;
        for (let n of traverseSiblings(node)) {
            brother++;
            if (n.child != null) {
                haschild++;
            }
        }
        const nochild = brother - haschild;
        if (brother > 1 && haschild > 0) {
            buf += this.beginGroup;
        }
        if (nochild > 0) {
            if (nochild > 1) {
                buf += this.beginClass;
            }
            for (let n of traverseSiblings(node)) {
                if (n.child != null) {
                    continue;
                }
                if (n.value < 128 && this.escapedCharacters.get(n.value)) {
                    buf += this.escapeCharacterLeader;
                }
                buf += String.fromCharCode(n.value);
            }
            if (nochild > 1) {
                buf += this.endClass;
            }
        }
        if (haschild > 0) {
            if (nochild > 0) {
                buf += this.or;
            }
            for (let n of traverseSiblings(node)) {
                if (n.child != null) {
                    if (n.value < 128 && this.escapedCharacters.get(n.value)) {
                        buf += this.escapeCharacterLeader;
                    }
                    buf += String.fromCharCode(n.value);
                    if (this.newline != null) { // TODO: always true
                        buf += this.newline;
                    }
                    buf += this.generateStub(n.child);
                    if (haschild > 1) {
                        buf += this.or;
                    }
                }
            }
            if (haschild > 1) {
                buf = buf.substring(0, buf.length - this.or.length);
            }
        }
        if (brother > 1 && haschild > 0) {
            buf += this.endGroup;
        }
        return buf;
    }
    generate() {
        if (this.root == null) {
            return "";
        }
        else {
            return this.generateStub(this.root);
        }
    }
    setEscapeCharacterLeader(leader) {
        this.escapeCharacterLeader = leader;
    }
}

class RomajiPredictiveResult {
    constructor(prefix, suffixes) {
        this.prefix = prefix;
        this.suffixes = suffixes;
    }
}

class RomajiProcessor2 {
    constructor(trie, hiraganaList, remainList) {
        this.trie = trie;
        this.hiraganaList = hiraganaList;
        this.remainList = remainList;
    }
    static build() {
        const base = new Int16Array([0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 26, 31, 95, -1, 100, 121, 147, -1, 175, 182, 203, 229, 251, -1, 266, 284, 291, 302, 334, -1, 379, 401, 420, 432, 464, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 50, 49, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 28, -1, -1, -1, -1, 52, -1, -1, -1, -1, -1, -1, 24, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 21, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 57, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 67, -1, -1, -1, -1, -1, -1, -1, 34, -1, -1, -1, -1, -1, -1, 76, -1, 93, -1, -1, -1, -1, 59, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 118, -1, 136, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 149, -1, 158, -1, 23, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 160, -1, -1, -1, -1, 177, -1, 201, -1, -1, -1, -1, -1, -1, 61, -1, -1, -1, -1, -1, -1, -1, -1, 44, -1, -1, 47, -1, 212, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 230, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 248, 86, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 269, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 317, -1, -1, -1, -1, -1, 293, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 319, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 343, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 360, -1, -1, -1, 361, -1, 362, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 384, -1, -1, -1, -1, 402, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 46, -1, 74, -1, -1, -1, -1, 85, -1, -1, -1, -1, -1, -1, -1, -1, 68, -1, -1, 83, -1, 427, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 445, -1]);
        const check = new Int16Array([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 98, 98, 147, 0, 98, 99, 147, 99, 98, 99, 147, 100, 99, 99, 98, 171, 147, 270, 159, 99, 98, 322, 147, 135, 98, 99, 152, 135, 207, 99, 152, 135, 134, 221, 152, 310, 319, 135, 319, 310, 152, 199, 520, 135, 134, 199, 152, 221, 134, 199, 214, 183, 522, 221, 214, 199, 522, 539, 214, 527, 536, 199, 536, 527, 214, -1, -1, 216, 373, 100, 214, 216, 100, 100, 102, 216, 100, 100, 102, 102, 373, 216, 102, 100, 373, -1, -1, 216, 102, 100, -1, 100, 240, 100, 102, 103, 240, -1, 102, 103, 240, 103, -1, 103, -1, -1, 240, -1, -1, 103, 242, -1, 240, -1, 242, 103, -1, 103, 242, 103, -1, 104, -1, 266, 242, 104, -1, 266, 104, 104, 242, 266, 268, -1, 296, 104, 268, 266, 296, -1, 268, 104, 296, 104, -1, 104, 268, 266, 296, 106, -1, 301, 268, 106, 296, 301, 107, 106, 106, 301, 107, -1, -1, 106, 107, 301, 107, 110, -1, 106, 107, 301, -1, 106, -1, 303, 107, 108, 107, 303, 107, 108, -1, 303, -1, 108, 324, 108, 108, 303, 324, 108, -1, -1, 324, 303, 108, 108, -1, 108, 324, 108, -1, 109, 350, -1, 324, 109, 350, -1, -1, 109, 350, -1, -1, 109, -1, 109, 350, -1, -1, -1, 372, 109, 350, 110, 372, 109, -1, 110, 372, -1, -1, 110, -1, -1, 372, -1, 110, 110, 112, -1, 372, 387, 112, 110, -1, 387, 112, 110, 116, 387, -1, -1, 112, 112, -1, 387, 113, -1, 112, -1, 113, 387, 112, 114, 113, 412, -1, 114, -1, 412, 113, 114, 113, 412, 115, -1, 113, 114, 115, 412, 114, 115, 115, 114, -1, 412, -1, 114, 115, 406, -1, 423, 115, 406, 115, 423, -1, 406, 115, 423, -1, -1, -1, 406, -1, 423, 116, -1, -1, 406, 116, 423, -1, 116, 116, 438, -1, -1, -1, 438, 116, -1, -1, 438, 116, 116, 116, -1, 116, 438, 116, -1, 449, 453, 455, 438, 449, 453, 455, -1, 449, 453, 455, -1, -1, -1, 449, 453, 455, -1, -1, 118, 449, 453, 455, 118, 500, -1, -1, 118, 500, -1, -1, -1, 500, 118, -1, -1, -1, -1, 500, 118, 118, 119, 505, 118, 500, 119, 505, -1, 119, 119, 505, 122, 122, 122, 122, 119, 505, -1, -1, -1, 120, 119, 505, 119, 120, 119, -1, 541, 120, -1, 120, 541, 121, 120, 120, 541, 121, -1, -1, 120, 120, 541, 120, 120, 120, 585, 121, 541, -1, 585, -1, -1, 121, 585, -1, -1, 121, -1, 122, 585, 122, -1, -1, -1, 122, 585, -1, -1, 122, -1, -1, 122, 122, 122, 122, 122, -1, -1, 122, -1, -1, -1, -1, -1, 122, -1, -1, -1, 122, 122]);
        const remainList = new Int8Array([-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, -1, -1, -1, 0, 0, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0, -1, -1, 0, -1, 0, 0, 0, -1, -1, 0, 0, 1, -1, 0, -1, -1, 0, -1, -1, 0, 0, -1, 0, -1, 0, 0, -1, -1, 0, -1, -1, 0, -1, 0, 0, 0, -1, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, -1, 0, 0, 0, -1, -1, -1, 0, -1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -1, -1, 0, 0, 0, 1, 0, -1, 0, 0, 0, -1, -1, -1, 0, 0, 0, -1, 0, -1, 0, -1, 0, -1, 0, 0, -1, 1, 0, 0, 0, -1, -1, 0, 0, -1, 0, -1, -1, 0, -1, -1, 0, 0, -1, 0, 0, 0, -1, -1, 0, 0, -1, -1, 1, -1, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0, -1, -1, 0, 0, -1, -1, 0, -1, -1, 0, -1, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, -1, -1, 0, -1, -1, 0, 1, -1, 0, 0, -1, 0, -1, 0, 0, -1, 0, 0, 0, -1, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 1, -1, 0, 0, -1, 0, -1, -1, 0, 0, -1, 0, 1, 0, 0, 0, -1, 0, -1, 0, -1, -1, -1, 0, -1, 0, 0, -1, -1, 0, 0, 0, -1, -1, 0, 0, -1, -1, -1, 0, 0, -1, -1, 0, -1, 1, 0, -1, -1, 0, -1, -1, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, -1, -1, -1, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0, 0, -1, -1, 0, 0, -1, -1, -1, 0, 0, -1, -1, -1, -1, 0, 0, 1, 0, 0, -1, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0, 1, 0, -1, -1, 0, 0, -1, -1, 0, 0, 0, 0, 0, 0, -1, -1, -1, 0, 0, -1, 1, -1, 0, 0, 0, -1, 0, -1, -1, 0, 0, -1, -1, 1, -1, 0, 0, 0, -1, -1, -1, 0, 0, -1, -1, 0, -1, -1, 0, 0, 0, 0, 0, -1, -1, 0, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, 1]);
        const hiraganaList = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "、", "ー", "。", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "「", "", "」", "", "", "", "あ", "", "", "", "え", "", "", "", "い", "", "", "", "", "ん", "お", "", "", "", "", "", "う", "", "", "", "", "", "ば", "っ", "びゃ", "〜", "べ", "か", "びぇ", "っ", "び", "せ", "びぃ", "", "", "し", "ぼ", "でゅ", "びょ", "ふゅ", "っ", "こ", "ぶ", "ゎ", "びゅ", "ちゃ", "", "く", "ちゃ", "ちぇ", "てゅ", "", "ちぇ", "ち", "でぃ", "ふゃ", "ちぃ", "ヵ", "", "ちょ", "っ", "ヶ", "ちょ", "でゃ", "w", "ちゅ", "どぅ", "でぇ", "ちゅ", "ふょ", "", "でぃ", "どぁ", "っ", "ゑ", "ふゅ", "どぇ", "でょ", "ゐ", "ゎ", "どぃ", "ヵ", "", "でゅ", "っ", "ヶ", "どぉ", "", "", "ぢゃ", "てぃ", "だ", "どぅ", "ぢぇ", "っ", "で", "ふぁ", "ぢぃ", "", "ぢ", "ふぇ", "っ", "とぅ", "ぢょ", "ふぃ", "ど", "", "", "", "ぢゅ", "ふぉ", "づ", "", "", "ぐぁ", "", "ふ", "が", "ぐぇ", "", "", "げ", "ぐぃ", "っ", "", "ぎ", "", "", "ぐぉ", "", "", "ご", "ぎゃ", "", "ぐぅ", "", "ぎぇ", "ぐ", "", "", "ぎぃ", "", "", "は", "", "ふぁ", "ぎょ", "へ", "", "ふぇ", "っ", "ひ", "ぎゅ", "ふぃ", "ひゃ", "", "じゃ", "ほ", "ひぇ", "ふぉ", "じぇ", "", "ひぃ", "ふ", "じぃ", "", "", "", "ひょ", "", "じょ", "じゃ", "", "くぁ", "ひゅ", "じぇ", "じゅ", "くぇ", "か", "じ", "っ", "くぃ", "け", "", "", "じょ", "き", "くぉ", "っ", "ん", "", "じゅ", "こ", "くぅ", "", "", "", "きゃ", "く", "ぁ", "", "きぇ", "", "ぇ", "", "きぃ", "", "ぃ", "ゃ", "", "っ", "きょ", "ぇ", "ぉ", "", "", "ぃ", "きゅ", "", "ぅ", "", "", "ょ", "", "", "ま", "みゃ", "", "ゅ", "め", "みぇ", "", "", "み", "みぃ", "", "", "っ", "", "も", "みょ", "", "", "", "にゃ", "む", "みゅ", "な", "にぇ", "", "", "ね", "にぃ", "", "", "に", "", "", "にょ", "", "ん", "の", "ぱ", "", "にゅ", "ぴゃ", "ぺ", "ぬ", "", "ぴぇ", "ぴ", "", "", "ぴぃ", "", "", "ぽ", "っ", "", "ぴょ", "くぁ", "", "ぷ", "", "くぇ", "ぴゅ", "", "ら", "くぃ", "りゃ", "", "れ", "", "りぇ", "くぉ", "り", "っ", "りぃ", "さ", "", "く", "ろ", "せ", "りょ", "っ", "", "し", "る", "", "りゅ", "", "", "そ", "しゃ", "", "しゃ", "っ", "しぇ", "す", "しぇ", "", "し", "", "しぃ", "", "", "", "しょ", "", "しょ", "た", "", "", "しゅ", "て", "しゅ", "", "", "ち", "てゃ", "", "", "", "てぇ", "と", "", "", "てぃ", "", "っ", "つ", "", "", "てょ", "", "", "つぁ", "とぁ", "ちゃ", "てゅ", "つぇ", "とぇ", "ちぇ", "", "つぃ", "とぃ", "ちぃ", "", "", "", "つぉ", "とぉ", "ちょ", "", "", "ゔぁ", "つ", "とぅ", "ちゅ", "ゔぇ", "ゔゃ", "", "", "ゔぃ", "ゔぇ", "", "", "", "ゔぃ", "ゔぉ", "", "", "", "", "ゔょ", "ゔ", "っ", "わ", "うぁ", "", "ゔゅ", "うぇ", "うぇ", "", "", "うぃ", "うぃ", "‥", "〜", "…", "・", "を", "うぉ", "", "", "", "ぁ", "う", "う", "っ", "ぇ", "", "", "ゃ", "ぃ", "", "", "ぇ", "や", "ん", "ぉ", "ぃ", "いぇ", "", "", "", "ぅ", "ょ", "", "っ", "", "じゃ", "よ", "ゅ", "", "じぇ", "", "", "ゆ", "じぃ", "", "", "っ", "", "『", "じょ", "』", "", "", "", "ざ", "じゅ", "", "", "ぜ", "", "", "←", "じ", "↓", "↑", "→", "", "", "ぞ", "", "", "", "", "", "ず", "", "", "", "", "っ"];
        const code = function (c) {
            return c;
        };
        const trie = new DoubleArray(base, check, code, 128);
        return new RomajiProcessor2(trie, hiraganaList, remainList);
    }
    romajiToHiragana(romaji) {
        let buffer = "";
        let cursor = 0;
        while (cursor < romaji.length) {
            let longestNode = -1;
            let length = -1;
            for (let i of this.trie.commonPrefixSearch(romaji.substr(cursor))) {
                if (this.remainList[i] != -1) {
                    longestNode = i;
                }
                length++;
            }
            if (longestNode == -1) {
                buffer = buffer + romaji.charAt(cursor);
                cursor++;
            }
            else {
                buffer = buffer + this.hiraganaList[longestNode];
                cursor = cursor + length - this.remainList[longestNode];
            }
        }
        return buffer;
    }
    romajiToHiraganaPredictively(romaji) {
        let builder = "";
        let cursor = 0;
        while (cursor < romaji.length) {
            let longestNode = -1;
            let length = 0;
            for (let node of this.trie.commonPrefixSearch(romaji.substr(cursor))) {
                if (this.remainList[node] != -1) {
                    longestNode = node;
                }
                length++;
            }
            if (length + cursor - 1 == romaji.length) {
                let set = new Set();
                for (let node of this.trie.predictiveSearch(romaji.substr(cursor))) {
                    if (this.remainList[node] != -1) {
                        set.add(this.hiraganaList[node]);
                    }
                }
                let list = new Array();
                for (let e of set) {
                    list.push(e);
                }
                if (list.length == 1) {
                    builder = builder + list[0];
                    return new RomajiPredictiveResult(builder, [""]);
                }
                else {
                    return new RomajiPredictiveResult(builder, list);
                }
            }
            else if (longestNode >= 0) {
                builder = builder + this.hiraganaList[longestNode];
                cursor = cursor + length - 1 - this.remainList[longestNode];
            }
            else {
                builder = builder + romaji[cursor];
                cursor++;
            }
        }
        return new RomajiPredictiveResult(builder, [""]);
    }
}

class Migemo {
    constructor() {
        this.dict = null;
        this.rxop = null;
        this.processor = RomajiProcessor2.build();
        this.escapeCharacterLeader = '\\';
    }
    queryAWord(word) {
        const generator = this.rxop === null ? TernaryRegexGenerator.getDEFAULT() : new TernaryRegexGenerator(this.rxop[0], this.rxop[1], this.rxop[2], this.rxop[3], this.rxop[4], this.rxop[5], this.rxop[6]);
        // query自信はもちろん候補に加える
        generator.add(word);
        // queryそのものでの辞書引き
        const lower = word.toLowerCase();
        if (this.dict != null) {
            for (const word of this.dict.predictiveSearch(lower)) {
                generator.add(word);
            }
        }
        // queryを全角にして候補に加える
        const zen = han2zen_conv(word);
        generator.add(zen);
        // queryを半角にして候補に加える
        const han = zen2han_conv(word);
        generator.add(han);
        // 平仮名、カタカナ、及びそれによる辞書引き追加
        const hiraganaResult = this.processor.romajiToHiraganaPredictively(lower);
        for (const a of hiraganaResult.suffixes) {
            const hira = hiraganaResult.prefix + a;
            generator.add(hira);
            // 平仮名による辞書引き
            if (this.dict != null) {
                for (const b of this.dict.predictiveSearch(hira)) {
                    generator.add(b);
                }
            }
            // 片仮名文字列を生成し候補に加える
            const kata = hira2kata_conv(hira);
            generator.add(kata);
            // 半角カナを生成し候補に加える
            generator.add(zen2han_conv(kata));
        }
        generator.setEscapeCharacterLeader(this.escapeCharacterLeader);
        return generator.generate();
    }
    query(word) {
        if (word == "") {
            return "";
        }
        const words = this.parseQuery(word);
        let result = "";
        for (const w of words) {
            result += this.queryAWord(w);
        }
        return result;
    }
    setDict(dict) {
        this.dict = dict;
    }
    setRxop(rxop) {
        this.rxop = rxop;
    }
    setEscapeCharacterLeader(leader) {
        this.escapeCharacterLeader = leader;
    }
    setRomajiProcessor(processor) {
        this.processor = processor;
    }
    *parseQuery(query) {
        const re = /[^A-Z\s]+|[A-Z]{2,}|([A-Z][^A-Z\s]+)|([A-Z]\s*$)/g;
        let myArray;
        while ((myArray = re.exec(query)) !== null) {
            yield myArray[0];
        }
    }
}

class RomanEntry {
    constructor(roman, hiragana, remain) {
        this.roman = roman;
        this.hiragana = hiragana;
        this.remain = remain;
        this.index = RomanEntry.calculateIndex(roman);
    }
    static _calculateIndex(roman, start, end) {
        let result = 0;
        for (let i = 0; i < 4; i++) {
            const index = i + start;
            const c = index < roman.length && index < end ? roman.charCodeAt(index) : 0;
            result |= c;
            if (i < 3) {
                result <<= 8;
            }
        }
        return result;
    }
    static calculateIndex(roman) {
        return RomanEntry._calculateIndex(roman, 0, 4);
    }
}
const ROMAN_ENTRIES = [
    new RomanEntry("-", "ー", 0),
    new RomanEntry("~", "〜", 0),
    new RomanEntry(".", "。", 0),
    new RomanEntry(",", "、", 0),
    new RomanEntry("z/", "・", 0),
    new RomanEntry("z.", "…", 0),
    new RomanEntry("z,", "‥", 0),
    new RomanEntry("zh", "←", 0),
    new RomanEntry("zj", "↓", 0),
    new RomanEntry("zk", "↑", 0),
    new RomanEntry("zl", "→", 0),
    new RomanEntry("z-", "〜", 0),
    new RomanEntry("z[", "『", 0),
    new RomanEntry("z]", "』", 0),
    new RomanEntry("[", "「", 0),
    new RomanEntry("]", "」", 0),
    new RomanEntry("va", "ゔぁ", 0),
    new RomanEntry("vi", "ゔぃ", 0),
    new RomanEntry("vu", "ゔ", 0),
    new RomanEntry("ve", "ゔぇ", 0),
    new RomanEntry("vo", "ゔぉ", 0),
    new RomanEntry("vya", "ゔゃ", 0),
    new RomanEntry("vyi", "ゔぃ", 0),
    new RomanEntry("vyu", "ゔゅ", 0),
    new RomanEntry("vye", "ゔぇ", 0),
    new RomanEntry("vyo", "ゔょ", 0),
    new RomanEntry("qq", "っ", 1),
    new RomanEntry("vv", "っ", 1),
    new RomanEntry("ll", "っ", 1),
    new RomanEntry("xx", "っ", 1),
    new RomanEntry("kk", "っ", 1),
    new RomanEntry("gg", "っ", 1),
    new RomanEntry("ss", "っ", 1),
    new RomanEntry("zz", "っ", 1),
    new RomanEntry("jj", "っ", 1),
    new RomanEntry("tt", "っ", 1),
    new RomanEntry("dd", "っ", 1),
    new RomanEntry("hh", "っ", 1),
    new RomanEntry("ff", "っ", 1),
    new RomanEntry("bb", "っ", 1),
    new RomanEntry("pp", "っ", 1),
    new RomanEntry("mm", "っ", 1),
    new RomanEntry("yy", "っ", 1),
    new RomanEntry("rr", "っ", 1),
    new RomanEntry("ww", "っ", 1),
    new RomanEntry("www", "w", 2),
    new RomanEntry("cc", "っ", 1),
    new RomanEntry("kya", "きゃ", 0),
    new RomanEntry("kyi", "きぃ", 0),
    new RomanEntry("kyu", "きゅ", 0),
    new RomanEntry("kye", "きぇ", 0),
    new RomanEntry("kyo", "きょ", 0),
    new RomanEntry("gya", "ぎゃ", 0),
    new RomanEntry("gyi", "ぎぃ", 0),
    new RomanEntry("gyu", "ぎゅ", 0),
    new RomanEntry("gye", "ぎぇ", 0),
    new RomanEntry("gyo", "ぎょ", 0),
    new RomanEntry("sya", "しゃ", 0),
    new RomanEntry("syi", "しぃ", 0),
    new RomanEntry("syu", "しゅ", 0),
    new RomanEntry("sye", "しぇ", 0),
    new RomanEntry("syo", "しょ", 0),
    new RomanEntry("sha", "しゃ", 0),
    new RomanEntry("shi", "し", 0),
    new RomanEntry("shu", "しゅ", 0),
    new RomanEntry("she", "しぇ", 0),
    new RomanEntry("sho", "しょ", 0),
    new RomanEntry("zya", "じゃ", 0),
    new RomanEntry("zyi", "じぃ", 0),
    new RomanEntry("zyu", "じゅ", 0),
    new RomanEntry("zye", "じぇ", 0),
    new RomanEntry("zyo", "じょ", 0),
    new RomanEntry("tya", "ちゃ", 0),
    new RomanEntry("tyi", "ちぃ", 0),
    new RomanEntry("tyu", "ちゅ", 0),
    new RomanEntry("tye", "ちぇ", 0),
    new RomanEntry("tyo", "ちょ", 0),
    new RomanEntry("cha", "ちゃ", 0),
    new RomanEntry("chi", "ち", 0),
    new RomanEntry("chu", "ちゅ", 0),
    new RomanEntry("che", "ちぇ", 0),
    new RomanEntry("cho", "ちょ", 0),
    new RomanEntry("cya", "ちゃ", 0),
    new RomanEntry("cyi", "ちぃ", 0),
    new RomanEntry("cyu", "ちゅ", 0),
    new RomanEntry("cye", "ちぇ", 0),
    new RomanEntry("cyo", "ちょ", 0),
    new RomanEntry("dya", "ぢゃ", 0),
    new RomanEntry("dyi", "ぢぃ", 0),
    new RomanEntry("dyu", "ぢゅ", 0),
    new RomanEntry("dye", "ぢぇ", 0),
    new RomanEntry("dyo", "ぢょ", 0),
    new RomanEntry("tsa", "つぁ", 0),
    new RomanEntry("tsi", "つぃ", 0),
    new RomanEntry("tse", "つぇ", 0),
    new RomanEntry("tso", "つぉ", 0),
    new RomanEntry("tha", "てゃ", 0),
    new RomanEntry("thi", "てぃ", 0),
    new RomanEntry("t'i", "てぃ", 0),
    new RomanEntry("thu", "てゅ", 0),
    new RomanEntry("the", "てぇ", 0),
    new RomanEntry("tho", "てょ", 0),
    new RomanEntry("t'yu", "てゅ", 0),
    new RomanEntry("dha", "でゃ", 0),
    new RomanEntry("dhi", "でぃ", 0),
    new RomanEntry("d'i", "でぃ", 0),
    new RomanEntry("dhu", "でゅ", 0),
    new RomanEntry("dhe", "でぇ", 0),
    new RomanEntry("dho", "でょ", 0),
    new RomanEntry("d'yu", "でゅ", 0),
    new RomanEntry("twa", "とぁ", 0),
    new RomanEntry("twi", "とぃ", 0),
    new RomanEntry("twu", "とぅ", 0),
    new RomanEntry("twe", "とぇ", 0),
    new RomanEntry("two", "とぉ", 0),
    new RomanEntry("t'u", "とぅ", 0),
    new RomanEntry("dwa", "どぁ", 0),
    new RomanEntry("dwi", "どぃ", 0),
    new RomanEntry("dwu", "どぅ", 0),
    new RomanEntry("dwe", "どぇ", 0),
    new RomanEntry("dwo", "どぉ", 0),
    new RomanEntry("d'u", "どぅ", 0),
    new RomanEntry("nya", "にゃ", 0),
    new RomanEntry("nyi", "にぃ", 0),
    new RomanEntry("nyu", "にゅ", 0),
    new RomanEntry("nye", "にぇ", 0),
    new RomanEntry("nyo", "にょ", 0),
    new RomanEntry("hya", "ひゃ", 0),
    new RomanEntry("hyi", "ひぃ", 0),
    new RomanEntry("hyu", "ひゅ", 0),
    new RomanEntry("hye", "ひぇ", 0),
    new RomanEntry("hyo", "ひょ", 0),
    new RomanEntry("bya", "びゃ", 0),
    new RomanEntry("byi", "びぃ", 0),
    new RomanEntry("byu", "びゅ", 0),
    new RomanEntry("bye", "びぇ", 0),
    new RomanEntry("byo", "びょ", 0),
    new RomanEntry("pya", "ぴゃ", 0),
    new RomanEntry("pyi", "ぴぃ", 0),
    new RomanEntry("pyu", "ぴゅ", 0),
    new RomanEntry("pye", "ぴぇ", 0),
    new RomanEntry("pyo", "ぴょ", 0),
    new RomanEntry("fa", "ふぁ", 0),
    new RomanEntry("fi", "ふぃ", 0),
    new RomanEntry("fu", "ふ", 0),
    new RomanEntry("fe", "ふぇ", 0),
    new RomanEntry("fo", "ふぉ", 0),
    new RomanEntry("fya", "ふゃ", 0),
    new RomanEntry("fyu", "ふゅ", 0),
    new RomanEntry("fyo", "ふょ", 0),
    new RomanEntry("hwa", "ふぁ", 0),
    new RomanEntry("hwi", "ふぃ", 0),
    new RomanEntry("hwe", "ふぇ", 0),
    new RomanEntry("hwo", "ふぉ", 0),
    new RomanEntry("hwyu", "ふゅ", 0),
    new RomanEntry("mya", "みゃ", 0),
    new RomanEntry("myi", "みぃ", 0),
    new RomanEntry("myu", "みゅ", 0),
    new RomanEntry("mye", "みぇ", 0),
    new RomanEntry("myo", "みょ", 0),
    new RomanEntry("rya", "りゃ", 0),
    new RomanEntry("ryi", "りぃ", 0),
    new RomanEntry("ryu", "りゅ", 0),
    new RomanEntry("rye", "りぇ", 0),
    new RomanEntry("ryo", "りょ", 0),
    new RomanEntry("n'", "ん", 0),
    new RomanEntry("nn", "ん", 0),
    new RomanEntry("n", "ん", 0),
    new RomanEntry("xn", "ん", 0),
    new RomanEntry("a", "あ", 0),
    new RomanEntry("i", "い", 0),
    new RomanEntry("u", "う", 0),
    new RomanEntry("wu", "う", 0),
    new RomanEntry("e", "え", 0),
    new RomanEntry("o", "お", 0),
    new RomanEntry("xa", "ぁ", 0),
    new RomanEntry("xi", "ぃ", 0),
    new RomanEntry("xu", "ぅ", 0),
    new RomanEntry("xe", "ぇ", 0),
    new RomanEntry("xo", "ぉ", 0),
    new RomanEntry("la", "ぁ", 0),
    new RomanEntry("li", "ぃ", 0),
    new RomanEntry("lu", "ぅ", 0),
    new RomanEntry("le", "ぇ", 0),
    new RomanEntry("lo", "ぉ", 0),
    new RomanEntry("lyi", "ぃ", 0),
    new RomanEntry("xyi", "ぃ", 0),
    new RomanEntry("lye", "ぇ", 0),
    new RomanEntry("xye", "ぇ", 0),
    new RomanEntry("ye", "いぇ", 0),
    new RomanEntry("ka", "か", 0),
    new RomanEntry("ki", "き", 0),
    new RomanEntry("ku", "く", 0),
    new RomanEntry("ke", "け", 0),
    new RomanEntry("ko", "こ", 0),
    new RomanEntry("xka", "ヵ", 0),
    new RomanEntry("xke", "ヶ", 0),
    new RomanEntry("lka", "ヵ", 0),
    new RomanEntry("lke", "ヶ", 0),
    new RomanEntry("ga", "が", 0),
    new RomanEntry("gi", "ぎ", 0),
    new RomanEntry("gu", "ぐ", 0),
    new RomanEntry("ge", "げ", 0),
    new RomanEntry("go", "ご", 0),
    new RomanEntry("sa", "さ", 0),
    new RomanEntry("si", "し", 0),
    new RomanEntry("su", "す", 0),
    new RomanEntry("se", "せ", 0),
    new RomanEntry("so", "そ", 0),
    new RomanEntry("ca", "か", 0),
    new RomanEntry("ci", "し", 0),
    new RomanEntry("cu", "く", 0),
    new RomanEntry("ce", "せ", 0),
    new RomanEntry("co", "こ", 0),
    new RomanEntry("qa", "くぁ", 0),
    new RomanEntry("qi", "くぃ", 0),
    new RomanEntry("qu", "く", 0),
    new RomanEntry("qe", "くぇ", 0),
    new RomanEntry("qo", "くぉ", 0),
    new RomanEntry("kwa", "くぁ", 0),
    new RomanEntry("kwi", "くぃ", 0),
    new RomanEntry("kwu", "くぅ", 0),
    new RomanEntry("kwe", "くぇ", 0),
    new RomanEntry("kwo", "くぉ", 0),
    new RomanEntry("gwa", "ぐぁ", 0),
    new RomanEntry("gwi", "ぐぃ", 0),
    new RomanEntry("gwu", "ぐぅ", 0),
    new RomanEntry("gwe", "ぐぇ", 0),
    new RomanEntry("gwo", "ぐぉ", 0),
    new RomanEntry("za", "ざ", 0),
    new RomanEntry("zi", "じ", 0),
    new RomanEntry("zu", "ず", 0),
    new RomanEntry("ze", "ぜ", 0),
    new RomanEntry("zo", "ぞ", 0),
    new RomanEntry("ja", "じゃ", 0),
    new RomanEntry("ji", "じ", 0),
    new RomanEntry("ju", "じゅ", 0),
    new RomanEntry("je", "じぇ", 0),
    new RomanEntry("jo", "じょ", 0),
    new RomanEntry("jya", "じゃ", 0),
    new RomanEntry("jyi", "じぃ", 0),
    new RomanEntry("jyu", "じゅ", 0),
    new RomanEntry("jye", "じぇ", 0),
    new RomanEntry("jyo", "じょ", 0),
    new RomanEntry("ta", "た", 0),
    new RomanEntry("ti", "ち", 0),
    new RomanEntry("tu", "つ", 0),
    new RomanEntry("tsu", "つ", 0),
    new RomanEntry("te", "て", 0),
    new RomanEntry("to", "と", 0),
    new RomanEntry("da", "だ", 0),
    new RomanEntry("di", "ぢ", 0),
    new RomanEntry("du", "づ", 0),
    new RomanEntry("de", "で", 0),
    new RomanEntry("do", "ど", 0),
    new RomanEntry("xtu", "っ", 0),
    new RomanEntry("xtsu", "っ", 0),
    new RomanEntry("ltu", "っ", 0),
    new RomanEntry("ltsu", "っ", 0),
    new RomanEntry("na", "な", 0),
    new RomanEntry("ni", "に", 0),
    new RomanEntry("nu", "ぬ", 0),
    new RomanEntry("ne", "ね", 0),
    new RomanEntry("no", "の", 0),
    new RomanEntry("ha", "は", 0),
    new RomanEntry("hi", "ひ", 0),
    new RomanEntry("hu", "ふ", 0),
    new RomanEntry("fu", "ふ", 0),
    new RomanEntry("he", "へ", 0),
    new RomanEntry("ho", "ほ", 0),
    new RomanEntry("ba", "ば", 0),
    new RomanEntry("bi", "び", 0),
    new RomanEntry("bu", "ぶ", 0),
    new RomanEntry("be", "べ", 0),
    new RomanEntry("bo", "ぼ", 0),
    new RomanEntry("pa", "ぱ", 0),
    new RomanEntry("pi", "ぴ", 0),
    new RomanEntry("pu", "ぷ", 0),
    new RomanEntry("pe", "ぺ", 0),
    new RomanEntry("po", "ぽ", 0),
    new RomanEntry("ma", "ま", 0),
    new RomanEntry("mi", "み", 0),
    new RomanEntry("mu", "む", 0),
    new RomanEntry("me", "め", 0),
    new RomanEntry("mo", "も", 0),
    new RomanEntry("xya", "ゃ", 0),
    new RomanEntry("lya", "ゃ", 0),
    new RomanEntry("ya", "や", 0),
    new RomanEntry("wyi", "ゐ", 0),
    new RomanEntry("xyu", "ゅ", 0),
    new RomanEntry("lyu", "ゅ", 0),
    new RomanEntry("yu", "ゆ", 0),
    new RomanEntry("wye", "ゑ", 0),
    new RomanEntry("xyo", "ょ", 0),
    new RomanEntry("lyo", "ょ", 0),
    new RomanEntry("yo", "よ", 0),
    new RomanEntry("ra", "ら", 0),
    new RomanEntry("ri", "り", 0),
    new RomanEntry("ru", "る", 0),
    new RomanEntry("re", "れ", 0),
    new RomanEntry("ro", "ろ", 0),
    new RomanEntry("xwa", "ゎ", 0),
    new RomanEntry("lwa", "ゎ", 0),
    new RomanEntry("wa", "わ", 0),
    new RomanEntry("wi", "うぃ", 0),
    new RomanEntry("we", "うぇ", 0),
    new RomanEntry("wo", "を", 0),
    new RomanEntry("wha", "うぁ", 0),
    new RomanEntry("whi", "うぃ", 0),
    new RomanEntry("whu", "う", 0),
    new RomanEntry("whe", "うぇ", 0),
    new RomanEntry("who", "うぉ", 0)
]
    .sort((a, b) => a.index - b.index);
class RomajiProcessor1 {
    constructor(entries) {
        this.roman_indexes = [];
        this.roman_entries = [];
        this.roman_entries = entries.sort((a, b) => a.index - b.index);
        this.roman_indexes = this.roman_entries.map(e => e.index);
    }
    static build() {
        return new RomajiProcessor1(ROMAN_ENTRIES);
    }
    romajiToHiragana(romaji) {
        if (romaji.length == 0) {
            return "";
        }
        let hiragana = "";
        let start = 0;
        let end = 1;
        while (start < romaji.length) {
            let lastFound = -1;
            let lower = 0;
            let upper = this.roman_indexes.length;
            while (upper - lower > 1 && end <= romaji.length) {
                const lowerKey = RomanEntry._calculateIndex(romaji, start, end);
                lower = binarySearch(this.roman_indexes, lower, upper, lowerKey);
                if (lower >= 0) {
                    lastFound = lower;
                }
                else {
                    lower = -lower - 1;
                }
                const upperKey = lowerKey + (1 << (32 - 8 * (end - start)));
                upper = binarySearch(this.roman_indexes, lower, upper, upperKey);
                if (upper < 0) {
                    upper = -upper - 1;
                }
                end++;
            }
            if (lastFound >= 0) {
                const entry = this.roman_entries[lastFound];
                hiragana = hiragana + entry.hiragana;
                start = start + entry.roman.length - entry.remain;
                end = start + 1;
            }
            else {
                hiragana = hiragana + romaji.charAt(start);
                start++;
                end = start + 1;
            }
        }
        return hiragana;
    }
    findRomanEntryPredicatively(roman, offset) {
        let startIndex = 0;
        let endIndex = this.roman_indexes.length;
        for (let i = 0; i < 4; i++) {
            if (roman.length <= offset + i) {
                break;
            }
            const startKey = RomanEntry._calculateIndex(roman, offset, offset + i + 1);
            startIndex = binarySearch(this.roman_indexes, startIndex, endIndex, startKey);
            if (startIndex >= 0) ;
            else {
                startIndex = -startIndex - 1;
            }
            const endKey = startKey + (1 << (24 - 8 * i));
            endIndex = binarySearch(this.roman_indexes, startIndex, endIndex, endKey);
            if (endIndex < 0) {
                endIndex = -endIndex - 1;
            }
            if (endIndex - startIndex == 1) {
                return new Set([this.roman_entries[startIndex]]);
            }
        }
        const result = new Set();
        for (let i = startIndex; i < endIndex; i++) {
            result.add(this.roman_entries[i]);
        }
        return result;
    }
    romajiToHiraganaPredictively(romaji) {
        if (romaji.length == 0) {
            return new RomajiPredictiveResult("", [""]);
        }
        let hiragana = "";
        let start = 0;
        let end = 1;
        while (start < romaji.length) {
            let lastFound = -1;
            let lower = 0;
            let upper = this.roman_indexes.length;
            while (upper - lower > 1 && end <= romaji.length) {
                const lowerKey = RomanEntry._calculateIndex(romaji, start, end);
                lower = binarySearch(this.roman_indexes, lower, upper, lowerKey);
                if (lower >= 0) {
                    lastFound = lower;
                }
                else {
                    lower = -lower - 1;
                }
                const upperKey = lowerKey + (1 << (32 - 8 * (end - start)));
                upper = binarySearch(this.roman_indexes, lower, upper, upperKey);
                if (upper < 0) {
                    upper = -upper - 1;
                }
                end++;
            }
            if (end > romaji.length && upper - lower > 1) {
                const set = new Set();
                for (let i = lower; i < upper; i++) {
                    const re = this.roman_entries[i];
                    if (re.remain > 0) {
                        let set2 = this.findRomanEntryPredicatively(romaji, end - 1 - re.remain);
                        for (let re2 of set2) {
                            if (re2.remain == 0) {
                                set.add(re.hiragana + re2.hiragana);
                            }
                        }
                    }
                    else {
                        set.add(re.hiragana);
                    }
                }
                let list = new Array();
                for (let e of set) {
                    list.push(e);
                }
                if (list.length == 1) {
                    return new RomajiPredictiveResult(hiragana + list[0], [""]);
                }
                else {
                    return new RomajiPredictiveResult(hiragana, list);
                }
            }
            if (lastFound >= 0) {
                const entry = this.roman_entries[lastFound];
                hiragana = hiragana + entry.hiragana;
                start = start + entry.roman.length - entry.remain;
                end = start + 1;
            }
            else {
                hiragana = hiragana + romaji.charAt(start);
                start++;
                end = start + 1;
            }
        }
        return new RomajiPredictiveResult(hiragana, [""]);
    }
}

export { BitList, BitVector, CompactDictionary, CompactDictionaryBuilder, CompactHiraganaString, DoubleArray, LOUDSTrie, LOUDSTrieBuilder, Migemo, RomajiPredictiveResult, RomajiProcessor1, RomajiProcessor2, RomanEntry, TernaryRegexGenerator, binarySearch, binarySearchString, binarySearchUint16, bitCount, han2zen_conv, hira2kata_conv, numberOfTrailingZeros, zen2han_conv };
