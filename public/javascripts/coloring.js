/*
 * Heavily edited version of this jQuery plugin:
 *
 * jQuery Infinite Drag
 * Version 0.2
 * Copyright (c) 2010 Ian Li (http://ianli.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 * 
 * This is no longer a plugin and is now standalone. 12 times better I think.
 */

(function($) {

	var coloring = {

		server_address : settings.socket_address,

		socket : 0,
		socket_connected: false,

		$draggable : $('#wall'),
		$viewport : $('#viewport'),
		$colortiles : $('#color-tiles'),

		$loading : $('#loading'),
		$loadingbar : $('#loadingbar'),

		$coords : $('#coords'),
		$coord_link : $('#coord-link'),

		current_coords : {
			x : 0,
			y : 0,
		},

		load : 0,

		draw_color : 'white',
		draw_mode : false,

		squares : {},
		grid : {},

		_maxsquares : 2500,
		_numsquares : 0,

		square_class: "square",
		square_width: 45,
		square_height: 45,

		init_start_col: settings.start_col,
		init_start_row: settings.start_row,
		range_col: [-1000, 1000],
		range_row: [-1000, 1000],

		//TODO: This bit is very ugly.

		viewport_width : 0,
		viewport_height : 0,
		viewport_cols : 0,
		viewport_rows : 0,
		start_col : 0,
		start_row : 0,
		end_col : 0,
		end_row : 0,

		init: function(){
			coloring.$loadingbar.animate({width:'20%'},200,function(){
				coloring.load = 20;
			});
			coloring.socket = io.connect(coloring.server_address);
			coloring.socket.on('confirm-connection', function (data) {
				coloring.$loadingbar.animate({width:'60%'},200,function(){
					coloring.load = 60;
				});
				coloring.socket_connected = data;
			});
			coloring.$draggable.css({
				position: "relative",
				cursor: "move"
			});

			coloring.viewport_width = coloring.$viewport.width();
			coloring.viewport_height = coloring.$viewport.height();
			coloring.viewport_cols = Math.ceil(coloring.viewport_width / coloring.square_width);
			coloring.viewport_rows = Math.ceil(coloring.viewport_height / coloring.square_height);
			coloring.start_col = Math.ceil(coloring.init_start_col - coloring.viewport_cols / 2);
			coloring.start_row = Math.ceil(coloring.init_start_row - coloring.viewport_rows / 2);
			coloring.end_col = coloring.start_col + coloring.viewport_cols;
			coloring.end_row = coloring.start_row + coloring.viewport_rows;

			coloring.$draggable.offset({
				left: coloring.$viewport.offset().left - (coloring.start_col * coloring.square_width),
				top: coloring.$viewport.offset().top - (coloring.start_row * coloring.square_height)
			});

			for (var i = coloring.start_col - 2, m = coloring.end_col + 2; i < m && (coloring.range_col[0] <= i && i <= coloring.range_col[1]); i++) {
				coloring.grid[i] = {}
				for (var j = coloring.start_row - 2, n = coloring.end_row + 2; j < n && (coloring.range_row[0] <= j && j <= coloring.range_row[1]); j++) {
					coloring.create_tile(i, j);
				}
			}

			coloring.update_coords(coloring.start_col, coloring.start_row);
			coloring.$coord_link.focus(function(){
				coloring.$coord_link.select();
			});

			// Color in those squares. :)
			coloring.get_area(coloring.start_row - 2, coloring.end_col + 2, coloring.end_row + 2, coloring.start_col - 2);

			coloring.socket.on('change-color', function (data) {
		    	coloring.color_square(data.coords, data.color);
			});	
			$(window).resize(function() {
				coloring.update_containment();
			});

			coloring.$draggable.click(function(e){
				if(coloring.draw_mode){
					var x = e.pageX
					  , y = e.pageY;
					var clicklocation = coloring.getSquarefromoffset(x, y);
					coloring.set_color(coloring.draw_color, clicklocation.x, clicklocation.y);
				}
			});

			coloring.$viewport.droppable({
				accept : '.color',
				drop : function(e, ui) {
					var dragOffset, dragTile, dropLocation;
					dragTile = ui.draggable;
        	  		dragOffset = dragTile.offset();
        	  		dragOffset.top += dragTile.width() / 2;
        	  		dragOffset.left += dragTile.height() / 2;
        	  		dropLocation = coloring.getSquarefromoffset(dragOffset.left, dragOffset.top);
        	  		return coloring.dropcolor(dropLocation.x, dropLocation.y, dragTile);
				}
			});
			coloring.$draggable.draggable({
				stop: function(e, ui){
					coloring.update_tiles();
				},
			});

			coloring.update_containment();

			coloring.$colortiles.find('.color').draggable({ revert: true });
			coloring.$colortiles.find('.color').click(function(){
				if(coloring.draw_mode){
					var el = $(this);
					coloring.draw_color = el.attr('data-color');
					$('.active-color').removeClass('active-color');
					el.addClass('active-color');
				}
			});
			$('#draw').click(function(){
				coloring.toggle_draw();
			});
		},
		create_tile: function(i, j) {
			if (i < coloring.range_col[0] || coloring.range_col[1] < i) {
				return;
			} else if (j < coloring.range_row[0] || coloring.range_row[1] < j) {
				return;
			}

			coloring.grid[i][j] = true;
			var x = i * coloring.square_width;
			var y = j * coloring.square_height;
			var $e = coloring.$draggable.append('<div></div>');

			var coords = "" + i + "," + j;

			var $new_tile = $e.children(":last");
			$new_tile.attr({
				"class": coloring.square_class,
				'data-col': i,
				'data-row': j,
				'data-coord': coords
			}).css({
				position: "absolute",
				left: x,
				top: y,
				width: coloring.square_width,
				height: coloring.square_height
			});

			coloring.squares[coords] = $new_tile;
			coloring._numsquares++;
		},
		get_area : function(top, right, bottom, left) {
			var newColor = {
			    'top': top,
			    'right': right,
			    'bottom': bottom,
			    'left': left
			};
			coloring.socket.emit('get-area', top, right, bottom, left);
			coloring.socket.on('return-area', function (data) {
			    if(data === false){
			    	console.log('Error getting colors');
			    }
			    $.each(data, function(index,value) {
			    	coloring.color_square(value.coords, value.color)
			    });
			    if(coloring.load < 100){
			    	coloring.$loadingbar.animate({width:'100%'},200,function(){
						coloring.load = 100;
						coloring.$loadingbar.fadeOut(200);
						coloring.$loading.fadeOut(200);
					});
				}
			});
		},
		color_square : function(coords, color) {
		    if(coloring.squares[coords] !== undefined) {
		    	var oldcolor;
		    	if(oldcolor = $(coloring.squares[coords]).attr('data-color')){
		    		$(coloring.squares[coords]).removeClass(oldcolor).addClass(color).attr({'data-color':color});
		    	} else {
		    		$(coloring.squares[coords]).addClass(color).attr({'data-color':color});
		    	}
		    }
		},
		update_containment : function() {
			// Update viewport info.
			coloring.viewport_width = coloring.$viewport.width();
			coloring.viewport_height = coloring.$viewport.height();
			coloring.viewport_cols = Math.ceil(coloring.viewport_width / coloring.square_width);
			coloring.viewport_rows = Math.ceil(coloring.viewport_height / coloring.square_height);

			// Create containment box.
			var half_width = coloring.square_width / 2,
				half_height = coloring.square_height / 2,
				viewport_offset = coloring.$viewport.offset(),
				viewport_draggable_width = coloring.viewport_width - coloring.square_width,
				viewport_draggable_height = coloring.viewport_height - coloring.square_height;

			var containment = [
				(-coloring.range_col[1] * coloring.square_width) + viewport_offset.left + viewport_draggable_width,
				(-coloring.range_row[1] * coloring.square_height) + viewport_offset.top + viewport_draggable_height,
				(-coloring.range_col[0] * coloring.square_width) + viewport_offset.left,
				(-coloring.range_row[0] * coloring.square_height) + viewport_offset.top,
			];

			coloring.$draggable.draggable("option", "containment", containment);
		},
		update_tiles : function() {
			var $this = coloring.$draggable;
			var $parent = $this.parent();

			// Problem with .position() in Chrome/WebKit:
			// var pos = $(this).position();
			// So, we compute it ourselves.
			var pos = {
				left: $this.offset().left - $parent.offset().left,
				top: $this.offset().top - $parent.offset().top
			}

			var visible_left_col = Math.ceil(-pos.left / coloring.square_width) - 2,
				visible_top_row = Math.ceil(-pos.top / coloring.square_height) - 2;

			for (var i = visible_left_col; i <= visible_left_col + coloring.viewport_cols + 3; i++) {
				if (coloring.grid[i] === undefined) {
					coloring.grid[i] = {};
				}
				for (var j = visible_top_row; j <= visible_top_row + coloring.viewport_rows + 3; j++) {
					if (coloring.grid[i][j] === undefined) {
						coloring.create_tile(i, j);
					}
				}
			}

			coloring.update_coords(visible_left_col, visible_top_row);

			coloring.get_area(visible_top_row, visible_left_col + coloring.viewport_cols + 3, visible_top_row + coloring.viewport_rows + 3, visible_left_col);
			// If tooooo many squares
			if(coloring._numsquares > coloring._maxsquares){
				$.each(coloring.grid, function(x, row) { 
					if(x < (visible_left_col - 3) || x > (visible_left_col + coloring.viewport_cols + 3)) {
						$.each(row, function(y, square) {
							if(y < (visible_top_row - 3) || y > (visible_top_row + coloring.viewport_rows + 3)) {
								var coords = "" + x + "," + y;
								$(coloring.squares[coords]).addClass('out_display');
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
					delete coloring.grid[x][y];
					delete coloring.squares[coord];
					square.remove();
					coloring._numsquares--;
				});
			}
		},
		toggle_draw : function(){
			if(coloring.draw_mode){
				coloring.draw_mode = false;
				$('.active-color').removeClass('active-color');
				$('#draw').text('Enable Draw');
			} else {
				coloring.draw_mode = true;
				coloring.$colortiles.find('.' + coloring.draw_color).addClass('active-color');
				$('#draw').text('Disable Draw');
			}
			coloring.$draggable.draggable("option", "disabled", coloring.draw_mode);
			coloring.$viewport.droppable("option", "disabled", coloring.draw_mode);
			coloring.$draggable.css({ cursor: (coloring.draw_mode) ? "default" : "move" });
			coloring.$colortiles.find('.color').draggable("option", "disabled", coloring.draw_mode);
		},
		dropcolor : function(x, y, colortile){
			var color = colortile.attr('data-color');
			coloring.set_color(color, x, y);
		},
		set_color : function(color, coordx, coordy) {
		    var coords = "" + coordx + "," + coordy;
		    var newColor = {
		    	'color': color,
		    	'coordx': coordx,
		    	'coordy': coordy,
		    	'coords': coords
		    };
			coloring.color_square(coords, color);
		    coloring.socket.emit('add-color', newColor);
		},
		getSquarefromoffset : function(left, top){
			var pixelOffset = coloring.$draggable.offset(),
				resultX = (left - pixelOffset.left) / coloring.square_width,
      			resultY = (top - pixelOffset.top) / coloring.square_height;
      		return {
        		x: Math.floor(resultX),
        		y: Math.floor(resultY)
      		};
		},
		center : function(col, row) {
			var x = coloring.square_width * col,
				y = coloring.square_height * row,
				half_width = coloring.square_width / 2,
				half_height = coloring.square_height / 2,
				half_vw_width = coloring.$viewport.width() / 2,
				half_vw_height = coloring.$viewport.height() / 2,
				offset = coloring.$draggable.offset();

			var new_offset = { 
				left: -x - (half_width - half_vw_width), 
				top: -y - (half_height - half_vw_height)
			};		
			coloring.$draggable.offset(new_offset);
			coloring.update_tiles();
		},
		update_coords : function(x,y){
			coloring.current_coords.x = x + Math.ceil(coloring.viewport_cols / 2); 
			coloring.current_coords.y = y + Math.ceil(coloring.viewport_rows / 2);
			coloring.$coord_link.val('http://' + settings.server_address + '/' + coloring.current_coords.x + '/' + coloring.current_coords.y + '/');
			coloring.$coords.text(coloring.current_coords.x + ", " + coloring.current_coords.y);
		},

	};
	coloring.init();
    document.onkeydown = function(e) {
	    var element;
	    e = e || window.event;
	    if (e.target)
	    	element = e.target;
	    else if (e.srcElement)
	    	element = e.srcElement;
	    if( element.nodeType == 3)
	    	element = element.parentNode;
	    if( e.ctrlKey === true || e.altKey === true || e.metaKey === true )
	    	return;
	    var keyCode = (e.keyCode) ? e.keyCode : e.which;
	    if (keyCode && (keyCode != 27 && (element.tagName == 'INPUT' || element.tagName == 'TEXTAREA') ) )
	    	return;
	    switch(keyCode) {
	    	// d
	    	case 68:
	    		coloring.toggle_draw();
	    		break;
	    }
	};
})(jQuery);