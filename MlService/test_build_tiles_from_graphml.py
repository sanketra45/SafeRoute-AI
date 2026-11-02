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
