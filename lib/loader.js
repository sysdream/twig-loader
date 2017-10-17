var Twig = require("twig");
var path = require("path");
var hashGenerator = require("hasha");
var mapcache = require("./mapcache");
var loaderUtils = require("loader-utils");

Twig.cache(false);

Twig.extend(function(Twig) {
  var compiler = Twig.compiler;
  compiler.module['webpack'] = require("./compiler");
});

module.exports = function(source) {
  var path = require.resolve(this.resource),
    id = hashGenerator(path),
    tpl;

  var options = loaderUtils.getOptions(this);
  mapcache.set(id, path);
  mapcache.set('options', options);

  this.cacheable && this.cacheable();

  tpl = Twig.twig({
    id: id,
    path: path,
    data: source,
    allowInlineIncludes: true
  });

  tpl = tpl.compile({
    module: 'webpack',
    twig: 'twig'
  });

  this.callback(null, tpl);
};
