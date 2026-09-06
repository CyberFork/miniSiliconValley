from __future__ import annotations

import unittest
from unittest.mock import patch

import launch_grid
from launch_grid import controller_bounds, stable_page_work_area, tile_work_area


class GridWorkAreaTests(unittest.TestCase):
    def test_work_area_waits_out_transient_dock_width(self) -> None:
        transient = {"left": 53, "top": 33, "width": 1675, "height": 1084}
        settled = {"left": 52, "top": 33, "width": 1676, "height": 1084}

        class Clock:
            now = 0.0

            @classmethod
            def monotonic(cls) -> float:
                return cls.now

            @classmethod
            def sleep(cls, seconds: float) -> None:
                cls.now += seconds

        samples = [transient] * 5 + [settled] * 3
        with (
            patch.object(launch_grid, "page_work_area", side_effect=samples),
            patch.object(launch_grid.time, "monotonic", side_effect=Clock.monotonic),
            patch.object(launch_grid.time, "sleep", side_effect=Clock.sleep),
        ):
            self.assertEqual(stable_page_work_area({"webSocketDebuggerUrl": "unused"}), settled)

    def test_left_dock_work_area_is_exactly_covered(self) -> None:
        area = {"left": 52, "top": 33, "width": 1676, "height": 1084}
        tiles = tile_work_area(area)
        self.assertEqual(len(tiles), 8)
        self.assertEqual(tiles[0], {"left": 52, "top": 33, "width": 419, "height": 542})
        self.assertEqual(tiles[-1], {"left": 1309, "top": 575, "width": 419, "height": 542})
        self.assertEqual(tiles[3]["left"] + tiles[3]["width"], 1728)
        self.assertEqual(tiles[7]["top"] + tiles[7]["height"], 1117)

    def test_odd_dimensions_use_contiguous_remainder_cuts(self) -> None:
        area = {"left": 80, "top": 25, "width": 1905, "height": 1175}
        tiles = tile_work_area(area)
        for row in range(2):
            for column in range(3):
                left = tiles[row * 4 + column]
                right = tiles[row * 4 + column + 1]
                self.assertEqual(left["left"] + left["width"], right["left"])
        for column in range(4):
            self.assertEqual(tiles[column]["top"] + tiles[column]["height"], tiles[4 + column]["top"])
        self.assertLessEqual(max(tile["width"] for tile in tiles) - min(tile["width"] for tile in tiles), 1)
        self.assertLessEqual(max(tile["height"] for tile in tiles) - min(tile["height"] for tile in tiles), 1)

    def test_controller_stays_inside_nonzero_work_area(self) -> None:
        area = {"left": 52, "top": 33, "width": 1676, "height": 1084}
        bounds = controller_bounds(area)
        self.assertEqual(bounds, {
            "left": 262,
            "top": 63,
            "width": 1256,
            "height": 1024,
            "windowState": "normal",
        })
        self.assertGreaterEqual(bounds["left"], area["left"])
        self.assertGreaterEqual(bounds["top"], area["top"])
        self.assertLessEqual(bounds["left"] + bounds["width"], area["left"] + area["width"])
        self.assertLessEqual(bounds["top"] + bounds["height"], area["top"] + area["height"])


if __name__ == "__main__":
    unittest.main()
