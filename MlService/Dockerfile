# Render ML service image. Set the Render service root directory to MlService
# and select Docker (or point its Dockerfile path at this file).
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

# Pin the build to the same runtime tile directory used by tile_router.py.
RUN python -c 'import os, tile_router; expected="/app/data/tiles"; print("GraphML source: %s" % os.path.abspath("data/nagpur_road_network.graphml")); print("Tile output: %s" % tile_router.TILES_DIR); assert os.path.isfile("data/nagpur_road_network.graphml"); assert os.path.realpath(tile_router.TILES_DIR) == expected'

# Tiles are derived from the committed GraphML during image build. --overwrite
# prevents a stale build-context directory from bypassing validation. The
# generator logs every tile and exits non-zero unless all 16 valid files exist.
RUN python -u build_tiles_from_graphml.py --overwrite

# Validate GraphML semantics in the final image layer, not just file count.
RUN python -c 'from tile_router import tile_validation_status; s=tile_validation_status(); print("Validated %s/16 routing tiles, %s nodes, %s edges" % (s["valid_tiles"], sum(t["nodes"] for t in s["tiles"].values()), sum(t["edges"] for t in s["tiles"].values()))); assert s["routing_ready"], s["tiles"]'

# Also catch a Render disk mount hiding or replacing image tiles.
CMD python -c 'from tile_router import tile_validation_status; s=tile_validation_status(); print("Startup tile validation: %s/16 valid" % s["valid_tiles"]); assert s["routing_ready"], s["tiles"]' && \
    exec gunicorn --bind 0.0.0.0:${PORT:-5001} --workers 1 --threads 2 --timeout 120 ml_service:app
