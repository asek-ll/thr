/* globals requirejs, define */
requirejs.config({
  paths: {
    jquery: '../bower_components/jquery/dist/jquery',
    underscore: '../bower_components/underscore/underscore',
    fabric: '../bower_components/fabric/dist/fabric.require',
    backbone: '../bower_components/backbone/backbone',
  }
});

define(['jquery', 'fabric', 'underscore', 'backbone', 'aspects'], function ($, fabric, _, Backbone, aspects) {
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
      text:'',
      neighbors: [],
    },
    getNearestCoords: function () {
      var x = this.get('x');
      var y = this.get('y');
      var z = this.get('z');

      var results = [];

      //1 0 0 == 0 -1 -1
      //0 1 0 == -1 0 -1
      //0 0 1 == -1 -1 0

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
        return pos[0] <= FIELD_SIZE && pos[1] <= FIELD_SIZE && pos[2] <= FIELD_SIZE;
      }).value();

      return results;

    }
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
        top: path.top + 4,
        left: path.left + 5,
        height: 32,
        width: 32,
      }).appendTo('.field-icons');

      this.$el.append($('<div class="tooltip"></div>'));

      this.model.on('change', this.render, this);
    },

    render: function () {
      if (this.model.get('enabled')) {
        if (this.model.get('isHovered')) {
          this.path.setFill('green');
          this.$el.addClass('hovered');
        } else {
          this.path.setFill(defaultBackgroundColor);
          this.$el.removeClass('hovered');
        }
      } else {
        this.path.setFill('#aaaa00');
      }

      if (this.model.get('aspect')) {
        this.$el.removeClass(function (i, classNames) {
          return _.filter(classNames.split(" "), function (className) {
            return className.substring(0, 'aspect-icon'.length) === 'aspect-icon';
          }).join(" ");
        });
        this.$el.addClass('aspect-icon aspect-icon-' + this.model.get('aspect'));
      }

      canvas.renderAll();

      this.$el.find('.tooltip').html(this.model.get('text'));
    },
  });

  var Field = Backbone.Model.extend({
    defaults: {
      cells: new Backbone.Collection()
    },
    initialize: function () {
      var cells = this.get('cells');
      cells.add(
        new Cell({
          x: 0,
          y: 0,
          z: 0,
        }));
      for (var i = 0; i <= FIELD_SIZE; i++) {
        for (var j = 1; j <= FIELD_SIZE; j++) {

          cells.add([
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

          ]);
        }
      }
    },
    getCellWithCoord: function (x, y, z) {
      return this.get('cells').find(function (cell) {
        return cell.get('x') === x && cell.get('y') == y && cell.get('z') == z;
      });
    }
  });

  var FieldView = Backbone.View.extend({
    initialize: function () {
      var _self = this;
      var cellViews = _self.cellViews = this.model.get('cells').map(function (cell) {
        var cellView = new CellView({
          model: cell
        });
        canvas.add(cellView.path);
        return cellView;
      });

      canvas.on('mouse:over', _.bind(_self.onMouseOver, _self));
      canvas.on('mouse:out', _.bind(_self.onMouseOut, _self));
      canvas.on('mouse:down', _.bind(_self.onMouseDown, _self));
    },

    getViewFromEvent: function (e) {
      return _.find(this.cellViews, function (view) {
        return view.path === e.target;
      });
    },

    onMouseOver: function (e) {
      var _self = this;
      var view = this.getViewFromEvent(e);
      if (view) {
        view.model.set('isHovered', true);

        //_.each(view.model.get('neighbors'), function (neighbor) {
        //neighbor.set('isHovered', true);
        //});

        //_.each(view.model.getNearestCoords(), function (coords) {
        //console.log(coords);
        //var cell = _this.model.getCellWithCoord(coords[0], coords[1], coords[2]);
        //if (cell) {
        //cell.set('isHovered', true);
        //}
        //});
        //console.log(view.model);
        //console.log(view.model.getNearestCoords());
      }
    },
    onMouseOut: function (e) {
      var _self = this;
      var view = this.getViewFromEvent(e);
      if (view) {
        view.model.set('isHovered', false);

        //_.each(view.model.get('neighbors'), function (neighbor) {
        //neighbor.set('isHovered', false);
        //});
        //_.each(view.model.getNearestCoords(), function (coords) {
        //var cell = _self.model.getCellWithCoord(coords[0], coords[1], coords[2]);
        //if (cell) {
        //cell.set('isHovered', false);
        //}
        //});
      }
    },
    onMouseDown: function (e) {
      var view = this.getViewFromEvent(e);
      if (view) {
        //view.model.set('enabled', !view.model.get('enabled'));
        var type;
        if ( window.aspectType ) {
          type = window.aspectType;
        } else {
          var aspectModel = aspects.models[_.random(0, aspects.length - 1)];
          type = aspectModel.get('type');
        }
        view.model.set('aspect', type);
      }
    }
  });

  var field = new Field({
    cells: new Cells()
  });

  var fieldView = new FieldView({
    model: field
  });

  var AspectView = Backbone.View.extend({
    tagName: 'div',
    initialize: function () {
      this.$el.addClass('aspect-icon aspect-icon-' + this.model.get('type'));
      //this.$el.html(this.model.get('name'));
    },
    events: {
      "click": "chooseAspect"
    },
    chooseAspect: function () {
      window.aspectType = this.model.get('type');
    }
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

  var componentsMap = {};
  var aspectRelationMap = {};

  aspects.each(function (aspect) {
    var type = aspect.get('type');

    if (!aspectRelationMap[type]) {
      aspectRelationMap[type] = [];
    }

    if (!componentsMap[type]) {
      componentsMap[type] = [];
    }

    _.each(aspect.get('components'), function (component) {
      if (!aspectRelationMap[component]) {
        aspectRelationMap[component] = [];
      }

      if (!_.contains(aspectRelationMap[type], component)) {
        aspectRelationMap[type].push(component);
        componentsMap[type].push(component);
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

  //var pathes = [];
  //var findPathes = function (type, currentPath) {
    //_.each(aspectRelationMap[type], function (component) {
      //if (!_.contains(currentPath, component)) {
        //var newPath = _.union(currentPath, [component]);
        //pathes.push(newPath);
        //findPathes(component, newPath)
      //}
    //});
  //};

  //aspects.each(function (aspect) {
    //findPathes(aspect.get('type'), []);
  //});

  aspects.each(function (aspectA) {
    var row = aspects.map(function (aspectB) {
      return _.contains(aspectRelationMap[aspectA.get('type')], aspectB.get('type')) ? 1: 0;
    });
    console.log(row.join(', '));
  });

  console.log(pathes);

  //var parts = {};
  //var getWeightedComponentes = function (type) {
    //if (!parts[type]) {
      //var part = {};
      //_.each(componentsMap[type], function (type) {
        //part[type] = [];
        //_.each(getWeightedComponentes(type), function (dep, compType) {
          //part[compType] = _.union([type], dep);
        //});
      //});
      //parts[type] = part;
    //}
    //return parts[type];
  //};

  //aspects.each(function (aspect) {
    //getWeightedComponentes(aspect.get('type'));
  //});

  //console.log('parts', parts);

  var getDist = function (aspectA, aspectB) {
    if (parts[aspectA][aspectB]) {

    }

  }

  console.log('WEIGHTS:', weights);

  var cells = field.get('cells');

  var neighborsMap = {};

  cells.each(function (model) {

    var neighbors = _.map(model.getNearestCoords(), function (coords) {
      return field.getCellWithCoord(coords[0], coords[1], coords[2]);
    });

    model.set('neighbors', neighbors);

    neighborsMap[model.cid] = _.map(neighbors, function (neighbor) {
      return neighbor.cid;
    });
  });

  //console.log(neighborsMap);

  var MAX_PATH_SIZE = 99999;

  var generatePathMap = function (cell) {
    var pathMap = {};
    cells.each(function (cell) {
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
          if ( cid === cell.cid ) {
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

  $('#calc-btn').click(function () {

    var filledCells = cells.filter(function (cell) {
      return cell.get('aspect');
    });

    var maps = _.map(filledCells, generatePathMap);

    //var m1 = maps[0];
    //var m2 = maps[1];

    var solve = {};
    _.each(filledCells, function (cell) {
      solve[cell.cid] = cell.get('aspect');
    });

    //_.each(maps, function (submap) {

      //_.each(solve, function (type, cid) {
        //if (submap[cid][type] > 0) {
          //submap[cid][type] -= weights[type];
          //}
  //});
  //});

  var sum = {};

  _.each(maps, function (submap) {
    _.each(submap, function (submap2, cid) {
      var sumSubMap = sum[cid] || {};
      _.each(submap2, function (path, type) {
        //if (path > 0) {
          //path -= weights[type];
          //}
          //if (solve[cid] === type) {
            //path = 0;
            //submap2[type] = path;
            //}
            sumSubMap[type] = path + (sumSubMap[type] || 0) - weights[type];
      });
      sum[cid] = sumSubMap;
    });
  });

  _.each(sum, function (submap, cid) {
    _.each(submap, function (path, type) {
      if (!solve[cid] || !solve[cid][type]) {
        submap[type] = path + weights[type];
      }
    });
  });
  //var commonPathes = {}

  //_.each(sum, function (submap, cid) {
    //_.each(submap, function (path, type) {
      //commonPathes[path] = (commonPathes[path] || 0) + 1;
  //});
  //});

  //console.log(commonPathes);

  var flatMapUniq = function (arr) {
    return _.uniq(_.union.apply(_, arr));
  };

  var findToSolve = function() {
    return flatMapUniq(_.map(solve, function (aspect, cid) {
      var neighbors = neighborsMap[cid];
      return _.filter(neighbors, function (cid) {
        return !solve[cid];
      });
    }));
  };

  var toSolve = findToSolve();
  while(toSolve.length >0) {

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
        if ( path < minPath && _.contains(accepted, type )) {
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
  //var dist = sum[filledCells[0].cid][filledCells[0].get('aspect')];
  //var dist2 = sum[filledCells[1].cid][filledCells[1].get('aspect')];
  //console.log('DISTS', dist, dist2);

  //sum = m1;
  //sum = m2;

  var globalMin = MAX_PATH_SIZE;
  _.each(sum, function (submap, cid) {
    _.each(submap, function (path, type) {
      if (path < globalMin) {
        globalMin = path;
      }
    });
  });
  console.log('MIN: ',globalMin);
  _.each(sum, function (submap, cid) {
    var min = 'aer';
    _.each(submap, function (path, type) {
      //if (path == dist) {
        //min = type;
        //}
        if (path < submap[min]) {
          min = type;
        }
    });
    //if (globalMin === submap[min]) {
      //if (dist === submap[min]) {
        //console.log(cid, submap);
        cells.get(cid).set('aspect', min);
        var info = _.map(submap, function (path, type) {
          return type + ': ' + path;
        }).join('</br>');
        cells.get(cid).set('text', "aspect: " + min + ", summ: " + submap[min] + ", cid: " + cid +' info:<br/>' + info );
        if ( cid === 'c50' ) {
          console.log(submap);
        }
        //}
  });

  //_.each(solve, function (type, cid) {
    //cells.get(cid).set('aspect', type);
  //});

  });

  //cells.get('c66').set('aspect', 'aer');
  //cells.get('c80').set('aspect', 'lux');

  //cells.get('c57').set('aspect', 'aer');
  //cells.get('c58').set('aspect', 'ignis');
  //cells.get('c59').set('aspect', 'aqua');

});
