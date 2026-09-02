const test = require('node:test');
const assert = require('node:assert');

test('GiveWay feature branch CI test', () => {
  const appName = 'GiveWay';

  assert.strictEqual(appName, 'GiveWay');
});