import unittest

import ml_service


class MlServiceEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = ml_service.app.test_client()
        ml_service._blackspots_cache = None

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
        response = self.client.options('/blackspots', headers={
            'Origin': 'https://safe-route-ai-tau.vercel.app',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'content-type',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'),
                         'https://safe-route-ai-tau.vercel.app')

    def test_health_exposes_routing_readiness(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        health = response.get_json()
        self.assertEqual(health['status'], 'ok')
        self.assertIn('routing_ready', health)
        self.assertIn('tiles_available', health['tile_info'])


if __name__ == '__main__':
    unittest.main()
