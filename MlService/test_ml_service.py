from concurrent.futures import ThreadPoolExecutor
import threading
import tempfile
import unittest
from unittest.mock import patch

import ml_service
import networkx as nx
import tile_router


def write_usable_tile(path, start_id):
    graph = nx.MultiDiGraph()
    graph.add_node(start_id, y='21.1', x='79.1')
    graph.add_node(start_id + 1, y='21.11', x='79.11')
    graph.add_edge(start_id, start_id + 1, length='100.0')
    nx.write_graphml(graph, path)


class MlServiceEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = ml_service.app.test_client()
        ml_service._blackspots_cache = None

    def test_service_startup_bootstraps_complete_tile_grid(self):
        status = tile_router.tile_validation_status()
        self.assertTrue(status['routing_ready'], status['tiles'])
        self.assertEqual(status['valid_tiles'], 16)
        self.assertEqual(status['invalid_tiles'], 0)

    def test_blackspots_uses_the_committed_dataset(self):
        response = self.client.get('/blackspots')
        self.assertEqual(response.status_code, 200)
        records = response.get_json()
        self.assertGreater(len(records), 0)
        self.assertTrue(all(isinstance(record['lat'], float) for record in records))
        self.assertTrue(all(isinstance(record['lng'], float) for record in records))
        self.assertTrue(all(record['risk'] in {'HIGH', 'MEDIUM', 'LOW'} for record in records))

    def test_blackspot_risk_filter_matches_returned_records(self):
        response = self.client.get('/blackspots?risk=HIGH')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(record['risk'] == 'HIGH' for record in response.get_json()))

    def test_blackspots_allows_the_deployed_frontend_origin(self):
        origin = 'https://safe-route-ai-tau.vercel.app'
        response = self.client.get('/blackspots', headers={'Origin': origin})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), origin)

        response = self.client.options('/blackspots', headers={
            'Origin': origin,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'content-type',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), origin)

    def test_health_exposes_routing_readiness(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                for index, path in enumerate(tile_router.required_tile_paths().values()):
                    write_usable_tile(path, index * 2)

                response = self.client.get('/health')
                self.assertEqual(response.status_code, 200)
                health = response.get_json()
                self.assertEqual(health['status'], 'ok')
                self.assertTrue(health['routing_ready'])
                self.assertTrue(health['tile_info']['tiles_available'])
                self.assertEqual(health['tile_info']['valid_tiles'], 16)
                self.assertEqual(health['tile_info']['invalid_tiles'], 0)

    def test_health_reports_not_ready_when_a_tile_has_no_usable_graph(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                paths = tile_router.required_tile_paths()
                for index, path in enumerate(paths.values()):
                    write_usable_tile(path, index * 2)
                with open(paths['tile_00_00'], 'w', encoding='utf-8') as tile:
                    tile.write('<graphml xmlns="http://graphml.graphdrawing.org/xmlns">'
                               '<graph edgedefault="directed"></graph></graphml>')

                response = self.client.get('/health')
                health = response.get_json()
                self.assertFalse(health['routing_ready'])
                self.assertFalse(health['tile_info']['tiles_available'])
                self.assertEqual(health['tile_info']['valid_tiles'], 15)
                self.assertEqual(health['tile_info']['invalid_tiles'], 1)
                self.assertIn('tile_00_00', health['tile_info']['unusable_tile_ids'])

    def test_tiles_status_counts_only_nonempty_tile_files(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tile_router, 'TILES_DIR', directory):
                paths = tile_router.required_tile_paths()
                for index, path in enumerate(paths.values()):
                    write_usable_tile(path, index * 2)

                response = self.client.get('/tiles/status')
                self.assertEqual(response.status_code, 200)
                status = response.get_json()
                self.assertEqual(status['total_files'], 16)
                self.assertTrue(status['routing_ready'])
                self.assertEqual(status['valid_tiles'], 16)

                empty_path = paths['tile_00_00']
                with open(empty_path, 'w'):
                    pass
                response = self.client.get('/tiles/status')
                status = response.get_json()
                self.assertFalse(status['routing_ready'])
                self.assertEqual(status['invalid_tiles'], 1)
                self.assertFalse(status['tile_files']['tile_00_00']['valid'])
                self.assertIn('tile_00_00', status['missing_tiles'])

    def test_concurrent_route_request_is_rejected_while_route_runs(self):
        started = threading.Event()
        release = threading.Event()

        def blocking_route(*args, **kwargs):
            started.set()
            self.assertTrue(release.wait(timeout=5))
            route = {
                'success': True,
                'route_coords': [[21.1, 79.1], [21.11, 79.11]],
                'total_distance_m': 100.0,
                'total_distance_km': 0.1,
                'avg_risk_score': 0.1,
                'max_risk_score': 0.1,
                'live_conditions': {},
            }
            return {'safe_route': route, 'short_route': route, 'comparison': {}}

        payload = {
            'originLat': 21.1, 'originLon': 79.1,
            'destLat': 21.11, 'destLon': 79.11,
        }
        with patch.object(ml_service, 'TILE_ROUTER_AVAILABLE', True), \
                patch.object(ml_service, 'tiles_available', return_value=True), \
                patch.object(ml_service, 'compare_routes_tile', side_effect=blocking_route):
            with ThreadPoolExecutor(max_workers=2) as executor:
                first = executor.submit(
                    lambda: ml_service.app.test_client().post('/safe-route', json=payload))
                self.assertTrue(started.wait(timeout=5))
                second = ml_service.app.test_client().post('/safe-route', json=payload)
                self.assertEqual(second.status_code, 503)
                self.assertEqual(second.headers.get('Retry-After'), '1')
                release.set()
                first_response = first.result(timeout=5)

        self.assertEqual(first_response.status_code, 200)


if __name__ == '__main__':
    unittest.main()
