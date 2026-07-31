'use strict';

const assert = require('assert');
const { createTrayBehavior } = require('../lib/tray-behavior');

function makeHarness(platform = 'darwin') {
  const listeners = new Map();
  const contextMenus = [];
  const popupMenus = [];
  const emitted = [];
  let showCount = 0;

  const menu = { id: 'menu' };
  const tray = {
    isDestroyed: () => false,
    setContextMenu: value => contextMenus.push(value),
    popUpContextMenu: value => popupMenus.push(value),
    addListener: (event, listener) => listeners.set(event, listener),
    removeListener: (event, listener) => {
      if (listeners.get(event) === listener) listeners.delete(event);
    },
  };

  const Menu = {
    buildFromTemplate(template) {
      menu.template = template;
      return menu;
    },
  };

  const behavior = createTrayBehavior({
    platform,
    tray,
    Menu,
    application: { emit: event => emitted.push(event) },
    showWindow: () => {
      showCount += 1;
    },
  });

  return {
    behavior,
    contextMenus,
    emitted,
    listeners,
    menu,
    popupMenus,
    showCount: () => showCount,
  };
}

{
  const harness = makeHarness();
  assert(harness.behavior);
  assert.deepStrictEqual(harness.contextMenus, [null]);

  harness.listeners.get('click')();
  assert.strictEqual(harness.showCount(), 1);

  harness.listeners.get('right-click')();
  assert.deepStrictEqual(harness.popupMenus, [harness.menu]);

  harness.menu.template[1].click();
  assert.deepStrictEqual(harness.emitted, ['application:new-message']);

  harness.behavior.deactivate();
  assert.strictEqual(harness.listeners.size, 0);
  assert.deepStrictEqual(harness.contextMenus, [null, harness.menu]);
}

{
  const harness = makeHarness('linux');
  assert.strictEqual(harness.behavior, null);
  assert.strictEqual(harness.listeners.size, 0);
  assert.deepStrictEqual(harness.contextMenus, []);
}

console.log('tray-behavior tests passed');
