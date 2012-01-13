/*
 * jQuery Infinite Drag
 * Version 0.3
 * Copyright (c) 2010 Ian Li (http://ianli.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 *
 * Requires:
 * jQuery	http://jquery.com
 *
 * Reference:
 * http://ianli.com/infinitedrag/ for Usage
 *
 * Versions:
 * 0.3
 * - Heavily Edited for use with coloring.
 * 0.2
 * - Fixed problem with IE 8.0
 * 0.1
 * - Initial implementation
 */

(function($) {
	/**
	 * Function to create InfiniteDrag object.
	 */
	$.infinitedrag = function(draggable, draggable_options, tile_options, socket_url) {
		return new InfiniteDrag(draggable, draggable_options, tile_options, socket_url);
	};
	
	$.infinitedrag.VERSION = 0.2;
	
	/**
	 * The InfiniteDrag object.
	 */
	var InfiniteDrag = function(draggable, draggable_options, tile_options, socket_url) {
		// Use self to reduce confusion about this.
		var self = this;
		
		var socket = io.connect(socket_url);
		var connected = false;
		
		socket.on('confirm-connection', function (data) {
			connected = data;
			console.log('Socket Open: ', data);
		});
		
		var $draggable = $(draggable);
		var $viewport = $draggable.parent();
		
		$draggable.css({
			position: "relative",
			cursor: "move"
		});
		
		var draw_mode = false;
		var draw_color = 'white';
		
		var squares = {};
		
		var _maxsquares = 2000;
		var _numsquares = 0;
		// Draggable options
		var _do = (draggable_options) ? draggable_options : {};

		// Tile options (DEFAULT)
		var _to = {
			class_name: "_tile",
			width: 100,
			height: 100,
			start_col: 0,
			start_row: 0,
			range_col: [-1000, 1000],
			range_row: [-1000, 1000],
			oncreate: function($element, i, j) {}
		};
		// Override tile options.
		for (var i in tile_options) {
			if (tile_options[i] !== undefined) {
				_to[i] = tile_options[i];
			}
		}
		
		// Override tile options based on draggable options.
		if (_do.axis == "x") {
			_to.range_row = [_to.start_row, _to.start_row];
		} else if (_do.axis == "y") {
			_to.range_col = [_to.start_col, _to.start_col];
		}
		
		// Creates the tile at (i, j).
		function create_tile(i, j) {
			if (i < _to.range_col[0] || _to.range_col[1] < i) {
				return;
			} else if (j < _to.range_row[0] || _to.range_row[1] < j) {
				return;
			}
			
			grid[i][j] = true;
			var x = i * _to.width;
			var y = j * _to.height;
			var $e = $draggable.append('<div></div>');
			
			var coords = "" + i + "," + j;
			
			var $new_tile = $e.children(":last");
			$new_tile.attr({
				"class": 'square',
				'data-col': i,
				'data-row': j,
				'data-coord': coords
			}).css({
				position: "absolute",
				left: x,
				top: y,
				width: _to.width,
				height: _to.height
			});
			
			squares[coords] = $new_tile;
			_to.oncreate($new_tile, i, j);
			_numsquares++;
		};
		
		// Updates the containment box wherein the draggable can be dragged.
		var update_containment = function() {
			// Update viewport info.
			viewport_width = $viewport.width(),
			viewport_height = $viewport.height(),
			viewport_cols = Math.ceil(viewport_width / _to.width),
			viewport_rows = Math.ceil(viewport_height / _to.height);
			
			// Create containment box.
			var half_width = _to.width / 2,
				half_height = _to.height / 2,
				viewport_offset = $viewport.offset(),
				viewport_draggable_width = viewport_width - _to.width,
				viewport_draggable_height = viewport_height - _to.height;
			
			var containment = [
				(-_to.range_col[1] * _to.width) + viewport_offset.left + viewport_draggable_width,
				(-_to.range_row[1] * _to.height) + viewport_offset.top + viewport_draggable_height,
				(-_to.range_col[0] * _to.width) + viewport_offset.left,
				(-_to.range_row[0] * _to.height) + viewport_offset.top,
			];
			
			$draggable.draggable("option", "containment", containment);
		};
		
		var update_tiles = function() {
			var $this = $draggable;
			var $parent = $this.parent();

			// Problem with .position() in Chrome/WebKit:
			// var pos = $(this).position();
			// So, we compute it ourselves.
			var pos = {
				left: $this.offset().left - $parent.offset().left,
				top: $this.offset().top - $parent.offset().top
			}

			var visible_left_col = Math.ceil(-pos.left / _to.width) - 2,
				visible_top_row = Math.ceil(-pos.top / _to.height) - 2;

			for (var i = visible_left_col; i <= visible_left_col + viewport_cols + 3; i++) {
				if (grid[i] === undefined) {
					grid[i] = {};
				}
				for (var j = visible_top_row; j <= visible_top_row + viewport_rows + 3; j++) {
					if (grid[i][j] === undefined) {
						create_tile(i, j);
					}
				}
			}
			get_area(visible_top_row, visible_left_col + viewport_cols + 3, visible_top_row + viewport_rows + 3, visible_left_col);
			// If tooooo many squares
			if(_numsquares > _maxsquares){
				$.each(grid, function(x, row) { 
					if(x < (visible_left_col - 3) || x > (visible_left_col + viewport_cols + 3)) {
						$.each(row, function(y, square) {
							if(y < (visible_top_row - 3) || y > (visible_top_row + viewport_rows + 3)) {
								var coords = "" + x + "," + y;
								$(squares[coords]).addClass('out_display');
							}
						});
					}
				});
				// Remove all those evil extra sqaures.
				$this.find('.out_display').each(function(){
					var square = $(this);
					var coord =	square.attr('data-coord');
					var x =	square.attr('data-col');
					var y =	square.attr('data-row');
					delete grid[x][y];
					delete squares[coord];
					square.remove();
					_numsquares--;
				});
				
			}
		};
		function get_area(top, right, bottom, left) {
		
			var newColor = {
			    'top': top,
			    'right': right,
			    'bottom': bottom,
			    'left': left
			};
			socket.emit('get-area', top, right, bottom, left);
			socket.on('return-area', function (data) {
			    if(data === false){
			    	console.log('Error getting colors');
			    }
			    console.log(data);
			    $.each(data, function(index,value) {
			    	color_square(value.coords, value.color)
			    });
			});
		}
		function set_color(color, coordx, coordy) {
		    var coords = "" + coordx + "," + coordy;
		    var newColor = {
		    	'color': color,
		    	'coordx': coordx,
		    	'coordy': coordy,
		    	'coords': coords
		    };
			color_square(coords, color);
		    socket.emit('add-color', newColor);
		}
		function color_square(coords, color) {
		    if(squares[coords] !== undefined) {
		    	var oldcolor;
		    	if(oldcolor = $(squares[coords]).attr('data-color')){
		    		$(squares[coords]).removeClass(oldcolor).addClass(color).attr({'data-color':color});
		    	} else {
		    		$(squares[coords]).addClass(color).attr({'data-color':color});
		    	}
		    	
		    }
		}
		function getSquarefromoffset(left, top){
			var pixelOffset, resultX, resultY;
			pixelOffset = $draggable.offset();
			resultX = (left - pixelOffset.left) / _to.width;
      		resultY = (top - pixelOffset.top) / _to.height;
      		return {
        		x: Math.floor(resultX),
        		y: Math.floor(resultY)
      		};
		}
		function dropcolor(x, y, colortile){
			var color = colortile.attr('data-color');
			set_color(color, x, y);
		}
		socket.on('change-color', function (data) {
		    color_square(data.coords, data.color);
		});		
		// Public Methods
		//-----------------
		
		self.draggable = function() {
			return $draggable;
		};
		
		self.draw = function(value) {
			if (value === undefined) {
				return $draggable;
			}
			$draggable.draggable("option", "disabled", value);
			$viewport.droppable("option", "disabled", value);
			$draggable.css({ cursor: (value) ? "default" : "move" });
			draw_mode = value;
		};
		
		self.center = function(col, row) {
			var x = _to.width * col,
				y = _to.height * row,
				half_width = _to.width / 2,
				half_height = _to.height / 2,
				half_vw_width = $viewport.width() / 2,
				half_vw_height = $viewport.height() / 2,
				offset = $draggable.offset();
				
			var new_offset = { 
				left: -x - (half_width - half_vw_width), 
				top: -y - (half_height - half_vw_height)
			};
			
			if (_do.axis == "x") {
				new_offset.top = offset.top;
			} else if (_do.axis == "y") {
				new_offset.left = offset.left;
			}
			
			$draggable.offset(new_offset);
			
			update_tiles();
		};
		self.numtiles = function() {
			return _numsquares;
		};
		self.set_draw_color = function(color) {
			draw_color = color;
		}
		self.get_draw_color = function() {
			return draw_color;
		}
		// Setup
		//--------
		
		var viewport_width = $viewport.width(),
			viewport_height = $viewport.height(),
			viewport_cols = Math.ceil(viewport_width / _to.width),
			viewport_rows = Math.ceil(viewport_height / _to.height);

		$draggable.offset({
			left: $viewport.offset().left - (_to.start_col * _to.width),
			top: $viewport.offset().top - (_to.start_row * _to.height)
		});

		var grid = {};
		for (var i = _to.start_col - 2, m = _to.start_col + viewport_cols + 2; i < m && (_to.range_col[0] <= i && i <= _to.range_col[1]); i++) {
			grid[i] = {}
			for (var j = _to.start_row - 2, n = _to.start_row + viewport_rows + 2; j < n && (_to.range_row[0] <= j && j <= _to.range_row[1]); j++) {
				create_tile(i, j);
			}
		}
		
		// Color in those squares. :)
		get_area(_to.start_row - 2, _to.start_col + viewport_cols + 2, _to.start_row + viewport_rows + 2, _to.start_col - 2);
		
		// Handle resize of window.
		$(window).resize(function() {
			// HACK:
			// Update the containment when the window is resized
			// because the containment boundaries depend on the offset of the viewport.
			update_containment();
		});
		
		$draggable.click(function(e){
			if(draw_mode){
				var x = e.pageX
				  , y = e.pageY;
				var clicklocation = getSquarefromoffset(x, y);
				set_color(draw_color, clicklocation.x, clicklocation.y);
			}
		});
		
		// The drag event handler.
		_do.stop = function(e, ui) {
			update_tiles();
		};
		$viewport.droppable({
			accept : '.color',
			drop : function(e, ui) {
				var dragOffset, dragTile, dropLocation;
				dragTile = ui.draggable;
          		dragOffset = dragTile.offset();
          		dragOffset.top += dragTile.width() / 2;
          		dragOffset.left += dragTile.height() / 2;
          		dropLocation = getSquarefromoffset(dragOffset.left, dragOffset.top);
          		return dropcolor(dropLocation.x, dropLocation.y, dragTile);
			}
		});
		$draggable.draggable(_do);
		
		update_containment();
	};
})(jQuery);
