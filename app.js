/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , app = module.exports = express.createServer()
  , io = require('socket.io').listen(app)
  , mongoose = require('mongoose');
var os = require('os');
// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

io.configure('production', function(){
	io.enable('browser client minification');  // send minified client
	io.enable('browser client etag');          // apply etag caching logic based on version number
	io.enable('browser client gzip');          // gzip the file
	io.set('log level', 1);                    // reduce logging
});

io.configure('development', function(){
	io.set('transports', ['websocket']);
});
// Connect to database
mongoose.connect('mongodb://localhost/color');

// Create schema + Model
var Schema = mongoose.Schema;

var ColorSchema = new Schema({
  _id : { type: Schema.ObjectId },
  color : { type: String, default: 'white' },
  coords : { type: String },
  coordx : { type: Number, index: true },
  coordy : { type: Number, index: true },
  timestamp : { type: Date, default: Date.now }
});

var Color = mongoose.model('ColorModel', ColorSchema);

var server_port = 3210
  , server_host = 'localhost';

// Routes
app.get('/:col/:row', function(req, res, next){
	var col = req.params.col
	  , row = req.params.row
	  , server_address = server_host + ':' + server_port;
	if(col && row){
		if(col < 1000 && col > -1000 && row < 1000 && row > -1000){
			res.render('index', { title: 'Color', server_address: server_address, start_col: col, start_row: row });
		} else {
			next();
		}
	} else {
		next();
	}
});
app.get('/', function(req, res){
	var server_address = server_host + ':' + server_port;
	res.render('index', { title: 'Color', server_address: server_address, start_col: 0, start_row: 0 })
});


// On Connection
io.sockets.on('connection', function (socket) {
	// Send Verifaction of connection
	socket.emit('confirm-connection', true);
	
	// On submition of a new color
	socket.on('add-color', function (data) {
		console.log('New color at ' + data.coordx + ',' + data.coordy + ': ' + data.color);
		
		var id;
		var query = Color.find({});
		query.where('coords', data.coords);
		if(data.color != 'white') {
			query.each(function(err,sq){
				if(sq){
					id = sq._id;
				} else {
					if(id){
						Color.update({ _id : id }, data, function(err,data){
							if (err) { console.log('Error updating color: ', err); return; }
							socket.broadcast.emit('change-color', data);
						});
					} else {
						var NewColor = new Color(data);
						
						// Save to database.
						NewColor.save(function (err) {
							if (err) { console.log('Error adding color: ', err); return; }
			  				// Broadcast to the rest of users.
							socket.broadcast.emit('change-color', data);
						});
					}
				}
			});
		} else {
			query.remove(function(err){
				if (err) { console.log('Error deleting a white now white square.') }
				socket.broadcast.emit('change-color', data);
			});
		}
	});
	// On asking for a new area of color
	socket.on('get-area', function (top, right, bottom, left) {
	
		// Set up query
		var query = Color.find({});
		query.where('coordy').$gte(top);
		query.where('coordx').$gte(left);
		query.where('coordy').$lte(bottom);
		query.where('coordx').$lte(right);
		query.select('coords', 'color');
		// Run query
		var docs = {};
		query.each(function (err, doc) {
  			if (err) {
  				console.log('Error getting colors: ', err);
  				// return back false on error.
  				docs = false;
  			}
  			if(doc){
  				docs[doc.coords] = doc;
  			} else {
				socket.emit('return-area', docs);
  			}
		});

	});
});
app.listen(server_port);
console.log("Express server listening on port %d at %s in %s mode", server_port, server_host ,app.settings.env);