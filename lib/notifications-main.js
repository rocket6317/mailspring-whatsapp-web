'use strict';

const { session } = require('electron');

let whatsappSession = null;

function isAllowedOrigin(url, allowedOrigin) {
  try {
    return new URL(url).origin === allowedOrigin;
  } catch {
    return false;
  }
}

function activate(partition, allowedOrigin) {
  whatsappSession = session.fromPartition(partition);

  whatsappSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const origin = requestingOrigin || details?.requestingUrl || webContents?.getURL();
    return permission === 'notifications' && isAllowedOrigin(origin, allowedOrigin);
  });

  whatsappSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details?.requestingUrl || webContents?.getURL();
    callback(permission === 'notifications' && isAllowedOrigin(origin, allowedOrigin));
  });
}

function deactivate() {
  if (!whatsappSession) return;

  whatsappSession.setPermissionCheckHandler(null);
  whatsappSession.setPermissionRequestHandler(null);
  whatsappSession = null;
}

module.exports = { activate, deactivate };
