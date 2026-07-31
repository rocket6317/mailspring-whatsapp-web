'use strict';

function createTrayBehavior({ platform, tray, Menu, application, showWindow }) {
  if (platform !== 'darwin' || !tray || tray.isDestroyed()) return null;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Inbox',
      click: () => application.emit('application:show-main-window'),
    },
    {
      label: 'New Message',
      click: () => application.emit('application:new-message'),
    },
    {
      label: 'Preferences',
      click: () => application.emit('application:open-preferences'),
    },
    { type: 'separator' },
    {
      label: 'Quit Mailspring',
      click: () => application.emit('application:quit'),
    },
  ]);

  const onClick = () => showWindow();
  const onRightClick = () => tray.popUpContextMenu(contextMenu);

  tray.setContextMenu(null);
  tray.addListener('click', onClick);
  tray.addListener('right-click', onRightClick);

  return {
    deactivate() {
      if (tray.isDestroyed()) return;
      tray.removeListener('click', onClick);
      tray.removeListener('right-click', onRightClick);
      tray.setContextMenu(contextMenu);
    },
  };
}

module.exports = { createTrayBehavior };
