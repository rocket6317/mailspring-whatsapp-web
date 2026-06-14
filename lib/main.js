'use strict';

const path = require('path');
const { shell } = require('electron');
const { ComponentRegistry, React, WorkspaceStore } = require('mailspring-exports');

const WHATSAPP_URL = 'https://web.whatsapp.com/';
const WHATSAPP_ORIGIN = new URL(WHATSAPP_URL).origin;
const PARTITION = 'persist:mailspring-whatsapp-web';

let whatsappVisible = false;
let whatsappUnreadCount = 0;
let notificationPermissions = null;
const visibilityListeners = new Set();
const unreadListeners = new Set();

function configureWhatsAppPermissions() {
  const remotePath = path.join(
    AppEnv.getLoadSettings().resourcePath,
    'node_modules',
    '@electron',
    'remote'
  );
  const remote = require(remotePath);
  notificationPermissions = remote.require(path.join(__dirname, 'notifications-main.js'));
  notificationPermissions.activate(PARTITION, WHATSAPP_ORIGIN);
}

function clearWhatsAppPermissions() {
  if (!notificationPermissions) return;

  notificationPermissions.deactivate();
  notificationPermissions = null;
}

function setWhatsAppVisible(visible) {
  whatsappVisible = visible;
  if (visible) setWhatsAppUnreadCount(0);
  visibilityListeners.forEach(listener => listener(visible));
}

function setWhatsAppUnreadCount(count) {
  whatsappUnreadCount = Math.max(0, Number(count) || 0);
  unreadListeners.forEach(listener => listener(whatsappUnreadCount));
}

function toggleWhatsApp() {
  setWhatsAppVisible(!whatsappVisible);
}

function subscribeToVisibility(listener) {
  visibilityListeners.add(listener);
  return () => visibilityListeners.delete(listener);
}

function subscribeToUnreadCount(listener) {
  unreadListeners.add(listener);
  return () => unreadListeners.delete(listener);
}

function unreadCountFromTitle(title) {
  const match = String(title || '').match(/^\((\d+)\)\s/);
  return match ? Number(match[1]) : 0;
}

class WhatsAppPersistentOverlay extends React.Component {
  constructor(props) {
    super(props);
    this.webview = null;
    this.state = {
      loading: true,
      failed: false,
      visible: whatsappVisible,
      left: 0,
      top: 0,
    };
  }

  componentDidMount() {
    this.unsubscribe = subscribeToVisibility(this.onVisibilityChanged);
    window.addEventListener('resize', this.updateBounds);
    this.attachListeners();
    this.updateBounds();
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
    window.removeEventListener('resize', this.updateBounds);
    this.detachListeners();
  }

  onVisibilityChanged = visible => {
    this.setState({ visible }, this.updateBounds);
  };

  updateBounds = () => {
    const sidebar = document.querySelector('.column-RootSidebar');
    const toolbar = document.querySelector('.sheet-toolbar');
    const left = sidebar ? sidebar.getBoundingClientRect().right : 0;
    const top = toolbar ? toolbar.getBoundingClientRect().bottom : 0;

    if (left !== this.state.left || top !== this.state.top) {
      this.setState({ left, top });
    }
  };

  attachListeners() {
    if (!this.webview) return;

    this.webview.addEventListener('did-start-loading', this.onStartLoading);
    this.webview.addEventListener('did-stop-loading', this.onStopLoading);
    this.webview.addEventListener('did-fail-load', this.onFailLoad);
    this.webview.addEventListener('new-window', this.onNewWindow);
    this.webview.addEventListener('will-navigate', this.onWillNavigate);
    this.webview.addEventListener('focus', this.onWebviewFocus);
    this.webview.addEventListener('page-title-updated', this.onPageTitleUpdated);
  }

  detachListeners() {
    if (!this.webview) return;

    this.webview.removeEventListener('did-start-loading', this.onStartLoading);
    this.webview.removeEventListener('did-stop-loading', this.onStopLoading);
    this.webview.removeEventListener('did-fail-load', this.onFailLoad);
    this.webview.removeEventListener('new-window', this.onNewWindow);
    this.webview.removeEventListener('will-navigate', this.onWillNavigate);
    this.webview.removeEventListener('focus', this.onWebviewFocus);
    this.webview.removeEventListener('page-title-updated', this.onPageTitleUpdated);
  }

  onStartLoading = () => this.setState({ loading: true, failed: false });

