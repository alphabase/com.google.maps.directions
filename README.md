# Google Maps Directions

Never be late for work by starting your day with actual traveling time.
This app has four action cards:
- One to tell you about traveling details by car from one address to another
- One to tell you about traveling details by public transport from one address to another
- One to update the traveling details to a preset work address
- One to update the traveling details to a home address

The updated traveling details to the work address will be available as tokens in the flow engine.
Also, a trigger card is available which is triggered whenever the traveling details to work have been updated.
The trigger card provides you with the same tokens which have just been updated by the action card:

- Summary: A textual summary of the advised route to follow
- Duration in traffic: The actual expected traveling time to work
- Duration: The normal traveling time to work
- Distance: The distance for the advised route to follow (in km) 

## Google Maps API key
You need a valid Google Maps Directions API key to enable this Homey app.

You can create your free API key through the Google Cloud Platform:
https://console.developers.google.com/flows/enableapi?apiid=directions_backend&reusekey=true

For instructions on how to get your API key, follow this link:
https://developers.google.com/maps/documentation/directions/get-api-key#get-an-api-key
