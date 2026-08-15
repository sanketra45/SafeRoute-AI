import unittest
import networkx as nx

from risk_router import _live_conditions, compute_safe_route


class LiveRoutingTests(unittest.TestCase):
    def setUp(self):
        self.graph = nx.MultiDiGraph()
        self.graph.add_node("a", y=21.1000, x=79.1000)
        self.graph.add_node("b", y=21.1000, x=79.1010)
        self.graph.add_node("c", y=21.1010, x=79.1000)
        self.graph.add_node("d", y=21.1010, x=79.1010)
        for source, target, length, risk in [
            ("a", "b", 100, .10), ("b", "d", 100, .10),
            ("a", "c", 110, .05), ("c", "d", 110, .05),
        ]:
            self.graph.add_edge(source, target, length=length, risk_score=risk)

    def test_live_condition_normalisation(self):
        congestion, weather_risk = _live_conditions({
            "traffic": {"currentSpeed": 20, "freeFlowSpeed": 50},
            "weather": {"condition": "RAIN"},
        })
        self.assertAlmostEqual(congestion, .6)
        self.assertGreater(weather_risk, .6)

    def test_live_conditions_increase_reported_route_risk(self):
        clear = compute_safe_route(self.graph, 21.1, 79.1, 21.101, 79.101)
        rain = compute_safe_route(self.graph, 21.1, 79.1, 21.101, 79.101, live_conditions={
            "traffic": {"currentSpeed": 15, "freeFlowSpeed": 60},
            "weather": {"condition": "RAIN"},
        })
        self.assertTrue(clear["success"])
        self.assertTrue(rain["success"])
        self.assertGreater(rain["avg_risk_score"], clear["avg_risk_score"])
        self.assertGreater(rain["live_conditions"]["congestion"], 0)


if __name__ == "__main__":
    unittest.main()
