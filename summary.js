String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g, '');
};

Array.prototype.indexOf = function (item, start) {
    var length = this.length
    start = typeof (start) !== 'undefined' ? start : 0
    for (var i = start; i < length; i++) {
        if (this[i] === item) return i
    }
    return -1
}

var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';

var newline_placeholder = " @~@ ";
var newline_placeholder_t = newline_placeholder.trim();

function splitContentToSentences(content, callback) {
    if (content.indexOf('.') === -1) {
        return callback(false)
    }

    callback(sentences(content, { newline_boundaries: true }) || [])
}

sentences = function (text, user_options) {
    if (!text || typeof text !== "string" || !text.length) {
        return [];
    }

    var options = {
        "newline_boundaries": false,
        "html_boundaries": false,
        "html_boundaries_tags": ["p", "div", "ul", "ol"],
        "sanitize": false,
        "allowed_tags": false,
        "abbreviations": null
    };

    if (typeof user_options === "boolean") {
        options.newline_boundaries = true;
    }
    else {
        for (var k in user_options) {
            options[k] = user_options[k];
        }
    }

    setAbbreviations(options.abbreviations);

    if (options.newline_boundaries) {
        text = text.replace(/\n+|[-#=_+*]{4,}/g, newline_placeholder);
    }

    if (options.html_boundaries) {
        var html_boundaries_regexp = "(<br\\s*\\/?>|<\\/(" + options.html_boundaries_tags.join("|") + ")>)";
        var re = new RegExp(html_boundaries_regexp, "g");
        text = text.replace(re, "$1" + newline_placeholder);
    }

    if (options.sanitize || options.allowed_tags) {
        if (!options.allowed_tags) {
            options.allowed_tags = [""];
        }

        text = sanitizeHtml(text, { "allowedTags": options.allowed_tags });
    }

    var words = text.trim().match(/\S+|\n/g);
    var wordCount = 0;
    var index = 0;
    var temp = [];
    var sentences = [];
    var current = [];

    if (!words || !words.length) {
        return [];
    }

    for (var i = 0, L = words.length; i < L; i++) {
        wordCount++;

        current.push(words[i]);

        if (~words[i].indexOf(',')) { wordCount = 0; }

        if (isBoundaryChar(words[i]) || endsWithChar(words[i], "?!") || words[i] == newline_placeholder_t) {
            if ((options.newline_boundaries || options.html_boundaries) && words[i] === newline_placeholder_t) {
                current.pop();
            }

            sentences.push(current);
            wordCount = 0;
            current = [];

            continue;
        }


        if (endsWithChar(words[i], "\"") || endsWithChar(words[i], "”")) {
            words[i] = words[i].slice(0, -1);
        }

        if (endsWithChar(words[i], '.')) {
            if (i + 1 < L) {
                if (words[i].length === 2 && isNaN(words[i].charAt(0))) { continue; }
                if (isCommonAbbreviation(words[i])) { continue; }
                if (isSentenceStarter(words[i + 1])) {
                    if (isTimeAbbreviation(words[i], words[i + 1])) { continue; }
                    if (isNameAbbreviation(wordCount, words.slice(i, 6))) { continue; }

                    if (isNumber(words[i + 1])) {
                        if (isCustomAbbreviation(words[i])) { continue; }
                    }
                }
                else {
                    if (endsWith(words[i], "..")) { continue; }
                    if (isDottedAbbreviation(words[i])) { continue; }
                    if (isNameAbbreviation(wordCount, words.slice(i, 5))) { continue; }
                }
            }
            sentences.push(current);
            current = [];
            wordCount = 0;

            continue;
        }

        if ((index = words[i].indexOf(".")) > -1) {
            if (isNumber(words[i], index)) { continue; }
            if (isDottedAbbreviation(words[i])) { continue; }
            if (isURL(words[i]) || isPhoneNr(words[i])) { continue; }
        }

        if (temp = isConcatenated(words[i])) {
            current.pop();
            current.push(temp[0]);
            sentences.push(current);

            current = [];
            wordCount = 0;
            current.push(temp[1]);
        }
    }

    if (current.length) {
        sentences.push(current);
    }
    var result = [];
    var sentence = "";

    for (var i = 0; i < sentences.length; i++) {
        sentence = sentences[i].join(" ");

        // Single words, could be "enumeration lists"
        if (sentences[i].length === 1 && sentences[i][0].length < 4 &&
            sentences[i][0].indexOf('.') > -1) {
            // Check if there is a next sentence
            // It should not be another list item
            if (sentences[i + 1] && sentences[i + 1][0].indexOf('.') < 0) {
                sentence += " " + sentences[i + 1].join(" ");
                i++;
            }
        }

        result.push(sentence);
    }

    return result;
}

function splitContentToParagraphs(content, callback) {
    callback(content.split("\n\n"))
}

function intersect_safe(a, b) {
    var ai = 0, bi = 0
    var result = []

    while (ai < a.length && bi < b.length) {
        if (a[ai] < b[bi]) { ai++ }
        else if (a[ai] > b[bi]) { bi++ }
        else /* they're equal */ {
            result.push(a[ai])
            ai++
            bi++
        }
    }

    return result
}

function sentencesIntersection(sent1, sent2, callback) {
    var s1 = sent1.split(' ')
    var s2 = sent2.split(' ')

    if ((s1.length + s2.length) === 0) {
        callback(true)
    }

    var intersect = intersect_safe(s1, s2)
    var spliceHere = ((s1.length + s2.length) / 2)

    callback(false, intersect.splice(0, spliceHere).length)
}

function formatSentence(sentence, callback) {
    if (sentence && sentence.replace) {
        // To support unicode characters.
        // http://www.unicode.org/reports/tr29/WordBreakTest.html
        var re = /[^A-Za-z\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u0236\u0250-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EE\u0345\u037A\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03CE\u03D0-\u03F5\u03F7-\u03FB\u0400-\u0481\u048A-\u04CE\u04D0-\u04F5\u04F8-\u04F9\u0500-\u050F\u0531-\u0556\u0559\u0561-\u0587\u05B0-\u05B9\u05BB-\u05BD\u05BF\u05C1-\u05C2\u05C4\u05D0-\u05EA\u05F0-\u05F3\u0610-\u0615\u0621-\u063A\u0640-\u0657\u066E-\u06D3\u06D5-\u06DC\u06E1-\u06E8\u06ED-\u06EF\u06FA-\u06FC\u06FF\u0710-\u073F\u074D-\u074F\u0780-\u07B1\u0901-\u0939\u093D-\u094C\u0950\u0958-\u0963\u0981-\u0983\u0985-\u098C\u098F-\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD-\u09C4\u09C7-\u09C8\u09CB-\u09CC\u09D7\u09DC-\u09DD\u09DF-\u09E3\u09F0-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F-\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32-\u0A33\u0A35-\u0A36\u0A38-\u0A39\u0A3E-\u0A42\u0A47-\u0A48\u0A4B-\u0A4C\u0A59-\u0A5C\u0A5E\u0A70-\u0A74\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2-\u0AB3\u0AB5-\u0AB9\u0ABD-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACC\u0AD0\u0AE0-\u0AE3\u0B01-\u0B03\u0B05-\u0B0C\u0B0F-\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32-\u0B33\u0B35-\u0B39\u0B3D-\u0B43\u0B47-\u0B48\u0B4B-\u0B4C\u0B56-\u0B57\u0B5C-\u0B5D\u0B5F-\u0B61\u0B71\u0B82-\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99-\u0B9A\u0B9C\u0B9E-\u0B9F\u0BA3-\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB5\u0BB7-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCC\u0BD7\u0C01-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4C\u0C55-\u0C56\u0C60-\u0C61\u0C82-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCC\u0CD5-\u0CD6\u0CDE\u0CE0-\u0CE1\u0D02-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D28\u0D2A-\u0D39\u0D3E-\u0D43\u0D46-\u0D48\u0D4A-\u0D4C\u0D57\u0D60-\u0D61\u0D82-\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2-\u0DF3\u0F00\u0F40-\u0F47\u0F49-\u0F6A\u0F71-\u0F81\u0F88-\u0F8B\u0F90-\u0F97\u0F99-\u0FBC\u1000-\u1021\u1023-\u1027\u1029-\u102A\u102C-\u1032\u1036\u1038\u1050-\u1059\u10A0-\u10C5\u10D0-\u10F8\u1100-\u1159\u115F-\u11A2\u11A8-\u11F9\u1200-\u1206\u1208-\u1246\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1286\u1288\u128A-\u128D\u1290-\u12AE\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12CE\u12D0-\u12D6\u12D8-\u12EE\u12F0-\u130E\u1310\u1312-\u1315\u1318-\u131E\u1320-\u1346\u1348-\u135A\u13A0-\u13F4\u1401-\u166C\u166F-\u1676\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1713\u1720-\u1733\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772-\u1773\u1780-\u17B3\u17B6-\u17C8\u17D7\u17DC\u1820-\u1877\u1880-\u18A9\u1900-\u191C\u1920-\u192B\u1930-\u1938\u1950-\u196D\u1970-\u1974\u1D00-\u1D6B\u1E00-\u1E9B\u1EA0-\u1EF9\u1F00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2131\u2133-\u2139\u213D-\u213F\u2145-\u2149\u2160-\u2183\u3005\u3031-\u3035\u303B-\u303C\u3105-\u312C\u3131-\u318E\u31A0-\u31B7\uA000-\uA48C\uAC00-\uD7A3\uFA30-\uFA6A\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40-\uFB41\uFB43-\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFFA0-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC\U00010000-\U0001000B\U0001000D-\U00010026\U00010028-\U0001003A\U0001003C-\U0001003D\U0001003F-\U0001004D\U00010050-\U0001005D\U00010080-\U000100FA\U00010300-\U0001031E\U00010330-\U0001034A\U00010380-\U0001039D\U00010400-\U0001049D\U00010800-\U00010805\U00010808\U0001080A-\U00010835\U00010837-\U00010838\U0001083C\U0001083F\U0001D400-\U0001D454\U0001D456-\U0001D49C\U0001D49E-\U0001D49F\U0001D4A2\U0001D4A5-\U0001D4A6\U0001D4A9-\U0001D4AC\U0001D4AE-\U0001D4B9\U0001D4BB\U0001D4BD-\U0001D4C3\U0001D4C5-\U0001D505\U0001D507-\U0001D50A\U0001D50D-\U0001D514\U0001D516-\U0001D51C\U0001D51E-\U0001D539\U0001D53B-\U0001D53E\U0001D540-\U0001D544\U0001D546\U0001D54A-\U0001D550\U0001D552-\U0001D6A3\U0001D6A8-\U0001D6C0\U0001D6C2-\U0001D6DA\U0001D6DC-\U0001D6FA\U0001D6FC-\U0001D714\U0001D716-\U0001D734\U0001D736-\U0001D74E\U0001D750-\U0001D76E\U0001D770-\U0001D788\U0001D78A-\U0001D7A8\U0001D7AA-\U0001D7C2\U0001D7C4-\U0001D7C9]/g
        return callback(sentence.replace(re, ''))
    }
    return callback(sentence)
}

function getBestSentence(paragraph, sentences_dict, callback) {
    splitContentToSentences(paragraph, function (sentences) {
        if (!sentences) return ''
        if (sentences.length < 2) return ''

        var best_sentence = '', max_value = 0, strip_s, sentence, s
        for (s in sentences) {
            sentence = sentences[s]
            formatSentence(sentence, function (strip_s) {
                if (strip_s && sentences_dict[strip_s] > max_value) {
                    max_value = sentences_dict[strip_s]
                    best_sentence = sentence
                }
            })
        }

        callback(best_sentence)
    })
}

function getSortedSentences(paragraph, sentences_dict, n, callback) {
    splitContentToSentences(paragraph, function (sentences) {
        if (!sentences) return callback('')
        if (sentences.length < 2) return callback('')

        var sentence_scores = [], strip_s
        each(sentences, function (s, i) {
            formatSentence(s, function (strip_s) {
                if (strip_s) {
                    sentence_scores.push({
                        sentence: s,
                        score: sentences_dict[strip_s],
                        order: i
                    })
                }
            })
        })

        sentence_scores = _.sortBy(sentence_scores, function (sentence_score) {
            return -(sentence_score.score)
        })

        if (sentence_scores.length < n || n === 0) {
            n = sentence_scores.length
        }
        sentence_scores = sentence_scores.slice(0, n)

        sentence_scores = _.sortBy(sentence_scores, function (sentence) {
            return sentence.order
        })

        callback(_.map(sentence_scores, 'sentence'))
    })
}


function getSentencesRanks(content, callback, sentences_dict) {
    if (sentences_dict !== undefined) {
        callback(sentences_dict)
        return
    }
    else
        sentences_dict = {}
    splitContentToSentences(content, function (sentences) {
        var n = sentences.length,
            zeroNRange = range(0, n),
            nRange = range(n)

        var values = [], _val = []
        each(nRange, function (x) {
            _val = []
            each(nRange, function (y) {
                _val.push(0)
            })
            values.push(_val)
        })

        each(zeroNRange, function (i) {
            each(zeroNRange, function (j) {
                sentencesIntersection(sentences[i], sentences[j], function (err, intersection) {
                    if (err) throw err
                    values[i][j] = intersection
                })
            })
        })
        var score = 0
        some(zeroNRange, function (i) {
            score = 0
            _.some(zeroNRange, function (j) {
                if (i !== j) score += values[i][j]
            })

            formatSentence(sentences[i], function (strip_s) {
                sentences_dict[strip_s] = score
            })
        })

        callback(sentences_dict)
    })
}

summarize = function (title, content, callback, sentences_dict) {
    var summary = [], paragraphs = [], sentence = '', err = false
    getSentencesRanks(content, function (dict) {
        splitContentToParagraphs(content, function (paragraphs) {
            summary.push(title)

            each(paragraphs, function (p) {
                getBestSentence(p, dict, function (sentence) {
                    if (sentence) summary.push(sentence)
                })
            })

            if (sentence.length === 2) err = true
            callback(err, summary.join("\n"), dict)
        })
    }, sentences_dict)
}

getSortedSentences = function (content, n, callback, sentences_dict) {
    if (typeof (n) === 'function') {
        callback = n
        n = 0
    }

    getSentencesRanks(content, function (dict) {
        getSortedSentences(content, dict, n, function (sorted_sentences) {
            if (sorted_sentences === '') {
                callback(new Error('Too short to summarize.'))
            } else {
                callback(null, sorted_sentences, dict)
            }
        })
    }, sentences_dict)
}

//START Match
var abbreviations = new Array();
var englishAbbreviations = [
    "al",
    "adj",
    "assn",
    "Ave",
    "BSc", "MSc",
    "Cell",
    "Ch",
    "Co",
    "cc",
    "Corp",
    "Dem",
    "Dept",
    "ed",
    "eg",
    "Eq",
    "Eqs",
    "est",
    "est",
    "etc",
    "Ex",
    "ext",
    "Fig",
    "fig",
    "Figs",
    "figs",
    "i.e",
    "ie",
    "Inc",
    "inc",
    "Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec",
    "jr",
    "mi",
    "Miss", "Mrs", "Mr", "Ms",
    "Mol",
    "mt",
    "mts",
    "no",
    "Nos",
    "PhD", "MD", "BA", "MA", "MM",
    "pl",
    "pop",
    "pp",
    "Prof", "Dr",
    "pt",
    "Ref",
    "Refs",
    "Rep",
    "repr",
    "rev",
    "Sec",
    "Secs",
    "Sgt", "Col", "Gen", "Rep", "Sen", 'Gov', "Lt", "Maj", "Capt", "St",
    "Sr", "sr", "Jr", "jr", "Rev",
    "Sun", "Mon", "Tu", "Tue", "Tues", "Wed", "Th", "Thu", "Thur", "Thurs", "Fri", "Sat",
    "trans",
    "Univ",
    "Viz",
    "Vol",
    "vs",
    "v",
];

setAbbreviations = function (abbr) {
    if (abbr) {
        abbreviations = abbr;
    } else {
        abbreviations = englishAbbreviations;
    }
}

isCapitalized = function (str) {
    return /^[A-Z][a-z].*/.test(str) || this.isNumber(str);
}

isSentenceStarter = function (str) {
    return this.isCapitalized(str) || /``|"|'/.test(str.substring(0, 2));
}

isCommonAbbreviation = function (str) {
    return ~abbreviations.indexOf(str.replace(/\W+/g, ''));
}

isTimeAbbreviation = function (word, next) {
    if (word === "a.m." || word === "p.m.") {
        var tmp = next.replace(/\W+/g, '').slice(-3).toLowerCase();

        if (tmp === "day") {
            return true;
        }
    }

    return false;
}

isDottedAbbreviation = function (word) {
    var matches = word.replace(/[\(\)\[\]\{\}]/g, '').match(/(.\.)*/);
    return matches && matches[0].length > 0;
}

isCustomAbbreviation = function (str) {
    if (str.length <= 3) {
        return true;
    }

    return this.isCapitalized(str);
}

isNameAbbreviation = function (wordCount, words) {
    if (words.length > 0) {
        if (wordCount < 5 && words[0].length < 6 && this.isCapitalized(words[0])) {
            return true;
        }

        var capitalized = words.filter(function (str) {
            return /[A-Z]/.test(str.charAt(0));
        });

        return capitalized.length >= 3;
    }

    return false;
}

isNumber = function (str, dotPos) {
    if (dotPos) {
        str = str.slice(dotPos - 1, dotPos + 2);
    }

    return !isNaN(str);
};

isPhoneNr = function (str) {
    return str.match(/^(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?$/);
};

isURL = function (str) {
    return str.match(/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/);
};

isConcatenated = function (word) {
    var i = 0;

    if ((i = word.indexOf(".")) > -1 ||
        (i = word.indexOf("!")) > -1 ||
        (i = word.indexOf("?")) > -1) {
        var c = word.charAt(i + 1);

        if (c.match(/[a-zA-Z].*/)) {
            return [word.slice(0, i), word.slice(i + 1)];
        }
    }

    return false;
};

isBoundaryChar = function (word) {
    return word === "." ||
        word === "!" ||
        word === "?";
};
///END Match

///START String

endsWithChar = function ends_with_char(word, c) {
    if (c.length > 1) {
        return c.indexOf(word.slice(-1)) > -1;
    }

    return word.slice(-1) === c;
};

endsWith = function ends_with(word, end) {
    return word.slice(word.length - end.length) === end;
};
///END String


///START     Range
var INFINITY = 1 / 0,
    MAX_INTEGER = 1.7976931348623157e+308;

function toFinite(value) {
    if (!value) {
        return value === 0 ? value : 0;
    }
    if (value === INFINITY || value === -INFINITY) {
        var sign = (value < 0 ? -1 : 1);
        return sign * MAX_INTEGER;
    }
    return value === value ? value : 0;
}

function baseRange(start, end, step, fromRight) {
    var index = -1,
        length = Math.max(Math.ceil((end - start) / (step || 1)), 0),
        result = Array(length);

    while (length--) {
        result[fromRight ? length : ++index] = start;
        start += step;
    }
    return result;
}

function createRange(fromRight) {
    return function (start, end, step) {
        if (step && typeof step != 'number') { //TODO: Check isIterateeCall
            end = step = undefined;
        }
        start = toFinite(start);
        if (end === undefined) {
            end = start;
            start = 0;
        } else {
            end = toFinite(end);
        }
        step = step === undefined ? (start < end ? 1 : -1) : toFinite(step);
        return baseRange(start, end, step, fromRight)
    }
}

var range = createRange();
///END     Range

///START     Each
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;
var root = freeGlobal || freeSelf || Function('return this')();
var Symbol = root.Symbol;
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
var nativeObjectToString = objectProto.toString;

function getRawTag(value) {
    var isOwn = hasOwnProperty.call(value, symToStringTag),
        tag = value[symToStringTag];

    try {
        value[symToStringTag] = undefined;
        var unmasked = true;
    } catch (e) { }

    var result = nativeObjectToString.call(value);
    if (unmasked) {
        if (isOwn) {
            value[symToStringTag] = tag;
        } else {
            delete value[symToStringTag];
        }
    }
    return result;
}

function objectToString(value) {
    return nativeObjectToString.call(value);
}

function baseGetTag(value) {
    if (value == null) {
        return value === undefined ? undefinedTag : nullTag;
    }
    return (symToStringTag && symToStringTag in Object(value))
        ? getRawTag(value)
        : objectToString(value);
}

var asyncTag = '[object AsyncFunction]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    proxyTag = '[object Proxy]';

function isFunction(value) {
    var type = typeof value;
    if (value != null && (type == 'object' || type == 'function')) {
        return false;
    }
    var tag = baseGetTag(value);
    return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

var MAX_SAFE_INTEGER = 9007199254740991;

function isArrayLike(value) {
    var isLength = (typeof value.length === 'number' && value.length > -1 && value.length % 1 == 0 && value.length <= MAX_SAFE_INTEGER)
    return value != null && isLength && !isFunction(value);
}

function keys(object) {
    return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

function createBaseFor(fromRight) {
    return function (object, iteratee, keysFunc) {
        var index = -1,
            iterable = Object(object),
            props = keysFunc(object),
            length = props.length;

        while (length--) {
            var key = props[fromRight ? length : ++index];
            if (iteratee(iterable[key], key, iterable) === false) {
                break;
            }
        }
        return object;
    }
}

var baseFor = createBaseFor();

function baseForOwn(object, iteratee) {
    return object && baseFor(object, iteratee, keys);
}

function createBaseEach(eachFunc, fromRight) {
    return function (collection, iteratee) {
        if (collection == null) {
            return collection;
        }
        if (!isArrayLike(collection)) {
            return eachFunc(collection, iteratee);
        }
        var length = collection.length,
            index = fromRight ? length : -1,
            iterable = Object(collection);

        while ((fromRight ? index-- : ++index < length)) {
            if (iteratee(iterable[index], index, iterable) === false) {
                break;
            }
        }
        return collection;
    };
}

var baseEach = createBaseEach(baseForOwn);

function arrayEach(array, iteratee) {
    var index = -1,
        length = array == null ? 0 : array.length;

    while (++index < length) {
        if (iteratee(array[index], index, array) === false) {
            break;
        }
    }
    return array;
}

function castFunction(value) {
    return typeof value == 'function' ? value : identity;
}

function each(collection, iteratee) {
    var func = typeof collection === 'Array' ? arrayEach : baseEach;
    //WScript.Echo(castFunction);
    return func(collection, castFunction(iteratee));
}
///END     Each

///START Some

 function iteratee(func) {
      return baseIteratee(typeof func == 'function' ? func : baseClone(func, CLONE_DEEP_FLAG));
    }

function getIteratee(){
    var result = iteratee;
    result = result === iteratee ? baseIteratee : result;
    return arguments.length ? result(arguments[0], arguments[1]) : result;
}

function baseSome(collection, predicate){
    var index = -1;
    
    var array = new Array();
    array = collection.split(' ');
    length = array == null ? 0 : array.length;

    while(++index < length){
        if(predicate(array[index], index, array)){
            return true;
        }
    }
    return false;
}

function arraySome(array, predicate){
    var index = -1,
    length = array == null ? 0 : array.length;

    while(++index < length){
        if(predicate(array[index], index, array)){
            return true;
        }
    }
    return false;
}

function some(collection, predicate, guard){
    var func = Object.prototype.toString.call(collection) === '[object Array]' ? arraySome : baseSome;

    if(Object.prototype.toString.call(collection) === '[object Array]')

    if(guard) {
        predicate = undefined;
    } 
    WScript.Echo(predicate);
    return func(collection, getIteratee(predicate, 3));
}


//test
var title = "Swayy is a beautiful new dashboard for discovering and curating online content [Invites]"
var content = ""
content += "Lior Degani, the Co-Founder and head of Marketing of Swayy, pinged me last week when I was in California to tell me about his startup and give me beta access. I heard his pitch and was skeptical. I was also tired, cranky and missing my kids – so my frame of mind wasn't the most positive.\n"
content += "I went into Swayy to check it out, and when it asked for access to my Twitter and permission to tweet from my account, all I could think was, \"If this thing spams my Twitter account I am going to bitch-slap him all over the Internet.\" Fortunately that thought stayed in my head, and not out of my mouth.\n"
content += "One week later, I'm totally addicted to Swayy and glad I said nothing about the spam (it doesn't send out spam tweets but I liked the line too much to not use it for this article). I pinged Lior on Facebook with a request for a beta access code for TNW readers. I also asked how soon can I write about it. It's that good. Seriously. I use every content curation service online. It really is That Good.\n"
content += "What is Swayy? It's like Percolate and LinkedIn recommended articles, mixed with trending keywords for the topics you find interesting, combined with an analytics dashboard that shows the trends of what you do and how people react to it. I like it for the simplicity and accuracy of the content curation.\n"
content += "Everything I'm actually interested in reading is in one place – I don't have to skip from another major tech blog over to Harvard Business Review then hop over to another major tech or business blog. It's all in there. And it has saved me So Much Time\n\n"
content += "After I decided that I trusted the service, I added my Facebook and LinkedIn accounts. The content just got That Much Better. I can share from the service itself, but I generally prefer reading the actual post first – so I end up sharing it from the main link, using Swayy more as a service for discovery.\n"
content += "I'm also finding myself checking out trending keywords more often (more often than never, which is how often I do it on Twitter.com).\n\n\n"
content += "The analytics side isn't as interesting for me right now, but that could be due to the fact that I've barely been online since I came back from the US last weekend. The graphs also haven't given me any particularly special insights as I can't see which post got the actual feedback on the graph side (however there are numbers on the Timeline side.) This is a Beta though, and new features are being added and improved daily. I'm sure this is on the list. As they say, if you aren't launching with something you're embarrassed by, you've waited too long to launch.\n"
content += "It was the suggested content that impressed me the most. The articles really are spot on – which is why I pinged Lior again to ask a few questions:\n"
content += "How do you choose the articles listed on the site? Is there an algorithm involved? And is there any IP?\n"
content += "Yes, we're in the process of filing a patent for it. But basically the system works with a Natural Language Processing Engine. Actually, there are several parts for the content matching, but besides analyzing what topics the articles are talking about, we have machine learning algorithms that match you to the relevant suggested stuff. For example, if you shared an article about Zuck that got a good reaction from your followers, we might offer you another one about Kevin Systrom (just a simple example).\n"
content += "Who came up with the idea for Swayy, and why? And what's your business model?\n"
content += "Our business model is a subscription model for extra social accounts (extra Facebook / Twitter, etc) and team collaboration.\n"
content += "The idea was born from our day-to-day need to be active on social media, look for the best content to share with our followers, grow them, and measure what content works best.\n"
content += "Who is on the team?\n"
content += "Ohad Frankfurt is the CEO, Shlomi Babluki is the CTO and Oz Katz does Product and Engineering, and I [Lior Degani] do Marketing. The four of us are the founders. Oz and I were in 8200 [an elite Israeli army unit] together. Emily Engelson does Community Management and Graphic Design.\n"
content += "If you use Percolate or read LinkedIn's recommended posts I think you'll love Swayy.\n"
content += "Want to try Swayy out without having to wait? Go to this secret URL and enter the promotion code thenextweb . The first 300 people to use the code will get access.\n"
content += "Image credit: Thinkstock"

summarize(title, content, function (err, summary) {
    originallength = title.length + content.length
    summarylength = summary.length
    summaryratio = (100 - (100 * (summarylength / (title.length + content.length))))

    summary.should.be.type('string')

    done()
})