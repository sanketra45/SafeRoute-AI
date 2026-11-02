import os
import tempfile
import unittest
from unittest.mock import patch

import networkx as nx
import tile_router


def write_graph(path, nodes, edges):
    graph = nx.MultiDiGraph()
    for node_id, lat, lng in nodes:
        graph.add_node(node_id, y=str(lat), x=str(lng))
    for source, target in edges:
        graph.add_edge(source, target, length='100.0', highway='residential')
    nx.write_graphml(graph, path)


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
                for index, path in enumerate(tile_router.required_tile_paths().values()):
                    write_graph(path, [(index * 2, 21.1, 79.1),
                                       (index * 2 + 1, 21.11, 79.11)],
                                [(index * 2, index * 2 + 1)])
                self.assertTrue(tile_router.tiles_available())
                self.assertEqual(tile_router.missing_tile_ids(), [])

    def test_corrupt_and_empty_graphml_are_not_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                paths = tile_router.required_tile_paths()
                for index, path in enumerate(paths.values()):
                    write_graph(path, [(index * 2, 21.1, 79.1),
                                       (index * 2 + 1, 21.11, 79.11)],
                                [(index * 2, index * 2 + 1)])

                with open(paths['tile_00_00'], 'w', encoding='utf-8') as tile:
                    tile.write('<graphml><graph>')
                with open(paths['tile_00_01'], 'w', encoding='utf-8') as tile:
                    tile.write('<graphml xmlns="http://graphml.graphdrawing.org/xmlns">'
                               '<graph edgedefault="directed"></graph></graphml>')

                self.assertFalse(tile_router.tiles_available())
                status = tile_router.tile_validation_status()
                self.assertEqual(status['invalid_tiles'], 2)
                self.assertIn('tile_00_00', tile_router.missing_tile_ids())
                self.assertIn('tile_00_01', tile_router.missing_tile_ids())

    def test_tile_loader_rejects_empty_and_corrupt_graphml(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                paths = tile_router.required_tile_paths()
                with open(paths['tile_00_00'], 'w', encoding='utf-8'):
                    pass
                with open(paths['tile_00_01'], 'w', encoding='utf-8') as tile:
                    tile.write('<graphml><graph>')

                cache = tile_router.TileCache(max_tiles=1)
                with self.assertRaisesRegex(ValueError, 'Unusable routing tile'):
                    cache.get(0, 0)
                with self.assertRaisesRegex(ValueError, 'Unusable routing tile'):
                    cache.get(0, 1)

    def test_tile_without_coordinate_attributes_is_not_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                graph = nx.MultiDiGraph()
                graph.add_edge(1, 2, length='100.0')
                nx.write_graphml(graph, tile_router.tile_graphml_path(0, 0))
                result = tile_router.validate_tile_file(
                    tile_router.tile_graphml_path(0, 0))
                self.assertFalse(result['valid'])
                self.assertIn('coordinates', result['error'])

    def test_real_generated_tile_loads_with_expected_graph_counts(self):
        tiles_dir = os.path.join(os.path.dirname(__file__), 'data', 'tiles')
        tile_path = os.path.join(tiles_dir, 'tile_01_01.graphml')
        if not os.path.isfile(tile_path) or os.path.getsize(tile_path) < 1000:
            self.skipTest('Committed generated GraphML tile is unavailable')

        with patch.object(tile_router, 'TILES_DIR', tiles_dir):
            validation = tile_router.validate_tile_file(tile_path)
            self.assertTrue(validation['valid'], validation['error'])
            cache = tile_router.TileCache(max_tiles=1)
            with patch.object(cache, '_ensure_blackspots', return_value=(None, [])):
                graph = cache.get(1, 1)
            self.assertEqual(graph.number_of_nodes(), validation['nodes'])
            self.assertEqual(graph.number_of_edges(), validation['edges'])
            self.assertGreater(graph.number_of_nodes(), 0)
            self.assertGreater(graph.number_of_edges(), 0)
            self.assertTrue(all(set(attrs) <= {'x', 'y'}
                                for _, attrs in graph.nodes(data=True)))
            self.assertTrue(all(set(attrs) <= {'length', 'risk_score'}
                                for _, _, _, attrs in graph.edges(keys=True, data=True)))
            cache.clear()

    def test_cache_evicts_old_graph_and_remains_bounded(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                for row, col, start in [(0, 0, 10), (0, 1, 20)]:
                    write_graph(tile_router.tile_graphml_path(row, col),
                                [(start, 21.1, 79.1), (start + 1, 21.11, 79.11)],
                                [(start, start + 1)])
                cache = tile_router.TileCache(max_tiles=1)
                with patch.object(cache, '_ensure_blackspots', return_value=(None, [])):
                    cache.get(0, 0)
                    self.assertEqual(list(cache.cache_info()), ['tile_00_00'])
                    cache.get(0, 1)
                self.assertEqual(list(cache.cache_info()), ['tile_00_01'])
                self.assertLessEqual(len(cache.cache_info()), 1)
                cache.clear()

    def test_route_spanning_two_tiles_uses_both_graphs(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                write_graph(tile_router.tile_graphml_path(1, 1),
                            [(1, 21.1, 79.1), (2, 21.105, 79.105)], [(1, 2)])
                write_graph(tile_router.tile_graphml_path(1, 2),
                            [(2, 21.105, 79.105), (3, 21.11, 79.11)], [(2, 3)])
                cache = tile_router.TileCache(max_tiles=1)
                with patch.object(cache, '_ensure_blackspots', return_value=(None, [])), \
                        patch.object(tile_router, '_tile_cache', cache), \
                        patch.object(tile_router, 'tiles_for_corridor',
                                     return_value=[(1, 1), (1, 2)]):
                    result = tile_router.compare_routes_tile(
                        21.1, 79.1, 21.11, 79.11)

                self.assertTrue(result['safe_route']['success'],
                                result['safe_route'].get('error'))
                self.assertTrue(result['short_route']['success'],
                                result['short_route'].get('error'))
                self.assertEqual(result['short_route']['route_nodes'], ['1', '2', '3'])
                self.assertEqual(cache.cache_info(), {})

    def test_route_expands_once_when_core_tiles_cannot_connect_endpoints(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                write_graph(tile_router.tile_graphml_path(1, 1),
                            [(1, 21.1, 79.1), (2, 21.11, 79.11)], [(1, 2)])
                write_graph(tile_router.tile_graphml_path(1, 2),
                            [(10, 21.2, 79.2), (11, 21.201, 79.201)], [(10, 11)])
                cache = tile_router.TileCache(max_tiles=1)
                tile_sets = [[(1, 1)], [(1, 1), (1, 2)]]
                with patch.object(cache, '_ensure_blackspots', return_value=(None, [])), \
                        patch.object(tile_router, '_tile_cache', cache), \
                        patch.object(tile_router, '_route_tile_sets', return_value=tile_sets):
                    result = tile_router.compare_routes_tile(
                        21.2, 79.2, 21.201, 79.201)

                self.assertTrue(result['safe_route']['success'],
                                result['safe_route'].get('error'))
                self.assertTrue(result['short_route']['success'],
                                result['short_route'].get('error'))

    def test_corridor_expansion_stays_within_route_tile_limit(self):
        bounds = tile_router.NAGPUR_BBOX
        attempts = tile_router._route_tile_sets(
            bounds['lat_min'], bounds['lon_min'],
            bounds['lat_max'], bounds['lon_max'])
        self.assertTrue(attempts)
        self.assertEqual(attempts[0], tile_router.tiles_for_corridor(
            bounds['lat_min'], bounds['lon_min'],
            bounds['lat_max'], bounds['lon_max']))
        self.assertTrue(all(len(tile_ids) <= tile_router.MAX_ROUTE_TILES
                            for tile_ids in attempts))
        self.assertTrue(all(len(attempts[i]) <= len(attempts[i + 1])
                            for i in range(len(attempts) - 1)))

    def test_route_tile_limit_rejects_oversized_graph_before_loading(self):
        cache = tile_router.TileCache(max_tiles=1)
        too_many = [(index // 4, index % 4) for index in range(
            tile_router.MAX_ROUTE_TILES + 1)]
        with self.assertRaisesRegex(ValueError, 'protect service memory'):
            cache.get_tiles_for_route(21.1, 79.1, 21.2, 79.2, tile_ids=too_many)


if __name__ == '__main__':
    unittest.main()
