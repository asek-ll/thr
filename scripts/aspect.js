/* globals define */
define(['backbone', 'underscore'], function (Backbone, _) {
  var Aspect = Backbone.Model.extend({
    defaults: {
      name: '',
      type: '',
      components: [],
      isPrimal: true
    },
  });

  return Aspect;
});
