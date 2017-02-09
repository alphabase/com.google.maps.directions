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
			var summary = data.routes[0].summary;
			var duration_in_traffic = data.routes[0].legs[0].duration_in_traffic.text.replace('min', __('min'));
			var duration = data.routes[0].legs[0].duration.text.replace('min', __('min'));
			var distance = data.routes[0].legs[0].distance.text.replace('km', __('km'));
			
			Homey.manager('speech-output').say(__('resultsDriving', {'summary': summary, 'duration_in_traffic': duration_in_traffic, 'distance': distance, 'duration': duration}));	
		}
	});
	callback(null, true);
});

// Transit instructions
Homey.manager('flow').on('action.com_google_maps_directions_transit', function(callback, args) {
	getRoute(args.origin, args.destination, 'transit', function(err, data) {
		if (!err) {
			var duration = data.routes[0].legs[0].duration.text.replace('min', __('min'));
			var departure_time = data.routes[0].legs[0].departure_time.text;
			var steps = data.routes[0].legs[0].steps.length;
			
			Homey.manager('speech-output').say(__('resultsTransit', {'duration': duration, 'departure_time': departure_time, 'steps': steps}));
		}
	});
	callback(null, true);
});

// Bicyling instructions
Homey.manager('flow').on('action.com_google_maps_directions_bicycling', function(callback, args) {
	getRoute(args.origin, args.destination, 'bicycling', function(err, data) {
		if (!err) {
			var summary = data.routes[0].summary;
			var duration = data.routes[0].legs[0].duration.text.replace('min', __('min'));
			var distance = data.routes[0].legs[0].distance.text.replace('km', __('km'));
			
			Homey.manager('speech-output').say(__('resultsBicycling', {'summary': summary, 'duration': duration, 'distance': distance}));
		}
	});
	callback(null, true);
});

// Walking instructions
Homey.manager('flow').on('action.com_google_maps_directions_walking', function(callback, args) {
	getRoute(args.origin, args.destination, 'walking', function(err, data) {
		if (!err) {
			var summary = data.routes[0].summary;
			var duration = data.routes[0].legs[0].duration.text.replace('min', __('min'));
			var distance = data.routes[0].legs[0].distance.text.replace('km', __('km'));
			
			Homey.manager('speech-output').say(__('resultsWalking', {'summary': summary, 'duration': duration, 'distance': distance}));
		}
	});
	callback(null, true);
});

// Update details to work
Homey.manager('flow').on('action.com_google_maps_directions_driving_to_work', function(callback, args) {
	Homey.manager('geolocation').getLocation(function(err, location) {
		getRoute(location.latitude + ',' + location.longitude, Homey.manager('settings').get('work_address'), 'driving', function(err, data) {
			if (!err) {
				var summary = data.routes[0].summary;
				var duration_in_traffic = Math.ceil(data.routes[0].legs[0].duration_in_traffic.value / 60);
				var duration = Math.ceil(data.routes[0].legs[0].duration.value / 60);
				var distance = Math.ceil(data.routes[0].legs[0].distance.value / 1000);
				
				tokens['summary'].setValue(summary, function(err) { if (err) console.error('setValue error:', err); });
				tokens['duration_in_traffic'].setValue(duration_in_traffic, function(err) { if (err) console.error('setValue error:', err); });
				tokens['duration'].setValue(duration, function(err) { if (err) console.error('setValue error:', err); });
				tokens['distance'].setValue(distance, function(err) { if (err) console.error('setValue error:', err); });
				
				Homey.manager('flow').trigger('com_google_maps_trigger', {
					"summary": summary,
					"duration_in_traffic": duration_in_traffic,
					"duration": duration,
					"distance": distance
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