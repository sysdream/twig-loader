var _ = require("underscore");
var loaderUtils = require("loader-utils");
var mapcache = require("./mapcache");
var url = require("url");
var cheerio = require('cheerio');

module.exports = function (id, tokens, pathToTwig) {
  var includes = [];
  var processDependency = function (token) {
    includes.push(token.value);
  };

  var processToken = function (token) {
    if (token.type === "logic" && token.token.type) {
      switch (token.token.type) {
        case 'Twig.logic.type.block':
        case 'Twig.logic.type.if':
        case 'Twig.logic.type.elseif':
        case 'Twig.logic.type.else':
        case 'Twig.logic.type.for':
        case 'Twig.logic.type.spaceless':
        case 'Twig.logic.type.macro':
          _.each(token.token.output, processToken);
          break;
        case 'Twig.logic.type.extends':
        case 'Twig.logic.type.include':
          _.each(token.token.stack, processDependency);
          break;
        case 'Twig.logic.type.embed':
          _.each(token.token.output, processToken);
          _.each(token.token.stack, processDependency);
          break;
        case 'Twig.logic.type.import':
        case 'Twig.logic.type.from':
          if (token.token.expression !== '_self') {
            _.each(token.token.stack, processDependency);
          }
          break;
      }
    }
  };

  var parsedTokens = JSON.parse(tokens);

  _.each(parsedTokens, processToken);
  var twig = require(pathToTwig).twig;
  var template = twig({ id: id, data: parsedTokens, allowInlineIncludes: true, rethrow: true, path: mapcache.get(id) });
  var content = template.render();

  var $ = cheerio.load(content);
  var links = $('img');

  for (var i = 0; i < links.length; i++) {
    var link = $(links[i]);
    var uri = url.parse(link.attr('src'));
    if (uri.hash !== null && uri.hash !== undefined) {
      uri.hash = null;
    }
    link.attr('src', '" + require(' + JSON.stringify(loaderUtils.urlToRequest(uri.format())) + ') + "');
  }

  var exportsString = ['module.exports = ' + JSON.stringify($.html()) + ';'];

  if (includes.length > 0) {
    _.each(_.uniq(includes), function (file) {
      exportsString.unshift("require(" + JSON.stringify(file) + ");\n");
    });
  }
  return exportsString.join('\n');
};