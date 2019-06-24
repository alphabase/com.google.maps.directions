'use strict';

const Homey = require('homey');

class GoogleMaps extends Homey.App {

	onInit() {
		const parent = this;
		let directionsDriving = new Homey.FlowCardAction('com_google_maps_directions_driving');
		directionsDriving
			.register()
			.registerRunListener(( args, state ) => {

				this.getRoute(args.origin, args.destination, 'driving', function(err, data) {
					if (!err) {
						Homey.ManagerSpeechOutput.say(Homey.__('resultsDriving', {'summary': data.summary, 'duration_in_traffic': data.duration_in_traffic, 'distance': data.distance, 'duration': data.duration}));

						let drivingDetailsUpdated = new Homey.FlowCardTrigger('com_google_maps_directions_drivingDetailsUpdated');

						let tokens = {
								origin: args.origin,
								destination: args.destination,
								summary: data.summary,
								duration_in_traffic: data.duration_in_traffic,
								duration: data.duration,
								distance: data.distance
							};

						drivingDetailsUpdated
							.register()
							.trigger(tokens)
							.catch( parent.error );

						return Promise.resolve( data.duration );
					}
				});

				return Promise.resolve( 0 );

			});

		let directionsTransit = new Homey.FlowCardAction('com_google_maps_directions_transit');
		directionsTransit
			.register()
			.registerRunListener(( args, state ) => {

				this.getRoute(args.origin, args.destination, 'transit', function(err, data) {
					if (!err) {
						Homey.Homey.ManagerSpeechOutput.say(Homey.__('resultsTransit', {'duration': data.duration, 'departure_time': data.departure_time, 'steps': data.steps}));

						let transitDetailsUpdated = new Homey.FlowCardTrigger('com_google_maps_directions_transitDetailsUpdated');

						let tokens = {
							origin: args.origin,
							destination: args.destination,
							departure_time: data.departure_time,
							steps: data.steps,
							duration: data.duration
						};

						transitDetailsUpdated
							.register()
							.trigger(tokens)
							.catch( parent.error );

						return Promise.resolve( data.duration );
					}
				});

				return Promise.resolve( 0 );

			});

		let updateHomeDetails = new Homey.FlowCardAction('com_google_maps_directions_updateHomeDetails');
		updateHomeDetails
			.register()
			.registerRunListener(( args, state ) => {

				const latitude = Homey.ManagerGeolocation.getLatitude();
				const longitude = Homey.ManagerGeolocation.getLongitude();
				this.getRoute(Homey.ManagerSettings.get('work_address'), latitude + ',' + longitude, (args.mode === undefined ? 'driving' : args.mode), function(err, data) {
					if (!err) {
						let homeDetailsUpdated = new Homey.FlowCardTrigger('com_google_maps_directions_homeDetailsUpdated');

						let tokens = {};

						if (args.mode === 'transit')
						{
							tokens = {
								departure_time: data.departure_time,
								steps: data.steps,
								duration: data.duration,
								summary: '',
								duration_in_traffic: 0,
								distance: 0
							};
						}
						else
						{
							tokens = {
								summary: data.summary,
								duration_in_traffic: data.duration_in_traffic,
								duration: data.duration,
								distance: data.distance,
								departure_time: 0,
								steps: 0
							};
						}



						homeDetailsUpdated
							.register()
							.trigger(tokens)
							.catch( parent.error );
						return Promise.resolve([tokens]);
					} else {
						Homey.ManagerSpeechOutput.say(Homey.__('errorUnexpected'));
					}
				});

				return Promise.resolve();

			});

		let updateWorkDetails = new Homey.FlowCardAction('com_google_maps_directions_updateWorkDetails');
		updateWorkDetails
			.register()
			.registerRunListener(( args, state ) => {

				const latitude = Homey.ManagerGeolocation.getLatitude();
				const longitude = Homey.ManagerGeolocation.getLongitude();
				this.getRoute(latitude + ',' + longitude, Homey.ManagerSettings.get('work_address'), (args.mode === undefined ? 'driving' : args.mode), function(err, data) {
					if (!err) {
						let workDetailsUpdated = new Homey.FlowCardTrigger('com_google_maps_directions_workDetailsUpdated');

						let tokens = {};

						if (args.mode === 'transit')
						{
							tokens = {
								departure_time: data.departure_time,
								steps: data.steps,
								duration: data.duration,
								summary: '',
								duration_in_traffic: 0,
								distance: 0
							};
						}
						else
						{
							tokens = {
								summary: data.summary,
								duration_in_traffic: data.duration_in_traffic,
								duration: data.duration,
								distance: data.distance,
								departure_time: 0,
								steps: 0
							};
						}



						workDetailsUpdated
							.register()
							.trigger(tokens)
							.catch( parent.error );

						return Promise.resolve([tokens]);
					} else {
						Homey.ManagerSpeechOutput.say(Homey.__('errorUnexpected'));
					}
				});

				return Promise.resolve();

			});
	}

	// General function to make the Google Maps Directions API webservice call
	getRoute(origin, destination, mode, callback) {
		const https = require('https');
		const base_url = 'https://maps.googleapis.com/maps/api/directions/json';

		// Make sure we have an API key to work with
		var api_key = Homey.ManagerSettings.get('api_key');
		if (!api_key) {
			Homey.ManagerSpeechOutput.say(Homey.__('noApiKey'));
			return callback(new Error('noApiKey'), null);
		}

		// Perform the webservice call
		https.get(base_url+
			'?origin='+encodeURIComponent(origin)+
			'&destination='+encodeURIComponent(destination)+
			'&traffic_model=best_guess'+
			'&departure_time=now'+
			'&language='+Homey.ManagerI18n.getLanguage()+
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
						if (parsed.status === undefined)
						{
							pared.status = parsed.error_message;
						}
						Homey.ManagerSpeechOutput.say(Homey.__('errorParsing', {'status': parsed.status}));
						callback(parsed.status, parsed);
					}
				});
			}
		}).on('error', function(e) {
			Homey.ManagerSpeechOutput.say(Homey.__('errorDownloading'));
			callback(new Error('errorDownloading'), null);
		});
	}



}
module.exports = GoogleMaps;