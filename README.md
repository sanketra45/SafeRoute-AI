---------------REQUIREMENTS TO RUN THE PROJECT-------------------

1. Java Development Kit (JDK) 17 OR newer.
2. Node.js (v18.x or v20.x) with npm to run the React frontend.
3. Python (v3.9 to v3.12) to run the Machine Learning service.


--------------FOR ML SERVICE------------------------------------

1. Install Dependencies :
   cd MlService
   pip install -r requirements.txt

2. Download the Map Network Graph :
   python download_nagpur_graph.py

3. To run ML model :
   python ml_model.py
   python ml_service.py


-------------FOR FRONTEND UI SERVICE---------------------------

1. Install Packages :
   cd saferoute-ui
   npm install

2. To run the Frontend
   npm run dev

-------------LIVE ROUTING INTEGRATION----------------------

The navigation flow is:
React Navigate page -> Spring Boot POST /api/safe-route -> Python POST /safe-route.
Spring Boot fetches current TomTom traffic flow and OpenWeatherMap conditions at the
route origin, then includes the normalized values in the Python A* request. API keys
remain on the server.

Set these values before starting Spring Boot (or place them in application.properties):

weather.api.key=YOUR_OPENWEATHERMAP_KEY
traffic.api.key=YOUR_TOMTOM_KEY

Without keys, the backend returns clearly marked mock weather/traffic values, so the
full route flow remains usable in demonstrations. New hazard reports are broadcast
over STOMP at /topic/hazards and displayed by both map pages through /ws-native.






NOTE : Please prefer IntelliJ IDEA for the project.
