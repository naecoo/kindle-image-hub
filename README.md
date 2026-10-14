# kindle-image-hub

> Convert any image for your Kindle — and manage the images on it, over LAN.

**English** | [简体中文](README.zh-CN.md)

One product, two front-ends that speak the same API:

1. **Converter** — a static web page that converts any image to the exact
   format and size of the Kindle you pick (all known models, portrait or
   landscape). Runs entirely in your browser: nothing is uploaded anywhere.
   Download the result, or push it straight to the Kindle when `picd` is
   running.
2. **picd** — a single static binary for jailbroken Kindles that serves a web
   UI on your LAN: browse, upload, download and delete images in
   `/mnt/us/screensaver` and `/mnt/us/images`.

## Features

- Device profile table: Kindle 2–11, Paperwhite 1–6, Voyage, Oasis 1–3,
  Colorsoft, Scribe, plus free custom sizes
- Fit modes: cover-crop (screensaver) or contain (white padding)
- Outputs:
  - **Grayscale PNG, true 8-bit (color type 0)** — exactly what Kindle
    screensavers require, encoded by our own PNG writer (canvas cannot do this)
  - optional e-ink tuning: 16-level grayscale + Bayer dithering
  - color PNG / JPEG with quality slider
- Screensaver naming (`bg_ss00.png`, `bg_ss01.png`, …) or keep the source name
- Multi-file conversion with per-file preview, download, and **direct transfer**
- UI in **English (default)** and 简体中文 — switch in the header, choice persists
- `picd` web UI: grid browse with thumbnails, multi-upload, download, delete
- Optional access token for the API (`-token`)

## Converter (standalone)

Open `web/convert/index.html` in any modern browser — it works from `file://`
or any static host. Pick a profile, drop images, download.

## picd — run on a Kindle

```sh
./build.sh          # builds dist/picd-armhf, dist/picd-armv6 (+ host binary)
```

1. Connect the Kindle over USB:
   ```
   dist/picd-armhf  (or picd-armv6 on soft-float devices)
       → /mnt/us/documents/image-hub/picd-armhf
   scriptlet/image_hub.sh
       → /mnt/us/documents/image_hub.sh
   ```
2. Eject USB, open **Image Hub** from the Kindle library.
   The screen shows `Open in browser: http://<ip>:8642`.
3. On any device in the same Wi-Fi, open `http://<kindle-ip>:8642` —
   that is the manage UI. `/convert/` on the same server is the converter,
   ready for direct transfer into `screensaver/`.

Tap **Image Hub** again to stop the server. Logs: `/tmp/picd.log`.

### Flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `-addr` | `:8642` | listen address |
| `-root` | `/mnt/us` | base folder for `screensaver/` and `images/` |
| `-token` | *(empty)* | if set, every `/api/*` call must pass `?token=` or `X-Picd-Token` |

`-root` also makes local development easy:

```sh
mkdir -p /tmp/kenv/screensaver /tmp/kenv/images
./dist/picd-darwin-arm64 -root /tmp/kenv    # or your host build
# manage UI: http://127.0.0.1:8642/   converter: http://127.0.0.1:8642/convert/
```

### Security

`picd` binds all interfaces with no auth by default — fine for a home LAN,
**not** for exposure to the internet. Use `-token` if your network is not
fully trusted, and never port-forward it.

## API

| Method & path | Purpose |
| --- | --- |
| `GET /api/config` | name, version, allowed dirs |
| `GET /api/images?dir=screensaver` | list files (`images` also allowed) |
| `GET /api/download?dir=…&name=…` | download / inline preview |
| `POST /api/upload?dir=…` | multipart field `file` |
| `DELETE /api/images?dir=…&name=…` | delete a file |

Directory names are whitelisted; file names are sanitized (no path
traversal, no dotfiles).

## Notes

- Profiles marked *待核对* (unverified) — Colorsoft row is assumed to match the
  7″ panel; the custom-size field always works as a fallback.
- Landscape targets are available via the 竖版/横版 toggle.
- On-device `bg_ss*` rotation pairs naturally with
  [kindle-slideshow](https://github.com/naecoo/kindle-slideshow).

## License

[MIT](LICENSE)
