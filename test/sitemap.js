'use strict';

var assert = require('assert');
var path = require('path');
var generate = require('../lib/generate');

describe('Sitemap', function() {
	it('generate from files', function(done) {
		generate(path.join(__dirname, 'site'), {includeSitemap: false}, function(err, sitemap) {
			if (err) {
				return done(err);
			}

			var item = getItem.bind(null, sitemap.items);

			assert.equal(sitemap.items.length, 6);
			assert(item('/'));
			assert(item(/contacts\.html/));
			assert(item(/\/skip-it\//));
			assert(!item(/sample\.xml/));

			done();
		});
	});

	it('generate with embedded sitemap', function(done) {
		generate(path.join(__dirname, 'site'), {includeSitemap: true}, function(err, sitemap) {
			if (err) {
				return done(err);
			}

			var item = getItem.bind(null, sitemap.items);

			assert.equal(sitemap.items.length, 7);
			assert(item('/'));
			assert(!item(/\/skip-it\//));
			assert(item('/about/embedded/'));
			assert.equal(item('/about/embedded/').changeFrequency, 'daily');
			assert(item('/about/embedded/help/'));
			assert.equal(item('/about/embedded/help/').priority, 1);
			assert(!item(/sitemap\.xml/));

			done();
		});
	});

	it('generate with processing instruction', function(done) {
		generate(path.join(__dirname, 'site-pi'), {includeSitemap: true}, function(err, sitemap) {
			if (err) {
				return done(err);
			}

			var item = getItem.bind(null, sitemap.items);

			assert.equal(sitemap.items.length, 4);
			assert(item('/about/'));
			assert(item('/about/embedded-pi/foo/'), 'static sitemap item with inherited prefix');
			assert(item('/about/embedded-pi/a/include-it/'), 'generated sitemap item with inherited prefix');
			assert(item('/about/embedded-pi/a/'));

			done();
		});
	});
});

function getItem(items, url) {
	return items.reduce(function(prev, item) {
		if (!prev) {
			if (url instanceof RegExp) {
				return url.test(item.url) ? item : prev;
			}

			if (item.url === url) {
				return item;
			}
		}
		return prev;
	}, null);
};