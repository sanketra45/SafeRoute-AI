import atexit
import os
import shutil
import tempfile


_test_tiles_dir = tempfile.mkdtemp(prefix="saferoute-test-tiles-")
os.environ["SAFEROUTE_TILES_DIR"] = _test_tiles_dir
atexit.register(shutil.rmtree, _test_tiles_dir, ignore_errors=True)
