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

  var FIELD_SIZE = 3;

  var basePoint = new fabric.Point(200, 200);
  var hexProps = {
    osn: 20,
    height: 38,
    width: 44,
  };
  var exWidth = Math.floor((hexProps.width - hexProps.osn) / 2);
  var halfHeight = Math.floor(hexProps.height / 2);

  var svgPath = 'M 0 0 L ' + hexProps.osn + ' 0 L ' + (hexProps.osn + exWidth) + ' ' + halfHeight + ' L ' + hexProps.osn + ' ' + hexProps.height + ' L 0 ' + hexProps.height + ' L -' + exWidth + ' ' + halfHeight + ' z';

  var defaultBackgroundColor = '#ffffaa';
  var defaultStroke = '#666600';

  var HY = new fabric.Point(0, hexProps.height + 8);
  var HX = new fabric.Point(-40, -(hexProps.height + 8) / 2);
  var HZ = new fabric.Point(40, -(hexProps.height + 8) / 2);

  var createHex = function (options) {
    var path = new fabric.Path(svgPath);
    path.set(_.extend({
      fill: defaultBackgroundColor,
      stroke: defaultStroke,
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
          this.path.setStroke(defaultStroke);
          this.$el.popover('hide');
          this.$el.removeClass('hovered');
        }
      } else {
        this.path.setFill('#ffffff');
        this.path.setStroke('#ffffff');
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
      cells: new Backbone.Collection(),
      calculated: false,
      fieldRadius: FIELD_SIZE
    },
    initialize: function () {
      //this.createCells();
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
        storeCellsToUrl();
      }
    }
  });

  var field = new Field({
    cells: new Cells(),
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
              storeCellsToUrl();
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
    initialize: function () {
      field.on('change:fieldRadius', this.updateFieldRadius, this);
      field.on('change:calculated', this.updateCalculatedStatus, this);
    },
    events: {
      'change .field-radius-field': 'changeFieldRadius',
      'click #clear-btn': 'clearField'
    },
    updateFieldRadius: function () {
      this.$el.find('.field-radius-field').val(field.get('fieldRadius'));
    },
    updateCalculatedStatus: function () {
      var $btns = this.$el.find('.btn');
      $btns.prop('disabled', field.get('calculated'));
    },
    changeFieldRadius: function (event) {
      var newFieldRadius = $(event.target).val();
      appRouter.navigate('field/' + newFieldRadius, {
        trigger: true
      });
    },
    clearField: function () {
      field.get('cells').each(function (cell) {
        cell.unset('aspect');
        cell.set('enabled', true);
        appRouter.navigate('field/' + field.get('fieldRadius'));
      });
    }
  }));

  var Weights = Backbone.Model.extend({
    initialize: function (aspects) {
      this.set('weights',
        aspects.map(function (aspect) {
          return {aspect: aspect, value: aspect.get('complexivity')};
        })
      );
    }
  });

  var WeightsView = Backbone.View.extend({
    initialize: function () {
      var _self = this;
      var weights = this.model.get('weights');
      _.each(weights, function (weight) {
        var type = weight.aspect.get('type');
        var $item = $('<tr><td><div class="aspect-icon aspect-icon-' + type  + ' col-sm-2" /></td><td><div class="col-sm-3"><input type="number" class="form-control" /></div></td></tr>');
        var $textInput = $item.find('input');
        $textInput.val(weight.value);
        $textInput.on('change', function () {
          _self.onChangeWeight(weight.aspect, parseInt($(this).val(), 10));
        });
        _self.$el.append($item);
      });
    },
    onChangeWeight: function (aspect, value) {
      var weight = _.find(this.model.get('weights'), function (weight) {
        return weight.aspect == aspect;
      });
      weight.value = value;
    }
  });

  var weightsCollections = new Weights(aspects);
  var weightsView = new WeightsView({
    el: '.weights',
    model: weightsCollections
  });

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

  $('#calc-btn').click(function () {

    var weights = {};

    _.each(weightsCollections.get('weights'), function (weight) {
      weights[weight.aspect.get('type')] = weight.value;
    });
    console.log(weights);

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

    var MAX_PATH_SIZE = 99999;

    var generatePathMap = function (cell) {
      var pathMap = {};

      var defaultValues = {};

      _.each(cells, function (cell) {
        var aspectMap = {};
        aspects.each(function (aspect) {
          aspectMap[aspect.get('type')] = MAX_PATH_SIZE;
        });

        pathMap[cell.cid] = aspectMap;

        var currentAspect = cell.get('aspect');
        if (currentAspect) {
          defaultValues[cell.cid] = currentAspect;
        }
      });

      var currentAspect = cell.get('aspect');
      if (currentAspect) {
        pathMap[cell.cid][currentAspect] = 0;
      }

      var changedCells = [cell.cid];

      while (changedCells.length > 0) {
        var processingCells = changedCells;
        changedCells = [];

        _.each(processingCells, function (cid) {
          var currentPathMap = pathMap[cid];
          var nextPathMap = {};

          _.each(currentPathMap, function (path, type1) {
            _.each(aspectRelationMap[type1], function (type) {
              var nextPath = path + weights[type];
              if (nextPath <= MAX_PATH_SIZE) {
                if (!nextPathMap[type] || nextPathMap[type] > nextPath) {
                  nextPathMap[type] = nextPath;
                }
              }
            });
          });

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

              if (defaultValues[cid]) {
                if (defaultValues[cid] === type) {
                  nextPathVariant -= weights[type];
                } else {
                  nextPathVariant = MAX_PATH_SIZE;
                }
              }

              if (nextPathVariant < newPathMap[type]) {
                newPathMap[type] = nextPathVariant;
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

    var getMapSum = function (cells) {
      var maps = _.map(cells, generatePathMap);
      var sum = {};

      _.each(maps, function (submap) {
        _.each(submap, function (submap2, cid) {
          var sumSubMap = sum[cid] || {};
          _.each(submap2, function (path, type) {
            sumSubMap[type] = path + (sumSubMap[type] || 0) - weights[type];
          });
          sum[cid] = sumSubMap;
        });
      });

      _.each(sum, function (submap, cid) {
        _.each(submap, function (path, type) {
          submap[type] += weights[type];
        });
      });

      return sum;
    };

    var filledCells = _.filter(cells, function (cell) {
      return cell.get('aspect');
    });

    var sum = getMapSum(filledCells);

    var solve = {};
    _.each(filledCells, function (cell) {
      solve[cell.cid] = cell.get('aspect');
    });


    var findNext = function (filledCells) {
      var sum = getMapSum(filledCells);

      _.each(filledCells, function (cell) {
        delete sum[cell.cid];
      });

      var minsP = _.chain(sum).map(function (submap, cid) {
        return {
          cid: cid,
          min: _.min(_.values(submap))
        };
      }).min(function (pair) {
        return pair.min;
      }).value();

      var minType = _.chain(sum[minsP.cid]).map(function (path, type) {
        return {
          path: path,
          type: type
        };
      }).min(function (info) {
        return info.path;
      }).value();

      var cell = field.get('cells').get(minsP.cid);
      cell.set('aspect', minType.type);

      filledCells.push(cell);

      return filledCells;
    };

    var isConnected = function (cells) {
      var groups = _.map(cells, function (cell) {
        return [cell.cid];
      });

      var groupsNear = _.map(cells, function (cell) {
        return _.filter(neighborsMap[cell.cid], function (cid) {
          var neib = field.get('cells').get(cid);
          return _.contains(aspectRelationMap[cell.get('aspect')], neib.get('aspect'));
        });
      });

      var wasChange = true;
      while (wasChange) {
        wasChange = false;
        for (var i = 0; i < groups.length; i++) {
          var group1 = groups[i];
          for (var j = 0; j < groups.length; j++) {
            var group2 = groups[j];
            if (i !== j && _.intersection(groupsNear[i], group2).length !== 0) {
              groups[i] = _.union(group1, group2);

              groupsNear[i] = _.union(groupsNear[i], groupsNear[j]);

              groups.splice(j, 1);
              groupsNear.splice(j, 1);
              wasChange = true;
              break;
            }
            if (wasChange) {
              break;
            }
          }
        }
      }
      return groups.length === 1;
    };

    var complete = function () {
      field.set('calculated', false);
      storeCellsToUrl();
    };

    var timerId;
    var iterateFunc = function () {
      filledCells = findNext(filledCells);
      if (!isConnected(filledCells)) {
        timerId = setTimeout(iterateFunc, 10);
      } else {
        complete();
      }
    };

    if (!isConnected(filledCells)) {
      iterateFunc();
      field.set('calculated', true);
    }

  });

  var TRHRouter = Backbone.Router.extend({
    routes: {
      'field/:size': 'updateField',
      'field/:size/:filled': 'updateField',
      '*path': 'defaultRoute',
    },
    updateField: function (size, filled) {
      field.set('fieldRadius', size);
      field.createCells();
      if (filled) {
        var cellsData = $.parseJSON(filled);
        _.each(cellsData, function (data, coord) {
          var xyz = _.map(coord.split(','), function (x) {
            return parseInt(x, 10);
          });
          var cell = field.getCellWithCoord(xyz[0], xyz[1], xyz[2]);
          if (cell) {
            if (data === 'disabled') {
              cell.set('enabled', false);
            } else {
              cell.set('aspect', data);
            }
          }
        });
      }
    },
    defaultRoute: function () {
      appRouter.navigate('field/' + FIELD_SIZE, {
        trigger: true
      });
    }

  });

  var storeCellsToUrl = function () {
    var data = {}
    field.get('cells').each(function (cell) {
      if (cell.get('aspect')) {
        data[cell.get('x') + ',' + cell.get('y') + ',' + cell.get('z')] = cell.get('aspect')
      } else
      if (!cell.get('enabled')) {
        data[cell.get('x') + ',' + cell.get('y') + ',' + cell.get('z')] = 'disabled';
      }
    });

    var cellsString = JSON.stringify(data);

    appRouter.navigate('field/' + field.get('fieldRadius') + '/' + cellsString);
  };


  var appRouter = new TRHRouter();

  Backbone.history.start();
});
