/* globals requirejs, define */
requirejs.config({
  paths: {
    jquery: '../bower_components/jquery/dist/jquery',
    underscore: '../bower_components/underscore/underscore',
    fabric: '../bower_components/fabric/dist/fabric.require',
    backbone: '../bower_components/backbone/backbone',
    bootstrap: '../bower_components/bootstrap/dist/js/bootstrap',
    jqueryUI: '../bower_components/jquery-ui/jquery-ui',
  },
  shim: {
    bootstrap: ['jquery'],
    jqueryUI: ['jquery'],
  }
});

define(['jquery', 'fabric', 'underscore', 'backbone', 'aspects', 'bootstrap', 'jqueryUI'], function ($, fabric, _, Backbone, aspects) {
  var canvas = new fabric.Canvas('field', {
    width: 640,
    height: 480
  });

  var FIELD_SIZE = 4;

  var basePoint = new fabric.Point(200, 200);
  var hexProps = {
    osn: 20,
    height: 38,
    width: 44,
  };
  var exWidth = Math.floor((hexProps.width - hexProps.osn) / 2);
  var halfHeight = Math.floor(hexProps.height / 2);

  var svgPath = 'M 0 0 L ' + hexProps.osn + ' 0 L ' + (hexProps.osn + exWidth) + ' ' + halfHeight + ' L ' + hexProps.osn + ' ' + hexProps.height + ' L 0 ' + hexProps.height + ' L -' + exWidth + ' ' + halfHeight + ' z';

  var defaultBackgroundColor = '';

  var HY = new fabric.Point(0, hexProps.height + 0);
  var HX = new fabric.Point(-32, -(hexProps.height + 0) / 2);
  var HZ = new fabric.Point(32, -(hexProps.height + 0) / 2);

  var createHex = function (options) {
    var path = new fabric.Path(svgPath);
    path.set(_.extend({
      fill: defaultBackgroundColor,
      stroke: '#aaaa00',
      opacity: 0.3
    }, options));
    path.selectable = false;
    return path;
  };

  var Cell = Backbone.Model.extend({
    defaults: {
      x: 0,
      y: 0,
      z: 0,
      isHovered: false,
      enabled: true,
      aspect: null,
      text: '',
      neighbors: [],
    },
  });

  var Cells = Backbone.Collection.extend({
    model: Cell
  });

  var CellView = Backbone.View.extend({
    tagName: 'div',
    initialize: function () {
      var model = this.model;
      var point = basePoint
        .add(HZ.multiply(model.get('x')))
        .add(HY.multiply(model.get('y')))
        .add(HX.multiply(model.get('z')));

      var path = createHex();
      path.setLeft(point.x);
      path.setTop(point.y);

      this.path = path;

      this.$el.addClass('cell').css({
        position: 'absolute',
        top: path.top,
        left: path.left,
        height: 40,
        width: 46,
      }).appendTo('.field-icons');

      this.$icon = $('<div class="field-icon" />').appendTo(this.$el);

      this.$el.popover({
        content: function () {
          return model.get('text');
        },
        title: function () {
          return model.get('aspect');
        },
        trigger: 'manual',
        animation: false,
      });

      this.model.on('change', this.render, this);
      this.model.on('remove', this.onRemove, this);
      this.model.on('change:aspect', this.setAspect, this);
    },

    onRemove: function () {
      this.path.remove();
      this.remove();
    },
    render: function () {
      if (this.model.get('enabled')) {
        if (this.model.get('isHovered')) {
          this.path.setFill('green');
          this.$el.popover('show');
          this.$el.addClass('hovered');
        } else {
          this.path.setFill(defaultBackgroundColor);
          this.$el.popover('hide');
          this.$el.removeClass('hovered');
        }
      } else {
        this.path.setFill('#000000');
        //this.path.setStroke('#aaaa00')
        this.$el.popover('hide');
      }

      canvas.renderAll();

      this.$el.find('.tooltip').html(this.model.get('text'));
    },

    setAspect: function () {
      var $icon = this.$icon;
      $icon.removeClass(function (i, classNames) {
        return _.filter(classNames.split(' '), function (className) {
          return className.substring(0, 'aspect-icon'.length) === 'aspect-icon';
        }).join(' ');
      });
      if (this.model.get('aspect')) {
        $icon.addClass('aspect-icon aspect-icon-' + this.model.get('aspect'));
      }
    }
  });

  var Field = Backbone.Model.extend({
    defaults: {
      cells: new Backbone.Collection()
    },
    initialize: function () {
      this.createCells();
    },
    createCells: function () {
      var cells = [];
      var FIELD_SIZE = this.get('fieldRadius');
      cells.push(
        new Cell({
          x: 0,
          y: 0,
          z: 0,
        }));
      for (var i = 0; i <= FIELD_SIZE; i++) {
        for (var j = 1; j <= FIELD_SIZE; j++) {

          cells.push(
            new Cell({
              x: 0,
              y: i,
              z: j,
            }),
            new Cell({
              x: j,
              y: 0,
              z: i,
            }),
            new Cell({
              x: i,
              y: j,
              z: 0,
            })
          );
        }
      }
      this.get('cells').set(cells);
      this.trigger('resetCells');
    },
    getCellWithCoord: function (x, y, z) {
      return this.get('cells').find(function (cell) {
        return cell.get('x') === x && cell.get('y') == y && cell.get('z') == z;
      });
    },
    getNearestCoords: function (cell) {
      var x = cell.get('x');
      var y = cell.get('y');
      var z = cell.get('z');
      var fieldRadius = this.get('fieldRadius');

      var results = [];

      results.push([x - 1, y, z]);
      results.push([x + 1, y, z]);
      results.push([x, y - 1, z]);
      results.push([x, y + 1, z]);
      results.push([x, y, z - 1]);
      results.push([x, y, z + 1]);

      results = _.chain(results).map(function (pos) {
        if (pos[0] < 0 || pos[1] < 0 || pos[2] < 0) {
          pos[0] += 1;
          pos[1] += 1;
          pos[2] += 1;
        } else if (pos[0] > 0 && pos[1] > 0 && pos[2] > 0) {
          pos[0] -= 1;
          pos[1] -= 1;
          pos[2] -= 1;
        }
        return pos;
      }).filter(function (pos) {
        return pos[0] <= fieldRadius && pos[1] <= fieldRadius && pos[2] <= fieldRadius;
      }).value();

      return results;
    },
    getNearestCells: function (cell) {
      var _self = this;
      return _.chain(this.getNearestCoords(cell)).map(function (coords) {
        return _self.getCellWithCoord(coords[0], coords[1], coords[2]);
      }).filter(function (cell) {
        return cell.get('enabled')
      }).value();
    }
  });

  var FieldView = Backbone.View.extend({
    initialize: function () {
      var _self = this;
      this.recreateCells();

      canvas.on('mouse:over', _.bind(_self.onMouseOver, _self));
      canvas.on('mouse:out', _.bind(_self.onMouseOut, _self));
      canvas.on('mouse:down', _.bind(_self.onMouseDown, _self));

      this.model.on('resetCells', this.recreateCells, this)
    },

    recreateCells: function () {
      var _self = this;
      var cellViews = _self.cellViews = this.model.get('cells').map(function (cell) {
        var cellView = new CellView({
          model: cell
        });
        canvas.add(cellView.path);
        return cellView;
      });

      canvas.renderAll();
    },

    getViewFromPath: function (path) {
      return _.find(this.cellViews, function (view) {
        return view.path === path;
      });
    },

    onMouseOver: function (e) {
      var _self = this;
      var view = this.getViewFromPath(e.target);
      if (view) {
        view.model.set('isHovered', true);
      }
    },
    onMouseOut: function (e) {
      var _self = this;
      var view = this.getViewFromPath(e.target);
      if (view) {
        view.model.set('isHovered', false);
      }
    },
    onMouseDown: function (e) {
      var view = this.getViewFromPath(e.target);
      if (view) {
        if (view.model.get('aspect')) {
          view.model.unset('aspect');
        } else {
          view.model.set('enabled', !view.model.get('enabled'))
        }
        //var type;
        //if (window.aspectType) {
          //type = window.aspectType;
        //} else {
          //var aspectModel = aspects.models[_.random(0, aspects.length - 1)];
          //type = aspectModel.get('type');
        //}
        //view.model.set('aspect', type);
      }
    }
  });

  var field = new Field({
    cells: new Cells(),
    fieldRadius: FIELD_SIZE
  });

  var fieldView = new FieldView({
    model: field
  });

  var AspectView = Backbone.View.extend({
    tagName: 'div',
    initialize: function () {
      var type = this.model.get('type');
      this.$el.addClass('aspect-icon aspect-icon-' + this.model.get('type'));
      this.$el.draggable({
        helper: 'clone',
        drag: function (event, ui) {
          canvas.findTarget(event)
        },
        stop: function (event, ui) {
          var targetPath = canvas.findTarget(event);
          if (targetPath) {
            var view = fieldView.getViewFromPath(targetPath);
            if (view && view.model.get('enabled')) {
              view.model.set('aspect', type);
            }
          }
        },
      });
    },
  });

  var AspectsView = Backbone.View.extend({
    initialize: function () {
      var $el = this.$el;

      this.collection.each(function (model) {
        var view = new AspectView({
          model: model
        });

        $el.append(view.$el);
      });
    }
  });

  var aspectsView = new AspectsView({
    el: '.aspects',
    collection: aspects
  });

  var configForm = new(Backbone.View.extend({
    el: '.config-form',
    events: {
      'change .field-radius-field': 'changeFieldRadius',
      'click #clear-btn': 'clearField'
    },
    changeFieldRadius: function (event) {
      var newFieldRadius = $(event.target).val();
      field.set('fieldRadius', newFieldRadius);
      field.createCells();
    },
    clearField: function () {
      field.get('cells').each(function (cell) {
        cell.unset('aspect');
      });
    }
  }));

  var aspectRelationMap = {};

  aspects.each(function (aspect) {
    var type = aspect.get('type');

    if (!aspectRelationMap[type]) {
      aspectRelationMap[type] = [];
    }
    _.each(aspect.get('components'), function (component) {
      if (!aspectRelationMap[component]) {
        aspectRelationMap[component] = [];
      }

      if (!_.contains(aspectRelationMap[type], component)) {
        aspectRelationMap[type].push(component);
      }
      if (!_.contains(aspectRelationMap[component], type)) {
        aspectRelationMap[component].push(type);
      }
    });
  });

  console.log(aspectRelationMap);

  var weights = {};

  aspects.each(function (aspect) {
    weights[aspect.get('type')] = aspect.get('complexivity');
  });

  console.log('WEIGHTS:', weights);

  $('#calc-btn').click(function () {

    var cells = field.get('cells').filter(function (cell) {
      return cell.get('enabled');
    });

    var neighborsMap = {};

    _.each(cells, function (model) {

      var neighbors = field.getNearestCells(model);

      model.set('neighbors', neighbors);

      neighborsMap[model.cid] = _.map(neighbors, function (neighbor) {
        return neighbor.cid;
      });
    });

    //console.log(neighborsMap);

    var MAX_PATH_SIZE = 99999;

    var generatePathMap = function (cell) {
      var pathMap = {};
      _.each(cells, function (cell) {
        var aspectMap = {};
        aspects.each(function (aspect) {
          aspectMap[aspect.get('type')] = MAX_PATH_SIZE;
        });

        pathMap[cell.cid] = aspectMap;

      });
      var currentAspect = cell.get('aspect');
      if (currentAspect) {
        pathMap[cell.cid][currentAspect] = 0;
        console.log('init cell', cell.cid, currentAspect);
      }

      var changedCells = [cell.cid];

      while (changedCells.length > 0) {
        //console.log('changed', changedCells);
        var processingCells = changedCells;
        changedCells = [];

        _.each(processingCells, function (cid) {
          var currentPathMap = pathMap[cid];
          var nextPathMap = {};

          _.each(currentPathMap, function (path, type1) {
            _.each(aspectRelationMap[type1], function (type) {
              var nextPath = path + weights[type];
              if (nextPath <= MAX_PATH_SIZE) {
                //console.log('try ', type1, 'and ', type, weights[type]);
                if (!nextPathMap[type] || nextPathMap[type] > nextPath) {
                  nextPathMap[type] = nextPath;
                }
              }
            });
          });

          //console.log(cid, 'next path map', nextPathMap);

          var neighbors = neighborsMap[cid];

          _.each(neighbors, function (cid) {
            if (cid === cell.cid) {
              return;
            }
            var currentPathMap = pathMap[cid];
            var newPathMap = {};
            var isChanged = false;
            _.each(currentPathMap, function (path, type) {
              var nextPathVariant = nextPathMap[type] || MAX_PATH_SIZE;
              newPathMap[type] = newPathMap[type] || path;
              if (nextPathVariant < newPathMap[type]) {
                newPathMap[type] = nextPathVariant;
                //console.log(cid, 'update', type, 'to', nextPathVariant);
                isChanged = true;
              }
            });
            if (isChanged && !_.contains(changedCells, cid)) {
              changedCells.push(cid);
            }
            pathMap[cid] = newPathMap;
          });

          //changedCells = [];

        });
      }
      return pathMap;
    };

    var filledCells = _.filter(cells, function (cell) {
      return cell.get('aspect');
    });

    var maps = _.map(filledCells, generatePathMap);

    var m1 = maps[0];
    var m2 = maps[1];

    var sum = {};

    _.each(maps, function (submap) {
      _.each(submap, function (submap2, cid) {
        var sumSubMap = sum[cid] || {};
        _.each(submap2, function (path, type) {
          sumSubMap[type] = path + (sumSubMap[type] || 0);
        });
        sum[cid] = sumSubMap;
      });
    });

    var solve = {};
    _.each(filledCells, function (cell) {
      solve[cell.cid] = cell.get('aspect');
    });

    var flatMapUniq = function (arr) {
      return _.uniq(_.union.apply(_, arr));
    };

    var findToSolve = function () {
      return flatMapUniq(_.map(solve, function (aspect, cid) {
        var neighbors = neighborsMap[cid];
        return _.filter(neighbors, function (cid) {
          return !solve[cid];
        });
      }));
    };

    var toSolve = findToSolve();
    while (toSolve.length > 0) {

      _.each(toSolve, function (cid) {
        var neighbors = neighborsMap[cid];
        var accepted = flatMapUniq(_.chain(neighbors).filter(function (cid) {
          return !!solve[cid];
        }).map(function (cid) {
          return aspectRelationMap[solve[cid]];
        }).value());

        var sums = sum[cid];
        var min = 'aer';
        var minPath = MAX_PATH_SIZE;
        _.each(sums, function (path, type) {
          if (path < minPath && _.contains(accepted, type)) {
            min = type;
            minPath = path;
          }
        });

        solve[cid] = min;
      });

      toSolve = findToSolve();
    }

    //_.each(m1, function (submap, cid) {
    //var submap2 = m2[cid];
    //var submapSum = {};
    //_.each(submap, function (path, type) {
    //submapSum[type] = path + submap2[type];
    //});
    //summ[cid] = submapSum;
    //});

    //console.log(m2.c61.ordo);
    //console.log(m1.c103.sensus);
    var dist = sum[filledCells[0].cid][filledCells[0].get('aspect')] - weights[filledCells[0].get('aspect')];
    var dist2 = sum[filledCells[1].cid][filledCells[1].get('aspect')] - weights[filledCells[1].get('aspect')];
    console.log('DISTS', dist, dist2);

    //summ = m1;
    //summ = m2;

    var globalMin = MAX_PATH_SIZE;
    _.each(sum, function (submap, cid) {
      _.each(submap, function (path, type) {
        if (path < globalMin) {
          globalMin = path;
        }
      });
    });
    console.log('MIN: ', globalMin);
    _.each(sum, function (submap, cid) {
      var min = 'aer';
      _.each(submap, function (path, type) {
        if (path < submap[min]) {
          min = type;
        }
      });
      //if (globalMin === submap[min]) {
      //if (dist === submap[min] - weights[min]) {
      //console.log(cid, submap);
      field.get('cells').get(cid).set('aspect', min);
      var info = _.map(submap, function (path, type) {
        return type + ': ' + path;
      }).join('\n');
      field.get('cells').get(cid).set('text', "aspect: " + min + ", summ: " + submap[min] + ", cid: " + cid + ' info:\n' + info);
      if (cid === 'c50') {
        console.log(submap);
      }
      //}
    });

    _.each(solve, function (type, cid) {
      field.get('cells').get(cid).set('aspect', type);
    });

  });

  //cells.get('c103').set('aspect', 'sensus');
  //cells.get('c61').set('aspect', 'ordo');

});
