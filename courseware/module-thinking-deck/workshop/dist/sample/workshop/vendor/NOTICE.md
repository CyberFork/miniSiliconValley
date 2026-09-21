# Local physics dependency

- Package: @dimforge/rapier3d-compat 0.20.0
- Registry source: https://registry.npmjs.org/@dimforge/rapier3d-compat/-/rapier3d-compat-0.20.0.tgz
- Upstream: https://github.com/dimforge/rapier
- License: Apache-2.0 (RAPIER-LICENSE.txt)
- `rapier.mjs` embeds the upstream WebAssembly payload; no CDN fetch at runtime.
- Three.js and OrbitControls reuse the project's separately licensed existing `../vendor` source; included in the standalone sample bundle.
