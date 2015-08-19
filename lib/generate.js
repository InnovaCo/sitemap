/**
 * Generates sitemap contents based on directory structure
 */
'use strict';

var path = require('path');
var fs = require('graceful-fs');
var extend = require('xtend');
var Sitemap = require('./sitemap');
var debug = require('debug')('sitemap');
var SitemapEntry = Sitemap.SitemapEntry;

var defaultOptions = {
	ext: ['.html', '.htm'],
	index: ['index.html', 'index.htm'],
	lastModified: true,
	includeSitemap: true
};

module.exports = function(dir, options, callback) {
	if (typeof options === 'function') {
		callback = options;
		options = null;
	}

	options = extend(defaultOptions, options || {});
	scanDir(dir, options, function(err, items) {
		callback(err, items ? new Sitemap(items) : null);
	});
};

function scanDir(dir, options, callback) {
	debug('scanning dir %s', dir);
	fs.readdir(dir, function(err, entries) {
		if (err) {
			return callback(err);
		}

		debug('entries found: %d', entries.length);
		var result = [];

		// remove entries that doesn’t match given extension list
		entries = filterEntries(entries, options.ext, options.includeSitemap);
		debug('entries filtered: %d', entries.length);

		if (options.includeSitemap && entries.indexOf('sitemap.xml') !== -1) {
			// we have embedded sitemap: stop scanning and include sitemap instead
			return getEmbeddedSitemap(path.join(dir, 'sitemap.xml'), options, callback);
		}

		var next = function(err, data) {
			if (err) {
				return callback(err);
			}

			if (Array.isArray(data)) {
				result = result.concat(data);
			}

			if (!entries.length) {
				return callback(null, result);
			}

			var entry = entries.shift();
			var absEntry = path.join(dir, entry);
			fs.stat(absEntry, function(err, stats) {
				if (err) {
					return next(err);
				}

				if (stats.isFile()) {
					if (options.index && options.index.indexOf(entry) !== -1) {
						// it’s an index file, add current dir as sitemap entry
						debug('save %s as index', entry);
						result.push(createSitemapEntry('', options, stats, true));
					} else {
						debug('save %s as file', entry);
						result.push(createSitemapEntry(entry, options, stats));
					}
					next();
				} else if (stats.isDirectory()) {
					scanDir(absEntry, extend(options, {
						prefix: createUrl(entry, options.prefix, true)
					}), next);
				} else {
					// unknown type, advance to next entry
					next();
				}
			});
		};
		next();
	});
}

function createSitemapEntry(entry, options, stats, isFile) {
	var sme = new SitemapEntry();
	var url = createUrl(entry, options.prefix, isFile);
	
	var args = [url, stats, entry];
	sme.url = url;
	sme.changeFrequency = callIfFn(options.changeFrequency, args, options);
	sme.priority = callIfFn(options.priority, args, options);

	if (options.lastModified === true) {
		sme.lastModified = stats.mtime;
	} else {
		sme.lastModified = callIfFn(options.lastModified, args, options);
	}
	
	return sme;
}

function createUrl(entry, prefix, ensureFinalSlash) {
	if (entry[0] === '/') {
		entry = entry.slice(1);
	}
	if (prefix) {
		entry = path.normalize(path.join(prefix, entry));
	}

	if (entry[0] !== '/') {
		entry = '/' + entry;
	}

	if (ensureFinalSlash && entry[entry.length - 1] !== '/') {
		entry += '/';
	}

	return entry;
}

function callIfFn(fn, args, ctx) {
	if (typeof fn === 'function') {
		return fn.apply(ctx || null, args);
	}

	return fn;
}

function filterEntries(entries, extFilter, keepSitemap) {
	var filter = typeof extFilter === 'function' ? extFilter : function(entry) {
		var ext = path.extname(entry);
		return !ext || extFilter.indexOf(ext) !== -1;
	};

	return entries.filter(function(entry, ix) {
		if (keepSitemap && entry === 'sitemap.xml') {
			return true;
		}

		return filter(entry, ix);
	});
}

function getEmbeddedSitemap(file, options, callback) {
	debug('parsing embedded sitemap');
	fs.readFile(file, 'utf8', function(err, contents) {
		if (err) {
			return callback(err);
		}

		var sitemap;
		try {
			sitemap = new Sitemap(contents);
		} catch (e) {
			return callback(e);
		}

		debug('parsed embedded sitemap with %d items', sitemap.items.length);

		// for each item in embedded sitemap rewrite URL so it inherit given prefix
		var reProto = /^\w+:/;
		var items = sitemap.items.map(function(item) {
			if (!reProto.test(item.url)) {
				item.url = createUrl(item.url, options.prefix);
			}
			return item;
		});
		callback(null, items);
	})
}