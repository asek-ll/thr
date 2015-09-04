/* globals define */

define(['aspect-info', 'underscore', 'backbone', 'aspect'], function (aspectInfo, _, Backbone, Aspect) {
  var USED_VERSION = '4.2.2.0';

  var info = aspectInfo.versionDictionary[USED_VERSION];

  var t = function (name) {
    return aspectInfo.translate[name];
  };

  var aspects = new Backbone.Collection();

  aspects.add(_.map(info.base_aspects, function (name) {
    return new Aspect({
      name: name,
      type: t(name),
      isPrimal: true,
      complexivity: 1
    });
  }));

  var getComplexivity = function (type) {
    if (_.contains(info.base_aspects, type)) {
      return 1;
    } else {
      return _.reduce(info.combinations[type], function (base, componentType) {
        return base + getComplexivity(componentType);
      }, 0);
    }
  };

  aspects.add(_.map(info.combinations, function (components, name) {
    return new Aspect({
      name: name,
      type: t(name),
      isPrimal: false,
      components: _.map(components, t),
      complexivity: getComplexivity(name)
    });
  }));

  return aspects;
});
