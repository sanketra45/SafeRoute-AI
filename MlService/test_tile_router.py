import tempfile
import unittest
from unittest.mock import patch

import tile_router


class TileReadinessTests(unittest.TestCase):
    def test_partial_grid_is_not_routing_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                open(tile_router.tile_graphml_path(0, 0), 'w').close()
                self.assertFalse(tile_router.tiles_available())
                self.assertIn('tile_03_03', tile_router.missing_tile_ids())

    def test_complete_grid_is_routing_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                for path in tile_router.required_tile_paths().values():
                    open(path, 'w').close()
                self.assertTrue(tile_router.tiles_available())
                self.assertEqual(tile_router.missing_tile_ids(), [])


if __name__ == '__main__':
    unittest.main()
