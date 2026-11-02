# Render ML service image. Set the Render service root directory to MlService
# and select Docker (or point its Dockerfile path at this file).
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

# Tiles are derived from the committed GraphML during image build. This keeps
# runtime independent of Overpass/OSM and guarantees a full Nagpur grid.
RUN python build_tiles_from_graphml.py

CMD gunicorn --bind 0.0.0.0:${PORT:-5001} --workers 1 --threads 4 --timeout 120 ml_service:app
