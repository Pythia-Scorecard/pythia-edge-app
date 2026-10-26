'use strict';
const minimum = { 22: [23, 4], 24: [22, 1] };
function isSupported(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;
  const [, major, minor, patch] = match.map(Number);
  const floor = minimum[major];
  return !!floor && (minor > floor[0] || (minor === floor[0] && patch >= floor[1]));
}
function assertSupported(version = process.versions.node) {
  if (!isSupported(version)) {
    throw new Error('Node ' + version + ' is not approved. Use Node 22.23.4+ (22.x) or 24.22.1+ (24.x). See docs/node-security-2026-10.md.');
  }
}
if (require.main === module) {
  assertSupported();
  console.log('Runtime check passed: ' + process.version + ' ' + process.platform + '/' + process.arch);
}
module.exports = { isSupported, assertSupported };
