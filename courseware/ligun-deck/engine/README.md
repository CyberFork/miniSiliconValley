# P2 r6 engine compatibility

`lesson-tools.js` is the exact helper shipped with P2 r6 (2026.09.22).
P1's Three.js scene reconciliation evolves separately; P2 has no Three.js
scene hosts and must retain its published package digest. The shared builder
uses this explicit P2 helper instead of silently changing the released P2 bytes.
Update it only with an intentional P2 revision and its acceptance tests.
