/* True 8-bit grayscale PNG encoder (color type 0, bit depth 8) —
   exactly what Kindle screensavers want. Canvas can only emit RGBA PNGs,
   so we build the file ourselves.

   IDAT zlib compression uses CompressionStream("deflate") when available,
   otherwise falls back to stored (uncompressed) deflate blocks.

   encodeGrayPNG(width, height, gray) -> Promise<Blob>
     gray: Uint8Array of length width*height, row-major, 0..255
*/

(function () {
    "use strict";

    var CRC_TABLE = (function () {
        var table = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) {
                c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[n] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        var c = 0xffffffff;
        for (var i = 0; i < bytes.length; i++) {
            c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
        }
        return (c ^ 0xffffffff) >>> 0;
    }

    function adler32(bytes) {
        var a = 1, b = 0;
        for (var i = 0; i < bytes.length; i++) {
            a = (a + bytes[i]) % 65521;
            b = (b + a) % 65521;
        }
        return (((b << 16) | a) >>> 0);
    }

    function u32be(v) {
        return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
    }

    function chunk(type, data) {
        var typeBytes = [];
        for (var i = 0; i < 4; i++) typeBytes.push(type.charCodeAt(i));
        var len = u32be(data.length);
        var body = new Uint8Array(typeBytes.length + data.length);
        body.set(typeBytes, 0);
        body.set(data, typeBytes.length);

        var crcIn = new Uint8Array(body.length);
        crcIn.set(body, 0);
        var out = new Uint8Array(4 + body.length + 4);
        out.set(u32be(data.length), 0);
        out.set(body, 4);
        var crc = crc32(crcIn);
        out.set(u32be(crc), 4 + body.length);
        return out;
    }

    function concat(chunks) {
        var total = 0;
        for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
        var out = new Uint8Array(total);
        var off = 0;
        for (var j = 0; j < chunks.length; j++) {
            out.set(chunks[j], off);
            off += chunks[j].length;
        }
        return out;
    }

    // Raw deflate as stored blocks + zlib wrapper (adler32). No deps.
    function zlibStored(raw) {
        var MAX = 65535;
        var blocks = [];
        if (raw.length === 0) {
            blocks.push(new Uint8Array([0x01, 0x00, 0x00, 0xff, 0xff]));
        } else {
            var offset = 0;
            while (offset < raw.length) {
                var len = Math.min(MAX, raw.length - offset);
                var final = (offset + len >= raw.length) ? 1 : 0;
                var head = new Uint8Array(5);
                head[0] = final;               // BFINAL + BTYPE=00
                head[1] = len & 0xff;
                head[2] = (len >>> 8) & 0xff;
                head[3] = (~len) & 0xff;
                head[4] = ((~len) >>> 8) & 0xff;
                blocks.push(head);
                blocks.push(raw.subarray(offset, offset + len));
                offset += len;
            }
        }
        var body = concat(blocks);
        var out = new Uint8Array(2 + body.length + 4);
        out[0] = 0x78;  // CM=8, CINFO=7
        out[1] = 0x01;  // FCHECK so that 0x7801 % 31 == 0
        out.set(body, 2);
        var ad = adler32(raw);
        out[2 + body.length + 0] = (ad >>> 24) & 0xff;
        out[2 + body.length + 1] = (ad >>> 16) & 0xff;
        out[2 + body.length + 1 + 1] = (ad >>> 8) & 0xff;
        out[2 + body.length + 3] = ad & 0xff;
        return out;
    }

    function zlibCompress(raw) {
        if (typeof CompressionStream === "undefined") {
            return Promise.resolve(zlibStored(raw));
        }
        var stream = new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate"));
        return new Response(stream).arrayBuffer().then(function (buf) {
            return new Uint8Array(buf);
        });
    }

    window.encodeGrayPNG = function (width, height, gray) {
        if (gray.length !== width * height) {
            return Promise.reject(new Error("gray buffer size mismatch"));
        }

        // Scanlines: filter byte 0 + row bytes
        var stride = width; // 1 byte per pixel
        var raw = new Uint8Array(height * (1 + stride));
        for (var y = 0; y < height; y++) {
            var dst = y * (1 + stride);
            raw[dst] = 0; // filter: none
            raw.set(gray.subarray(y * stride, (y + 1) * stride), dst + 1);
        }

        var ihdr = new Uint8Array(13);
        ihdr.set(u32be(width), 0);
        ihdr.set(u32be(height), 4);
        ihdr[8] = 8;   // bit depth
        ihdr[9] = 0;   // color type: grayscale
        ihdr[10] = 0;  // compression
        ihdr[11] = 0;  // filter method
        ihdr[12] = 0;  // interlace

        return zlibCompress(raw).then(function (idat) {
            var sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
            var png = concat([
                sig,
                chunk("IHDR", ihdr),
                chunk("IDAT", idat),
                chunk("IEND", new Uint8Array(0))
            ]);
            return new Blob([png], { type: "image/png" });
        });
    };

    // Exposed for tests / older browsers toggle: ?rawpng=1 forces stored blocks
    window.encodeGrayPNGStored = function (width, height, gray) {
        var stride = width;
        var raw = new Uint8Array(height * (1 + stride));
        for (var y = 0; y < height; y++) {
            var dst = y * (1 + stride);
            raw[dst] = 0;
            raw.set(gray.subarray(y * stride, (y + 1) * stride), dst + 1);
        }
        var ihdr = new Uint8Array(13);
        ihdr.set(u32be(width), 0);
        ihdr.set(u32be(height), 4);
        ihdr[8] = 8;
        ihdr[9] = 0;
        var sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        var png = concat([
            sig,
            chunk("IHDR", ihdr),
            chunk("IDAT", zlibStored(raw)),
            chunk("IEND", new Uint8Array(0))
        ]);
        return Promise.resolve(new Blob([png], { type: "image/png" }));
    };
})();
