var path = require("path");
var hashGenerator = require("hasha");
var _ = require("underscore");
var loaderUtils = require("loader-utils");
var mapcache = require("./mapcache");
var url = require("url");
var attrParse = require('./attributesParser');

function randomIdent() {
  return "xxxHTMLLINKxxx" + Math.random() + Math.random() + "xxx";
}

module.exports = function (id, tokens, pathToTwig) {
  var includes = [];
  var processDependency = function (token) {
    includes.push(token.value);
  };

  var processToken = function (token) {
    if (token.type == "logic" && token.token.type) {
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
          if (token.token.expression != '_self') {
            _.each(token.token.stack, processDependency);
          }
          break;
      }
    }
  };

  var parsedTokens = JSON.parse(tokens);

  _.each(parsedTokens, processToken);
  var twig = require(pathToTwig).twig;
  var template = twig({ id, data: parsedTokens, allowInlineIncludes: true, rethrow: true, path: mapcache.get(id) });
  var attributes = ["img:src"];
  var content = template.render();

  var links = attrParse(content, function (tag, attr) {
    var res = attributes.find(function (a) {
      if (a.charAt(0) === ':') {
        return attr === a.slice(1);
      } else {
        return (tag + ":" + attr) === a;
      }
    });
    return !!res;
  });
  links.reverse();
  var data = {};
  content = [content];
  links.forEach(function (link) {
    if (!loaderUtils.isUrlRequest(link.value, root)) return;

    if (link.value.indexOf('mailto:') > -1) return;

    var uri = url.parse(link.value);
    if (uri.hash !== null && uri.hash !== undefined) {
      uri.hash = null;
      link.value = uri.format();
      link.length = link.value.length;
    }

    do {
      var ident = randomIdent();
    } while (data[ident]);
    data[ident] = link.value;
    var x = content.pop();
    content.push(x.substr(link.start + link.length));
    content.push(ident);
    content.push(x.substr(0, link.start));
  });
  content.reverse();
  content = content.join("");
  content = JSON.stringify(content);
  var exportsString = "module.exports = ";

  exportsString = exportsString + content.replace(/xxxHTMLLINKxxx[0-9\.]+xxx/g, function (match) {
    if (!data[match]) return match;
    return '" + require(' + JSON.stringify(loaderUtils.urlToRequest(data[match], root)) + ') + "';
  }) + ";";

  var output = [exportsString];

  if (includes.length > 0) {
    _.each(_.uniq(includes), function (file) {
      output.unshift("require(" + JSON.stringify(file) + ");\n");
    });
  }
  return output.join('\n');
};