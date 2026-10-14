# kindle-image-hub

> 把任意图片转换成 Kindle 规格，并在局域网里管理 Kindle 上的图片。

[English](README.md) | **简体中文**

一个产品、两个前端，共用同一套 API：

1. **转换器** —— 纯静态网页，把任意图片转成你所选 Kindle 机型的准确格式与
   尺寸（覆盖全部已知机型，横竖版均可）。全部转换在浏览器本地完成，
   不上传任何服务器。可下载结果，也可在 `picd` 运行时**直传**到 Kindle。
2. **picd** —— 越狱 Kindle 上的单文件常驻服务，在局域网提供网页界面：
   浏览、上传、下载、删除 `/mnt/us/screensaver` 与 `/mnt/us/images`
   里的图片。

## 功能

- 机型表：Kindle 2–11、Paperwhite 1–6、Voyage、Oasis 1–3、Colorsoft、
  Scribe，外加自由自定义尺寸
- 适配方式：填满裁剪（屏保）/ 完整适配（白边）
- 输出格式：
  - **真 8 位灰度 PNG（color type 0）** —— 正是 Kindle 屏保要求的规格，
    由自带编码器生成（浏览器 Canvas 做不到这一点）
  - e-ink 优化：16 级灰度 + Bayer 抖动
  - 彩色 PNG / JPEG（质量可调）
- 屏保命名（`bg_ss00.png` 起）或保留原名
- 多文件批量转换，逐张预览、下载、**直传**
- 界面支持**英文（默认）**与简体中文 —— 页头切换，选择会记住
- `picd` 网页界面：缩略图网格、多选上传、下载、删除
- API 可选访问码（`-token`）

## 转换器（独立使用）

任何现代浏览器直接打开 `web/convert/index.html` 即可 —— `file://` 或任意
静态托管都行。选机型、拖图片、下载。

## picd —— 在 Kindle 上运行

```sh
./build.sh          # 产出 dist/picd-armhf、dist/picd-armv6（+ 本机版本）
```

1. USB 连接 Kindle：
   ```
   dist/picd-armhf   （软浮点老设备用 picd-armv6）
       → /mnt/us/documents/image-hub/picd-armhf
   scriptlet/image_hub.sh
       → /mnt/us/documents/image_hub.sh
   ```
2. 弹出 USB，在图书馆点开 **Image Hub**。
   屏幕显示 `Open in browser: http://<ip>:8642`。
3. 同一 Wi-Fi 下任意设备打开 `http://<kindle-ip>:8642` 即是管理界面；
   同一服务器上的 `/convert/` 就是转换器，直传目标为 `screensaver/`。

再次点击 **Image Hub** 可停止服务。日志在 `/tmp/picd.log`。

### 命令行参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `-addr` | `:8642` | 监听地址 |
| `-root` | `/mnt/us` | `screensaver/`、`images/` 所在的根目录 |
| `-token` | *（空）* | 设置后所有 `/api/*` 需带 `?token=` 或 `X-Picd-Token` |

`-root` 也让本地开发很容易：

```sh
mkdir -p /tmp/kenv/screensaver /tmp/kenv/images
./dist/picd-darwin-arm64 -root /tmp/kenv    # 或你的本机构建
# 管理界面：http://127.0.0.1:8642/   转换器：http://127.0.0.1:8642/convert/
```

### 安全

`picd` 默认监听所有网卡且无鉴权 —— 家庭局域网够用，**不要**暴露到公网。
网络不完全可控时请加 `-token`，也绝不要做端口转发。

## API

| 方法与路径 | 用途 |
| --- | --- |
| `GET /api/config` | 名称、版本、允许的目录 |
| `GET /api/images?dir=screensaver` | 列出文件（还支持 `images`） |
| `GET /api/download?dir=…&name=…` | 下载 / 内嵌预览 |
| `POST /api/upload?dir=…` | multipart 字段 `file` |
| `DELETE /api/images?dir=…&name=…` | 删除文件 |

目录名白名单校验；文件名严格净化（防路径穿越、忽略隐藏文件）。

## 说明

- 标注 *待核对* 的机型（Colorsoft）按 7 寸面板推定，拿不准时用自定义尺寸。
- 横版目标用 竖版/横版 切换。
- 设备上的 `bg_ss*` 轮播可搭配
  [kindle-slideshow](https://github.com/naecoo/kindle-slideshow) 使用。

## License

[MIT](LICENSE)