  onStopLoading = () => {
    this.setState({ loading: false, failed: false });
    this.enableNotifications();
    if (!whatsappVisible) {
      this.webview
        .executeJavaScript('document.title', false)
        .then(title => setWhatsAppUnreadCount(unreadCountFromTitle(title)))
        .catch(() => {});
    }
  };

  onFailLoad = event => {
    if (event.errorCode === -3) return;
    this.setState({ loading: false, failed: true });
  };

  onNewWindow = event => {
    if (/^https?:\/\//i.test(event.url)) shell.openExternal(event.url);
  };

  onWillNavigate = event => {
    if (!event.url.startsWith(WHATSAPP_URL)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(event.url)) shell.openExternal(event.url);
    }
  };

  onWebviewFocus = () => {
    if (!whatsappVisible) setWhatsAppVisible(true);
  };

  onPageTitleUpdated = event => {
    if (!whatsappVisible) setWhatsAppUnreadCount(unreadCountFromTitle(event.title));
  };

  reload = () => {
    if (this.webview) this.webview.reload();
  };

  enableNotifications = () => {
    if (!this.webview) return;

    this.webview
      .executeJavaScript(
        "typeof Notification !== 'undefined' ? Notification.requestPermission() : 'unsupported'",
        false
      )
      .then(permission => console.info(`WhatsApp notification permission: ${permission}`))
      .catch(error => console.warn('Could not enable WhatsApp notifications:', error));
  };

  render() {
    const userAgent = navigator.userAgent
      .replace(/\sElectron\/[^\s]+/g, '')
      .replace(/\sMailspring\/[^\s]+/g, '');

    return React.createElement(
      'div',
      {
        className: `whatsapp-persistent-overlay visible-${this.state.visible}`,
        style: { left: this.state.left, top: this.state.top },
      },
      this.state.loading &&
        React.createElement('div', { className: 'whatsapp-web-status' }, 'Loading WhatsApp Web…'),
      this.state.failed &&
        React.createElement(
          'button',
          { className: 'btn whatsapp-web-retry', onClick: this.reload },
          'Could not load WhatsApp Web. Try again'
        ),
      React.createElement('webview', {
        className: 'whatsapp-webview',
        partition: PARTITION,
        src: WHATSAPP_URL,
        useragent: userAgent,
        allowpopups: 'true',
        ref: element => {
          this.webview = element;
        },
      })
    );
  }
}

WhatsAppPersistentOverlay.displayName = 'WhatsAppPersistentOverlay';
WhatsAppPersistentOverlay.containerRequired = false;

class WhatsAppButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = { active: whatsappVisible, unreadCount: whatsappUnreadCount };
  }

  componentDidMount() {
    this.unsubscribeVisibility = subscribeToVisibility(active => this.setState({ active }));
    this.unsubscribeUnread = subscribeToUnreadCount(unreadCount => this.setState({ unreadCount }));
  }

  componentWillUnmount() {
    if (this.unsubscribeVisibility) this.unsubscribeVisibility();
    if (this.unsubscribeUnread) this.unsubscribeUnread();
  }

  render() {
    const unread = !this.state.active && this.state.unreadCount > 0;
    const unreadLabel = this.state.unreadCount > 99 ? '99+' : String(this.state.unreadCount);
    const title = this.state.active
      ? 'Return to Mail'
      : unread
        ? `Open WhatsApp Web (${this.state.unreadCount} unread)`
        : 'Open WhatsApp Web';

    return React.createElement(
      'button',
      {
        className: `btn btn-toolbar whatsapp-toolbar-button active-${this.state.active} unread-${unread}`,
        title,
        'aria-label': title,
        onClick: toggleWhatsApp,
      },
      React.createElement('span', { className: 'whatsapp-toolbar-icon', 'aria-hidden': 'true' }),
      unread &&
        React.createElement(
          'span',
          { className: 'whatsapp-toolbar-badge', 'aria-hidden': 'true' },
          unreadLabel
        )
    );
  }
}

WhatsAppButton.displayName = 'WhatsAppButton';

function activate() {
  configureWhatsAppPermissions();
  ComponentRegistry.register(WhatsAppPersistentOverlay, {
    location: WorkspaceStore.Sheet.Global.Header,
  });
  ComponentRegistry.register(WhatsAppButton, {
    location: WorkspaceStore.Location.RootSidebar.Toolbar,
  });
}

function deactivate() {
  setWhatsAppVisible(false);
  clearWhatsAppPermissions();
  ComponentRegistry.unregister(WhatsAppPersistentOverlay);
  ComponentRegistry.unregister(WhatsAppButton);
}

module.exports = { activate, deactivate };
