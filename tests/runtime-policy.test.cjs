'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isSupported, assertSupported } = require('../scripts/check-node.cjs');
test('rejects obsolete, unpatched, prerelease and untested major runtimes', () => {
  for (const version of ['14.21.3','16.20.2','18.20.8','20.20.0','22.23.3','24.22.0','26.12.1','24.22.1-rc.1','invalid']) {
    assert.equal(isSupported(version), false, version);
    assert.throws(() => assertSupported(version), /not approved/);
  }
});
test('accepts patched supported lines without forcing a major upgrade', () => {
  for (const version of ['22.23.4','22.24.0','24.22.1','24.23.0']) {
    assert.equal(isSupported(version), true, version);
    assert.doesNotThrow(() => assertSupported(version));
  }
});
