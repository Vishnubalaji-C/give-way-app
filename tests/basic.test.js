const test = require('node:test');
const assert = require('node:assert');

test('GiveWay CI CD pipeline test', () => {
  const appName = 'GiveWay';

  assert.strictEqual(appName, 'GiveWay');
});