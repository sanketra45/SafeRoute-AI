import os
import tempfile
import unittest
import xml.etree.ElementTree as ET
from unittest.mock import patch

import build_tiles_from_graphml as generator
import tile_router


GRAPHML_NS = 'http://graphml.graphdrawing.org/xmlns'
NS = '{' + GRAPHML_NS + '}'


class TileGenerationTests(unittest.TestCase):
    def test_generator_and_router_share_the_runtime_tile_directory(self):
        self.assertEqual(
            os.path.realpath(generator.TILES_DIR),
            os.path.realpath(tile_router.TILES_DIR),
        )

    def test_real_graphml_repairs_stale_tiles_and_router_loads_all_sixteen(self):
        source_path = os.path.join(generator.BASE_DIR, 'data', 'nagpur_road_network.graphml')
        self.assertTrue(os.path.isfile(source_path), source_path)

        with tempfile.TemporaryDirectory() as directory:
            tiles_path = os.path.join(directory, 'tiles')
            os.makedirs(tiles_path)
            for tile_id in tile_router.required_tile_paths():
                with open(os.path.join(tiles_path, tile_id + '.graphml'),
                          'w', encoding='utf-8') as stale:
                    stale.write(
                        '<?xml version="1.0"?>'
                        '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">'
                        '<graph edgedefault="directed"></graph></graphml>'
                    )

            with patch.object(generator, 'GRAPHML_PATH', source_path), \
                    patch.object(generator, 'TILES_DIR', tiles_path), \
                    patch.object(tile_router, 'TILES_DIR', tiles_path):
                generator.ensure_tiles_ready()

                status = tile_router.tile_validation_status()
                self.assertEqual(status['valid_tiles'], 16, status['tiles'])
                self.assertEqual(status['invalid_tiles'], 0, status['tiles'])
                self.assertTrue(status['routing_ready'])
                self.assertEqual(len(status['tiles']), 16)
                self.assertGreater(
                    sum(tile['nodes'] for tile in status['tiles'].values()), 0)
                self.assertGreater(
                    sum(tile['edges'] for tile in status['tiles'].values()), 0)
                self.assertEqual(
                    set(os.listdir(tiles_path)),
                    {tile_id + '.graphml' for tile_id in tile_router.required_tile_paths()}
                    | {generator.MANIFEST_NAME},
                )

                cache = tile_router.TileCache(max_tiles=1)
                with patch.object(cache, '_ensure_blackspots', return_value=(None, [])):
                    for row in range(tile_router.GRID_ROWS):
                        for col in range(tile_router.GRID_COLS):
                            tile_id = tile_router.get_tile_id(row, col)
                            with self.subTest(tile=tile_id):
                                graph = cache.get(row, col)
                                validation = status['tiles'][tile_id]
                                self.assertEqual(graph.number_of_nodes(), validation['nodes'])
                                self.assertEqual(graph.number_of_edges(), validation['edges'])
                                self.assertGreater(graph.number_of_nodes(), 0)
                                self.assertGreater(graph.number_of_edges(), 0)
                                cache.clear()

                for tile_id, tile in status['tiles'].items():
                    with self.subTest(tile=tile_id):
                        self.assertTrue(tile['valid'], tile['error'])
                        self.assertGreater(tile['nodes'], 0)
                        self.assertGreater(tile['edges'], 0)

                stale_tile = tile_router.tile_graphml_path(0, 0)
                with open(stale_tile, 'w', encoding='utf-8') as stale:
                    stale.write(
                        f'<graphml xmlns="{GRAPHML_NS}">'
                        '<key id="lat" for="node" attr.name="y"/>'
                        '<key id="lon" for="node" attr.name="x"/>'
                        '<graph edgedefault="directed">'
                        '<node id="a"><data key="lat">21.1</data><data key="lon">79.1</data></node>'
                        '<node id="b"><data key="lat">21.11</data><data key="lon">79.11</data></node>'
                        '<edge source="a" target="b"/>'
                        '</graph></graphml>'
                    )
                self.assertTrue(tile_router.validate_tile_file(stale_tile)['valid'])
                generator.ensure_tiles_ready()
                repaired = tile_router.validate_tile_file(stale_tile)
                self.assertEqual(repaired['nodes'], status['tiles']['tile_00_00']['nodes'])
                self.assertEqual(repaired['edges'], status['tiles']['tile_00_00']['edges'])

    def test_builds_and_validates_all_sixteen_nonempty_tiles(self):
        with tempfile.TemporaryDirectory() as directory:
            source_path = os.path.join(directory, 'source.graphml')
            tiles_path = os.path.join(directory, 'tiles')
            elements = [
                f'<graphml xmlns="{GRAPHML_NS}">',
                '<key id="lat" for="node" attr.name="y" attr.type="double"/>',
                '<key id="lon" for="node" attr.name="x" attr.type="double"/>',
                '<graph edgedefault="directed">',
            ]
            for row in range(4):
                for col in range(4):
                    source = f'n{row}_{col}_a'
                    target = f'n{row}_{col}_b'
                    elements.extend([
                        f'<node id="{source}"><data key="lat">{row + 0.25}</data>'
                        f'<data key="lon">{col + 0.25}</data></node>',
                        f'<node id="{target}"><data key="lat">{row + 0.75}</data>'
                        f'<data key="lon">{col + 0.75}</data></node>',
                        f'<edge source="{source}" target="{target}"/>',
                    ])
            elements.extend(['</graph>', '</graphml>'])
            with open(source_path, 'w', encoding='utf-8') as source_file:
                source_file.write(''.join(elements))

            bounds = {'lat_min': 0, 'lat_max': 4, 'lon_min': 0, 'lon_max': 4}
            with patch.object(generator, 'GRAPHML_PATH', source_path), \
                    patch.object(generator, 'TILES_DIR', tiles_path), \
                    patch.object(tile_router, 'TILES_DIR', tiles_path), \
                    patch.object(tile_router, 'NAGPUR_BBOX', bounds), \
                    patch.object(tile_router, 'OVERLAP_DEG', 0.01):
                generator.build_tiles(overwrite=True)

                self.assertTrue(tile_router.tiles_available())
                self.assertEqual(len(tile_router.required_tile_paths()), 16)
                for tile_path in tile_router.required_tile_paths().values():
                    graph = ET.parse(tile_path).getroot().find(NS + 'graph')
                    self.assertEqual(len(graph.findall(NS + 'node')), 2)
                    self.assertEqual(len(graph.findall(NS + 'edge')), 1)


if __name__ == '__main__':
    unittest.main()
