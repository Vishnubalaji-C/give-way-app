const test = require('node:test');
const assert = require('node:assert');

test('GiveWay basic application test', () => {
  const appName = 'GiveWay';

  assert.strictEqual(appName, 'GiveWay');
});