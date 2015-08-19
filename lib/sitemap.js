/**
 * A class for reading and updating sitemap.xml
 */
'use strict';

var fs = require('graceful-fs');
var htmlparser = require('htmlparser2');

var GENERATE_MAP = {};
var DEFAULT_PRIORITY = 0.5;
var nodeMapping = {
	loc: 'url',
	lastmod: 'lastModified',
	changefreq: 'changeFrequency',
	priority: 'priority'
};

var Sitemap = module.exports = function(contents) {
	contents = contents || [];
	if (typeof contents === 'string') {
		contents = parseSitemap(contents);
	}

	if (contents && !Array.isArray(contents)) {
		throw new Error('Invalid sitemap contents, expected array or string');
	}

	this.items = contents;
};

Sitemap.prototype.toXml = function() {
	return '<?xml version="1.0" encoding="UTF-8"?>\n'
		+ '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
		+ this.items.map(function(item) {
			return item.toXml('  ');
		}).join('\n')
		+ '\n</urlset>\n';
};

var SitemapEntry = module.exports.SitemapEntry = function(node) {
	this.url = null;
	this.changeFrequency = null;
	this._lastModified = null;
	this._priority = DEFAULT_PRIORITY;

	if (node && typeof node === 'object') {
		this.readNode(node);
	}
};

SitemapEntry.prototype.readNode = function(node) {
	node.children.forEach(function(child) {
		if (child.name && child.name in nodeMapping) {
			this[nodeMapping[child.name]] = innerText(child);
		}
	}, this);
};

SitemapEntry.prototype.toXml = function(indent) {
	indent = indent || '';
	var innerIndent = indent ? indent + '  ' : '';

	var out = indent + '<url>\n';
	out += innerIndent + '<loc>' + this.url + '</loc>\n';
	if (this.changeFrequency) {
		out += innerIndent + '<changefreq>' + this.changeFrequency + '</changefreq>\n';
	}
	if (this.priority && this.priority !== DEFAULT_PRIORITY) {
		out += innerIndent + '<priority>' + this.priority + '</priority>\n';
	}
	if (this.lastModified) {
		out += innerIndent + '<lastmod>' + formatDate(this.lastModified) + '</lastmod>\n';
	}
	return out + indent + '</url>';
};

Object.defineProperties(SitemapEntry.prototype, {
	lastModified: {
		enumerable: true,
		get: function() {
			return this._lastModified;
		},
		set: function(value) {
			var type = typeof(value);
			if (type === 'undefined') {
				return;
			} else if (type === 'number') {
				value = new Date(value);
			} else if (type === 'string') {
				value = parseDate(value);
			}

			if (value instanceof Date) {
				this._lastModified = value;
			} else {
				throw new Error('Invalid lastModified value type, should be number, string or date');
			}
		}
	},
	priority: {
		enumerable: true,
		get: function() {
			return this._priority;
		},
		set: function(value) {
			if (!value) {
				return;
			}

			if (typeof value !== 'number') {
				value = parseFloat(value);
				if (isNaN(value)) {
					throw new Error('Invalid priority value: ' + value);
				}
			}
			this._priority = value;
		}
	}
});

module.exports.GENERATE_MAP = GENERATE_MAP;

/**
 * Reads given sitemap.xml file into JSON
 * @param  {String}   file     Path to sitemap.xml
 * @param  {Function} callback Invoked with two arguments: `err` and `sitemap`
 */
module.exports.fromFile = function(file, callback) {
	fs.readFile(file, 'utf8', function(err, contents) {
		if (err) {
			return callback(err);
		}

		try {
			callback(null, new Sitemap(contents));
		} catch (e) {
			callback(e);
		}
	});
};

function parseSitemap(contents) {
	var dom = htmlparser.parseDOM(contents, {xmlMode: true});
	return dom.reduce(function(result, node) {
		if (node.name === 'urlset') {
			result = result.concat(parseUrlsetNode(node));
		}
		return result;
	}, []);
}

function parseUrlsetNode(node) {
	return node.children.reduce(function(out, child) {
		if (child.name === 'url') {
			out.push(new SitemapEntry(child));
		} else if (node.type === 'pi') {
			// TODO сделать правильную проверку
			out.push(GENERATE_MAP);
		}
		return out;
	}, []);
}

/**
 * Parses given date in W3C format: http://www.w3.org/TR/NOTE-datetime
 * @param  {String} str
 * @return {Date}
 */
function parseDate(str) {
	var m;

	// YYYY
	if (m = str.match(/^\d{4}$/)) {
		return new Date(+m[0], 0, 1);
	}

	// YYYY-MM
	if (m = str.match(/^(\d{4})-(\d{2})$/)) {
		return new Date(+m[1], +m[2] - 1, 1);
	}

	// YYYY-MM-DD
	if (m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)) {
		return new Date(+m[1], +m[2] - 1, +m[3]);
	}

	// YYYY-MM-DD
	if (m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)) {
		return new Date(+m[1], +m[2] - 1, +m[3]);
	}

	// YYYY-MM-DDThh:mm:ss.sTZD
	if (m = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/)) {
		var time = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0, parseFloat(m[7] || '0') * 1000);
		if (m[8] !== 'Z') {
			var offset = m[8].match(/^([+-])(\d{2}):(\d{2})$/);
			time += (offset[1] === '-' ? 1 : -1) * ((+offset[2]) * 60 + (+offset[3])) * 60 * 1000;
		}
		return new Date(time);
	}

	throw new Error('Unknown date format: ' + str);
}

function formatDate(date) {
	var dt = date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate());
	var time = pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds());
	return dt + 'T' + time + 'Z';
}

function pad(num) {
	return (num < 10 ? '0' : '') + num;
}

function innerText(node) {
	if (node.type === 'text') {
		return node.data;
	} else if (node.type === 'tag') {
		return node.children.map(innerText).join('');
	}

	return '';
}