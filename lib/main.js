'use strict';

const { shell } = require('electron');
const { ComponentRegistry, React, WorkspaceStore } = require('mailspring-exports');

const WHATSAPP_URL = 'https://web.whatsapp.com/';
const PARTITION = 'persist:mailspring-whatsapp-web';

let whatsappVisible = false;
const visibilityListeners = new Set();

function setWhatsAppVisible(visible) {
  whatsappVisible = visible;
  visibilityListeners.forEach(listener => listener(visible));
}

function toggleWhatsApp() {
  setWhatsAppVisible(!whatsappVisible);
}

function subscribeToVisibility(listener) {
  visibilityListeners.add(listener);
  return () => visibilityListeners.delete(listener);
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
  }

  detachListeners() {
    if (!this.webview) return;

    this.webview.removeEventListener('did-start-loading', this.onStartLoading);
    this.webview.removeEventListener('did-stop-loading', this.onStopLoading);
    this.webview.removeEventListener('did-fail-load', this.onFailLoad);
    this.webview.removeEventListener('new-window', this.onNewWindow);
    this.webview.removeEventListener('will-navigate', this.onWillNavigate);
  }

  onStartLoading = () => this.setState({ loading: true, failed: false });

  onStopLoading = () => this.setState({ loading: false, failed: false });

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

  reload = () => {
    if (this.webview) this.webview.reload();
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
    this.state = { active: whatsappVisible };
  }

  componentDidMount() {
    this.unsubscribe = subscribeToVisibility(active => this.setState({ active }));
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
  }

  render() {
    return React.createElement(
      'button',
      {
        className: `btn btn-toolbar whatsapp-toolbar-button active-${this.state.active}`,
        title: this.state.active ? 'Return to Mail' : 'Open WhatsApp Web',
        'aria-label': this.state.active ? 'Return to Mail' : 'Open WhatsApp Web',
        onClick: toggleWhatsApp,
      },
      React.createElement('span', { className: 'whatsapp-toolbar-icon', 'aria-hidden': 'true' })
    );
  }
}

WhatsAppButton.displayName = 'WhatsAppButton';

function activate() {
  ComponentRegistry.register(WhatsAppPersistentOverlay, {
    location: WorkspaceStore.Sheet.Global.Header,
  });
  ComponentRegistry.register(WhatsAppButton, {
    location: WorkspaceStore.Location.RootSidebar.Toolbar,
  });
}

function deactivate() {
  setWhatsAppVisible(false);
  ComponentRegistry.unregister(WhatsAppPersistentOverlay);
  ComponentRegistry.unregister(WhatsAppButton);
}

module.exports = { activate, deactivate };
