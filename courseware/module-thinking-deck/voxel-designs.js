// Pure geometry contract shared by rendering and regression tests.
export const VOXEL_BASE_EDGE = 0.44;
export const VOXEL_EDGE = VOXEL_BASE_EDGE / 2;
export function createCoarseVoxelDesigns() {
  const point = (position, component) => ({ position, component });
  const car = { rubber: [], iron: [], plastic: [], glass: [], metal: [] };
  const wheelCenters = [
    [-2.3, -0.72, -1.3, "wheel-left-front"], [2.3, -0.72, -1.3, "wheel-left-back"],
    [-2.3, -0.72, 1.3, "wheel-right-front"], [2.3, -0.72, 1.3, "wheel-right-back"],
  ];
  for (const [x, y, z, component] of wheelCenters) {
    for (const [dx, dy] of [[0, 0], [-0.48, 0], [0.48, 0], [0, -0.48], [0, 0.48]]) {
      car.rubber.push(point([x + dx, y + dy, z], component));
    }
  }
  for (const x of [-3, -2, -1, 0, 1, 2, 3]) {
    for (const z of [-0.8, 0, 0.8]) car.iron.push(point([x, -0.35, z], "frame"));
  }
  for (const x of [-1, 0, 1]) {
    for (const z of [-0.8, 0.8]) car.iron.push(point([x, 0.15, z], "frame"));
    car.iron.push(point([x, 0.65, 0], "frame"));
  }
  for (const [index, x] of [-0.65, 0.55].entries()) {
    const component = `seat-${index}`;
    car.plastic.push(point([x, 0.18, -0.35], component));
    car.plastic.push(point([x, 0.18, 0.35], component));
    car.plastic.push(point([x, 0.65, 0.35], component));
  }
  for (const [dx, dy] of [[0, 0], [-0.42, 0], [0.42, 0], [0, -0.42], [0, 0.42]]) {
    car.plastic.push(point([1.55 + dx, 0.72 + dy, -0.55], "steering"));
  }

  const scope = { rubber: [], iron: [], plastic: [], glass: [], metal: [] };
  for (const x of [-3, -2.5, -2]) {
    for (const y of [-0.5, 0, 0.5]) scope.iron.push(point([x, y, 0], "stock"));
  }
  for (const x of [-1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5]) {
    for (const z of [-0.28, 0.28]) scope.iron.push(point([x, 0, z], "stock"));
  }
  for (const y of [-0.5, -1]) {
    for (const z of [-0.22, 0.22]) scope.iron.push(point([0, y, z], "stock"));
  }
  for (const x of [-1, -0.5, 0, 0.5, 1, 1.5, 2]) {
    for (const z of [-0.28, 0.28]) scope.metal.push(point([x, 1.05, z], "scope"));
  }
  for (const x of [0, 1.5]) {
    for (const z of [-0.25, 0.25]) scope.metal.push(point([x, 0.55, z], "scope"));
  }
  for (const x of [-1.3, 2.3]) {
    for (const y of [0.82, 1.28]) {
      for (const z of [-0.22, 0.22]) scope.glass.push(point([x, y, z], "scope"));
    }
  }

  return { car, scope };
}

// Double resolution in all three axes, without enlarging the assembled object.
export function refineVoxelDesigns(coarse) {
  const offset = VOXEL_EDGE / 2;
  return Object.fromEntries(Object.entries(coarse).map(([name, design]) => [name,
    Object.fromEntries(Object.entries(design).map(([material, points]) => [material,
      points.flatMap((point, sourceIndex) => {
        const cells = [];
        for (const x of [-offset, offset]) for (const y of [-offset, offset]) for (const z of [-offset, offset]) {
          cells.push({ position: point.position.map((value, axis) => value + [x,y,z][axis]),
            component: point.component, sourceIndex, subIndex: cells.length });
        }
        return cells;
      }),
    ])),
  ]));
}
export function createVoxelDesigns() { return refineVoxelDesigns(createCoarseVoxelDesigns()); }
