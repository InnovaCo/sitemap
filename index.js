'use strict';
var generate = require('./lib/generate');
var Sitemap = require('./lib/sitemap');

module.exports = function(dir, options, callback) {
	return generate(dir, options, callback);
};

module.exports.parse = function(contents) {
	return new Sitemap(contents);
};

module.exports.Sitemap = Sitemap;
module.exports.SitemapEntry = Sitemap.SitemapEntry;
module.exports.GeneratePI = Sitemap.GeneratePI;