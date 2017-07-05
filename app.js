'use strict';

var tokens = [];

function init() {
	Homey.log('Google maps directions app ready!');
	registerToken('summary', 'string', '', function(err, token) { tokens['summary'] = token; });
	registerToken('duration_in_traffic', 'number', 0, function(err, token) { tokens['duration_in_traffic'] = token; });
	registerToken('duration', 'number', 0, function(err, token) { tokens['duration'] = token; });
	registerToken('distance', 'number', 0, function(err, token) { tokens['distance'] = token; });
}

// Driving instructions
Homey.manager('flow').on('action.com_google_maps_directions_driving', function(callback, args) {
	getRoute(args.origin, args.destination, 'driving', function(err, data) {
		if (!err) {
			Homey.manager('speech-output').say(__('resultsDriving', {'summary': data.summary, 'duration_in_traffic': data.duration_in_traffic, 'distance': data.distance, 'duration': data.duration}));	
		}
	});
	callback(null, true);
});

//Transit instructions
Homey.manager('flow').on('action.com_google_maps_directions_transit', function(callback, args) {
	getRoute(args.origin, args.destination, 'transit', function(err, data) {
		if (!err) {
			Homey.manager('speech-output').say(__('resultsTransit', {'duration': data.duration, 'departure_time': data.departure_time, 'steps': data.steps}));
		}
	});
	callback(null, true);
});

// Update details to work
Homey.manager('flow').on('action.com_google_maps_directions_updateWorkDetails', function(callback, args) {
	Homey.manager('geolocation').getLocation(function(err, location) {
		getRoute(location.latitude + ',' + location.longitude, Homey.manager('settings').get('work_address'), 'driving', function(err, data) {
			if (!err) {
				tokens['summary'].setValue(data.summary, function(err) { if (err) console.error('setValue error:', err); });
				tokens['duration_in_traffic'].setValue(data.duration_in_traffic, function(err) { if (err) console.error('setValue error:', err); });
				tokens['duration'].setValue(data.duration, function(err) { if (err) console.error('setValue error:', err); });
				tokens['distance'].setValue(data.distance, function(err) { if (err) console.error('setValue error:', err); });
				
				Homey.manager('flow').trigger('com_google_maps_directions_workDetailsUpdated', {
					"summary": data.summary,
					"duration_in_traffic": data.duration_in_traffic,
					"duration": data.duration,
					"distance": data.distance
				});
			} else {
				Homey.manager('speech-output').say(__('errorUnexpected'));
			}
		});
	});
	callback(null, true);
});

// General function to make the Google Maps Directions API webservice call
function getRoute(origin, destination, mode, callback) {
	var https = require('https');
	var base_url = 'https://maps.googleapis.com/maps/api/directions/json';
	
	// Make sure we have an API key to work with
	var api_key = Homey.manager('settings').get('api_key');
	if (!api_key) {
		Homey.manager('speech-output').say(__('noApiKey'));
		return callback(new Error('noApiKey'), null);
	}
	
	// Perform the webservice call
	https.get(base_url+
			'?origin='+encodeURIComponent(origin)+
			'&destination='+encodeURIComponent(destination)+
			'&traffic_model=best_guess'+
			'&departure_time=now'+
			'&language='+Homey.manager('i18n').getLanguage()+
			'&mode='+mode+
			'&alternatives=false'+
			'&key='+api_key, function(res) {
		
		// If a valid response status is returned, handle the call
		if (res.statusCode == 200) {
			res.setEncoding('utf8');
			var body = '';
			
			res.on('data', function (chunk) {
				body += chunk;
			});
			
			// When all data chunks have been collected, continue
			res.on('end', function() {
				var parsed = JSON.parse(body);
				// Make sure the Google API returned the OK-status
				if (parsed.status == "OK") {
					parsed.duration = Math.ceil(parsed.routes[0].legs[0].duration.value / 60);
					// Handle specifiek parameters that are concerned with driving
					if (mode == 'driving') {
						parsed.summary = parsed.routes[0].summary;
						parsed.duration_in_traffic = Math.ceil(parsed.routes[0].legs[0].duration_in_traffic.value / 60);
						parsed.distance = Math.ceil(parsed.routes[0].legs[0].distance.value / 1000);
					}
					// Handle specifiek parameters that are concerned with transit
					if (mode == 'transit') {
						parsed.departure_time = parsed.routes[0].legs[0].departure_time.text;
						parsed.steps = parsed.routes[0].legs[0].steps.length;
					}
					callback(null, parsed);
				} else {
					Homey.manager('speech-output').say(__('errorParsing', {'status': parsed.status}));
					callback(parsed.status, parsed);
				}
			});
		}
	}).on('error', function(e) {
		Homey.manager('speech-output').say(__('errorDownloading'));
		callback(new Error('errorDownloading'), null);
	});
}

function registerToken(id, type, value, callback) {
	Homey.manager('flow').registerToken(id, {
	    type: type,
	    title: __('tokens.'+id)
	}, function(err, token){
	    if(err) return console.error('registerToken error:', err);

	    token.setValue(value, function(err) {
	        if(err) return console.error('setValue error:', err);
	    });
	    
	    callback(null, token);
	});
}

module.exports.init = init;