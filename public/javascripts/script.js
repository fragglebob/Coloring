$(document).ready(function(){
	var draw_enabled = false;

	var infinitedrag = jQuery.infinitedrag('#wall', {}, {
		width: 50,
		height: 50,
		start_col: settings.start_col,
		start_row: settings.start_row
	}, settings.server_address);
	
	$('#color-tiles').find('.color').draggable({ revert: true });
	
	$('#color-tiles').find('.color').click(function(){
		if(draw_enabled){
			var el = $(this);
			infinitedrag.set_draw_color(el.attr('data-color'));
			$('.active-color').removeClass('active-color');
			el.addClass('active-color');
		}
	});
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
				toggle_draw();
			}
	};
	var toggle_draw = function(){
		if(draw_enabled){
			draw_enabled = false;
			$('.active-color').removeClass('active-color');
			$('#draw').text('Enable Draw');
		} else {
			draw_enabled = true;
			var color = infinitedrag.get_draw_color();
			$('#color-tiles').find('.' + color).addClass('active-color');
			$('#draw').text('Disable Draw');
		}
		infinitedrag.draw(draw_enabled);
		$('#color-tiles').find('.color').draggable("option", "disabled",draw_enabled);
	}
	$('#draw').click(toggle_draw);
});