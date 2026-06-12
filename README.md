# WhatsApp Web for Mailspring

An unofficial Mailspring plugin that opens WhatsApp Web inside the Mailspring
window.

The plugin adds a small toolbar icon beside Compose. WhatsApp remains mounted
while hidden, so switching between Mail and WhatsApp preserves the current
conversation instead of reloading the page.

## Features

- Persistent WhatsApp Web view inside Mailspring
- Grey inactive toolbar icon and green active state
- Login survives Mailspring restarts
- External links open in the system browser
- No bundled credentials, analytics, or remote services

## Installation

1. Download or clone this repository.
2. Open Mailspring.
3. Choose **Developer > Install a Package Manually...**
4. Select the `mailspring-whatsapp-web` folder.
5. Fully quit and reopen Mailspring.
6. Select the WhatsApp icon beside Compose and log in using the QR code.

## How Persistence Works

The embedded webview uses Electron's local persistent partition:

```text
persist:mailspring-whatsapp-web
```

Cookies, IndexedDB, and login state are stored locally by Mailspring under its
application data directory. They are not included in this repository or sent
anywhere by the plugin.

## Limitations

- WhatsApp may change its browser checks or block embedded Electron sessions.
- Calling, camera, microphone, notifications, and downloads may require
  additional permission handling.
- Mailspring or Electron updates may require plugin changes.
- The plugin embeds the full WhatsApp Web service; normal WhatsApp privacy and
  security terms still apply.

## Privacy and Security

The plugin loads only `https://web.whatsapp.com/` inside the embedded webview.
Navigation to other HTTP or HTTPS URLs is redirected to the system browser.

Review `lib/main.js` before installation if you want to verify the behavior.

## Disclaimer

WhatsApp is a trademark of WhatsApp LLC. This project is unofficial and is not
affiliated with or endorsed by WhatsApp, Meta, or Mailspring.

## License

MIT. See [LICENSE](LICENSE).
