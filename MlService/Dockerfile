# Render ML service image. Set the Render service root directory to MlService
# and select Docker (or point its Dockerfile path at this file).
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

# Tiles are derived from the committed GraphML during image build. --overwrite
# prevents a stale build-context directory from bypassing validation. The
# generator logs every tile and exits non-zero unless all 16 valid files exist.
RUN python -u build_tiles_from_graphml.py --overwrite

# Validate the generated files in the final image layer.
RUN test "$(find data/tiles -name 'tile_*.graphml' -type f -size +0c | wc -l | tr -d '[:space:]')" -eq 16

# Also catch an empty Render disk mount hiding the image's generated tiles.
CMD count=$(find data/tiles -name 'tile_*.graphml' -type f -size +0c | wc -l | tr -d '[:space:]'); \
    if [ "$count" -ne 16 ]; then echo "Expected 16 nonempty routing tiles, found $count" >&2; exit 1; fi; \
    exec gunicorn --bind 0.0.0.0:${PORT:-5001} --workers 1 --threads 4 --timeout 120 ml_service:app
