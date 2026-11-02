import tempfile
import unittest
from unittest.mock import patch

import tile_router


class TileReadinessTests(unittest.TestCase):
    def test_partial_grid_is_not_routing_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                with open(tile_router.tile_graphml_path(0, 0), 'w') as tile:
                    tile.write('graph')
                self.assertFalse(tile_router.tiles_available())
                self.assertIn('tile_03_03', tile_router.missing_tile_ids())

    def test_empty_tile_is_not_routing_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                for path in tile_router.required_tile_paths().values():
                    with open(path, 'w') as tile:
                        tile.write('graph')
                open(tile_router.tile_graphml_path(2, 1), 'w').close()
                self.assertFalse(tile_router.tiles_available())
                self.assertIn('tile_02_01', tile_router.missing_tile_ids())

    def test_complete_grid_is_routing_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                for path in tile_router.required_tile_paths().values():
                    with open(path, 'w') as tile:
                        tile.write('graph')
                self.assertTrue(tile_router.tiles_available())
                self.assertEqual(tile_router.missing_tile_ids(), [])


if __name__ == '__main__':
    unittest.main()
