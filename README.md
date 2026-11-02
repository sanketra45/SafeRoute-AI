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






NOTE : Please prefer IntelliJ IDEA for the project.


-------------FOR RENDER ML SERVICE-------------------------------

The ML service must build its tile files from `MlService/data/nagpur_road_network.graphml`.
Configure the Render web service to use Docker with `MlService` as its root/build
context and `./Dockerfile` as its Dockerfile. Do not override the Docker start
command or mount a persistent disk at `/app/data/tiles`; the Docker build
generates and validates all 16 tiles there, and startup fails if that directory
is missing or unusable. A native Python Render service does not run this
Dockerfile and can therefore serve the stale, header-only tile files tracked in
`MlService/data/tiles`. If retaining a native service, set its root directory
to `MlService`, Build Command to
`pip install -r requirements.txt && python -u build_tiles_from_graphml.py --overwrite`,
and Start Command to
`gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 120 ml_service:app`.
Do not mount a disk over `data/tiles`; startup validates generated tiles but
does not overwrite a valid tile grid. For the native service, the app now
detects missing, empty, corrupt, or incomplete tiles during import, regenerates
the entire grid from the source GraphML under an inter-process lock, and only
then loads the model and accepts requests. The explicit Build Command is still
recommended so generation happens before service startup; the bootstrap is a
recovery path for stale checked-in tile artifacts. A generated manifest records
the source hash, grid definition, and each tile hash/count; stale but parseable
tiles are rebuilt as well.
