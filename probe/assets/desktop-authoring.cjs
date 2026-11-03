var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// migration/desktop-extensions/zip-reader.cjs
var require_zip_reader = __commonJS({
  "migration/desktop-extensions/zip-reader.cjs"(exports2) {
    var fs = require("node:fs");
    var zlib = require("node:zlib");
    var { Transform, Readable } = require("node:stream");
    var crcTable = Array.from({ length: 256 }, (_, n) => {
      for (let i = 0; i < 8; i++) n = n & 1 ? 3988292384 ^ n >>> 1 : n >>> 1;
      return n >>> 0;
    });
    exports2.Open = { async file(path) {
      const data = await fs.promises.readFile(path);
      if (data.length > 104857600) throw Error("\u63D2\u4EF6\u538B\u7F29\u5305\u8D85\u8FC7100MB");
      let end = -1;
      for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) if (data.readUInt32LE(i) === 101010256 && i + 22 + data.readUInt16LE(i + 20) === data.length) {
        end = i;
        break;
      }
      if (end < 0) throw Error("ZIP\u76EE\u5F55\u4E0D\u5B8C\u6574");
      if (data.readUInt16LE(end + 4) || data.readUInt16LE(end + 6)) throw Error("\u4E0D\u652F\u6301\u5206\u5377ZIP");
      const count = data.readUInt16LE(end + 10), size = data.readUInt32LE(end + 12), offset = data.readUInt32LE(end + 16);
      if (count === 65535 || size === 4294967295 || offset === 4294967295) throw Error("\u4E0D\u652F\u6301ZIP64\uFF0C\u8BF7\u4F7F\u7528\u666E\u901AZIP");
      if (count > 1e4 || offset + size > end) throw Error("ZIP\u76EE\u5F55\u8303\u56F4\u65E0\u6548");
      const files = [];
      let at = offset;
      for (let i = 0; i < count; i++) {
        if (at + 46 > offset + size || data.readUInt32LE(at) !== 33639248) throw Error("ZIP\u76EE\u5F55\u635F\u574F");
        const flag = data.readUInt16LE(at + 8), method = data.readUInt16LE(at + 10), crc = data.readUInt32LE(at + 16), compressed = data.readUInt32LE(at + 20), expanded = data.readUInt32LE(at + 24), nameLength = data.readUInt16LE(at + 28), extra = data.readUInt16LE(at + 30), comment = data.readUInt16LE(at + 32), attrs = data.readUInt32LE(at + 38), local = data.readUInt32LE(at + 42), next2 = at + 46 + nameLength + extra + comment;
        if (next2 > offset + size || flag & 1 || ![0, 8].includes(method)) throw Error("ZIP\u538B\u7F29\u683C\u5F0F\u4E0D\u652F\u6301\u6216\u6587\u4EF6\u5DF2\u52A0\u5BC6");
        const name = data.subarray(at + 46, at + 46 + nameLength).toString("utf8");
        if (local + 30 > offset || data.readUInt32LE(local) !== 67324752) throw Error("ZIP\u6587\u4EF6\u5934\u635F\u574F");
        const begin = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
        if (begin + compressed > offset) throw Error("ZIP\u6570\u636E\u8303\u56F4\u65E0\u6548");
        files.push({ path: name, type: name.endsWith("/") ? "Directory" : "File", uncompressedSize: expanded, externalFileAttributes: attrs, stream() {
          let checksum = 4294967295, length = 0;
          const source = compressed ? Readable.from([data.subarray(begin, begin + compressed)]) : Readable.from([]);
          const decoded = method === 8 ? source.pipe(zlib.createInflateRaw()) : source;
          const verify = new Transform({ transform(chunk, _enc, cb) {
            length += chunk.length;
            if (length > expanded) return cb(Error("ZIP\u6587\u4EF6\u5927\u5C0F\u4E0E\u58F0\u660E\u4E0D\u4E00\u81F4"));
            for (const b of chunk) checksum = crcTable[(checksum ^ b) & 255] ^ checksum >>> 8;
            cb(null, chunk);
          }, flush(cb) {
            cb(length !== expanded || (checksum ^ 4294967295) >>> 0 !== crc ? Error("ZIP\u6587\u4EF6\u6821\u9A8C\u5931\u8D25") : null);
          } });
          decoded.on("error", (e) => verify.destroy(e));
          return decoded.pipe(verify);
        } });
        at = next2;
      }
      if (at !== offset + size) throw Error("ZIP\u76EE\u5F55\u5927\u5C0F\u4E0D\u4E00\u81F4");
      return { files };
    } };
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/events-universal/default.js
var require_default = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/events-universal/default.js"(exports2, module2) {
    module2.exports = require("events");
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/fast-fifo/fixed-size.js
var require_fixed_size = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/fast-fifo/fixed-size.js"(exports2, module2) {
    module2.exports = class FixedFIFO {
      constructor(hwm) {
        if (!(hwm > 0) || (hwm - 1 & hwm) !== 0) throw new Error("Max size for a FixedFIFO should be a power of two");
        this.buffer = new Array(hwm);
        this.mask = hwm - 1;
        this.top = 0;
        this.btm = 0;
        this.next = null;
      }
      clear() {
        this.top = this.btm = 0;
        this.next = null;
        this.buffer.fill(void 0);
      }
      push(data) {
        if (this.buffer[this.top] !== void 0) return false;
        this.buffer[this.top] = data;
        this.top = this.top + 1 & this.mask;
        return true;
      }
      shift() {
        const last = this.buffer[this.btm];
        if (last === void 0) return void 0;
        this.buffer[this.btm] = void 0;
        this.btm = this.btm + 1 & this.mask;
        return last;
      }
      peek() {
        return this.buffer[this.btm];
      }
      isEmpty() {
        return this.buffer[this.btm] === void 0;
      }
    };
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/fast-fifo/index.js
var require_fast_fifo = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/fast-fifo/index.js"(exports2, module2) {
    var FixedFIFO = require_fixed_size();
    module2.exports = class FastFIFO {
      constructor(hwm) {
        this.hwm = hwm || 16;
        this.head = new FixedFIFO(this.hwm);
        this.tail = this.head;
        this.length = 0;
      }
      clear() {
        this.head = this.tail;
        this.head.clear();
        this.length = 0;
      }
      push(val) {
        this.length++;
        if (!this.head.push(val)) {
          const prev = this.head;
          this.head = prev.next = new FixedFIFO(2 * this.head.buffer.length);
          this.head.push(val);
        }
      }
      shift() {
        if (this.length !== 0) this.length--;
        const val = this.tail.shift();
        if (val === void 0 && this.tail.next) {
          const next2 = this.tail.next;
          this.tail.next = null;
          this.tail = next2;
          return this.tail.shift();
        }
        return val;
      }
      peek() {
        const val = this.tail.peek();
        if (val === void 0 && this.tail.next) return this.tail.next.peek();
        return val;
      }
      isEmpty() {
        return this.length === 0;
      }
    };
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/b4a/index.js
var require_b4a = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/b4a/index.js"(exports2, module2) {
    function isBuffer(value) {
      return Buffer.isBuffer(value) || value instanceof Uint8Array;
    }
    function isEncoding(encoding) {
      return Buffer.isEncoding(encoding);
    }
    function alloc(size, fill2, encoding) {
      return Buffer.alloc(size, fill2, encoding);
    }
    function allocUnsafe(size) {
      return Buffer.allocUnsafe(size);
    }
    function allocUnsafeSlow(size) {
      return Buffer.allocUnsafeSlow(size);
    }
    function byteLength(string, encoding) {
      return Buffer.byteLength(string, encoding);
    }
    function compare(a, b) {
      return Buffer.compare(a, b);
    }
    function concat(buffers, totalLength) {
      return Buffer.concat(buffers, totalLength);
    }
    function copy(source, target, targetStart, start, end) {
      return toBuffer(source).copy(target, targetStart, start, end);
    }
    function equals(a, b) {
      return toBuffer(a).equals(b);
    }
    function fill(buffer, value, offset, end, encoding) {
      return toBuffer(buffer).fill(value, offset, end, encoding);
    }
    function from(value, encodingOrOffset, length) {
      return Buffer.from(value, encodingOrOffset, length);
    }
    function includes(buffer, value, byteOffset, encoding) {
      return toBuffer(buffer).includes(value, byteOffset, encoding);
    }
    function indexOf(buffer, value, byfeOffset, encoding) {
      return toBuffer(buffer).indexOf(value, byfeOffset, encoding);
    }
    function lastIndexOf(buffer, value, byteOffset, encoding) {
      return toBuffer(buffer).lastIndexOf(value, byteOffset, encoding);
    }
    function swap16(buffer) {
      return toBuffer(buffer).swap16();
    }
    function swap32(buffer) {
      return toBuffer(buffer).swap32();
    }
    function swap64(buffer) {
      return toBuffer(buffer).swap64();
    }
    function toBuffer(buffer) {
      if (Buffer.isBuffer(buffer)) return buffer;
      return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    function toString(buffer, encoding, start, end) {
      return toBuffer(buffer).toString(encoding, start, end);
    }
    function toHex(buffer, start, end) {
      return toBuffer(buffer).toString("hex", start, end);
    }
    function write(buffer, string, offset, length, encoding) {
      return toBuffer(buffer).write(string, offset, length, encoding);
    }
    function readDoubleBE(buffer, offset) {
      return toBuffer(buffer).readDoubleBE(offset);
    }
    function readDoubleLE(buffer, offset) {
      return toBuffer(buffer).readDoubleLE(offset);
    }
    function readFloatBE(buffer, offset) {
      return toBuffer(buffer).readFloatBE(offset);
    }
    function readFloatLE(buffer, offset) {
      return toBuffer(buffer).readFloatLE(offset);
    }
    function readInt32BE(buffer, offset) {
      return toBuffer(buffer).readInt32BE(offset);
    }
    function readInt32LE(buffer, offset) {
      return toBuffer(buffer).readInt32LE(offset);
    }
    function readUInt32BE(buffer, offset) {
      return toBuffer(buffer).readUInt32BE(offset);
    }
    function readUInt32LE(buffer, offset) {
      return toBuffer(buffer).readUInt32LE(offset);
    }
    function writeDoubleBE(buffer, value, offset) {
      return toBuffer(buffer).writeDoubleBE(value, offset);
    }
    function writeDoubleLE(buffer, value, offset) {
      return toBuffer(buffer).writeDoubleLE(value, offset);
    }
    function writeFloatBE(buffer, value, offset) {
      return toBuffer(buffer).writeFloatBE(value, offset);
    }
    function writeFloatLE(buffer, value, offset) {
      return toBuffer(buffer).writeFloatLE(value, offset);
    }
    function writeInt32BE(buffer, value, offset) {
      return toBuffer(buffer).writeInt32BE(value, offset);
    }
    function writeInt32LE(buffer, value, offset) {
      return toBuffer(buffer).writeInt32LE(value, offset);
    }
    function writeUInt32BE(buffer, value, offset) {
      return toBuffer(buffer).writeUInt32BE(value, offset);
    }
    function writeUInt32LE(buffer, value, offset) {
      return toBuffer(buffer).writeUInt32LE(value, offset);
    }
    module2.exports = {
      isBuffer,
      isEncoding,
      alloc,
      allocUnsafe,
      allocUnsafeSlow,
      byteLength,
      compare,
      concat,
      copy,
      equals,
      fill,
      from,
      includes,
      indexOf,
      lastIndexOf,
      swap16,
      swap32,
      swap64,
      toBuffer,
      toString,
      toHex,
      write,
      readDoubleBE,
      readDoubleLE,
      readFloatBE,
      readFloatLE,
      readInt32BE,
      readInt32LE,
      readUInt32BE,
      readUInt32LE,
      writeDoubleBE,
      writeDoubleLE,
      writeFloatBE,
      writeFloatLE,
      writeInt32BE,
      writeInt32LE,
      writeUInt32BE,
      writeUInt32LE
    };
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/text-decoder/lib/pass-through-decoder.js
var require_pass_through_decoder = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/text-decoder/lib/pass-through-decoder.js"(exports2, module2) {
    var b4a = require_b4a();
    module2.exports = class PassThroughDecoder {
      constructor(encoding) {
        this.encoding = encoding;
      }
      get remaining() {
        return 0;
      }
      decode(data) {
        return b4a.toString(data, this.encoding);
      }
      flush() {
        return "";
      }
    };
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/text-decoder/lib/utf8-decoder.js
var require_utf8_decoder = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/text-decoder/lib/utf8-decoder.js"(exports2, module2) {
    var b4a = require_b4a();
    module2.exports = class UTF8Decoder {
      constructor() {
        this._reset();
      }
      get remaining() {
        return this.bytesSeen;
      }
      decode(data) {
        if (data.byteLength === 0) return "";
        if (this.bytesNeeded === 0 && trailingIncomplete(data, 0) === 0) {
          this.bytesSeen = trailingBytesSeen(data);
          return b4a.toString(data, "utf8");
        }
        let result = "";
        let start = 0;
        if (this.bytesNeeded > 0) {
          while (start < data.byteLength) {
            const byte = data[start];
            if (byte < this.lowerBoundary || byte > this.upperBoundary) {
              result += "\uFFFD";
              this._reset();
              break;
            }
            this.lowerBoundary = 128;
            this.upperBoundary = 191;
            this.codePoint = this.codePoint << 6 | byte & 63;
            this.bytesSeen++;
            start++;
            if (this.bytesSeen === this.bytesNeeded) {
              result += String.fromCodePoint(this.codePoint);
              this._reset();
              break;
            }
          }
          if (this.bytesNeeded > 0) return result;
        }
        const trailing = trailingIncomplete(data, start);
        const end = data.byteLength - trailing;
        if (end > start) result += b4a.toString(data, "utf8", start, end);
        for (let i = end; i < data.byteLength; i++) {
          const byte = data[i];
          if (this.bytesNeeded === 0) {
            if (byte <= 127) {
              this.bytesSeen = 0;
              result += String.fromCharCode(byte);
            } else if (byte >= 194 && byte <= 223) {
              this.bytesNeeded = 2;
              this.bytesSeen = 1;
              this.codePoint = byte & 31;
            } else if (byte >= 224 && byte <= 239) {
              if (byte === 224) this.lowerBoundary = 160;
              else if (byte === 237) this.upperBoundary = 159;
              this.bytesNeeded = 3;
              this.bytesSeen = 1;
              this.codePoint = byte & 15;
            } else if (byte >= 240 && byte <= 244) {
              if (byte === 240) this.lowerBoundary = 144;
              else if (byte === 244) this.upperBoundary = 143;
              this.bytesNeeded = 4;
              this.bytesSeen = 1;
              this.codePoint = byte & 7;
            } else {
              this.bytesSeen = 1;
              result += "\uFFFD";
            }
            continue;
          }
          if (byte < this.lowerBoundary || byte > this.upperBoundary) {
            result += "\uFFFD";
            i--;
            this._reset();
            continue;
          }
          this.lowerBoundary = 128;
          this.upperBoundary = 191;
          this.codePoint = this.codePoint << 6 | byte & 63;
          this.bytesSeen++;
          if (this.bytesSeen === this.bytesNeeded) {
            result += String.fromCodePoint(this.codePoint);
            this._reset();
          }
        }
        return result;
      }
      flush() {
        const result = this.bytesNeeded > 0 ? "\uFFFD" : "";
        this._reset();
        return result;
      }
      _reset() {
        this.codePoint = 0;
        this.bytesNeeded = 0;
        this.bytesSeen = 0;
        this.lowerBoundary = 128;
        this.upperBoundary = 191;
      }
    };
    function trailingIncomplete(data, start) {
      const len = data.byteLength;
      if (len <= start) return 0;
      const limit = Math.max(start, len - 4);
      let i = len - 1;
      while (i > limit && (data[i] & 192) === 128) i--;
      if (i < start) return 0;
      const byte = data[i];
      let needed;
      if (byte <= 127) return 0;
      if (byte >= 194 && byte <= 223) needed = 2;
      else if (byte >= 224 && byte <= 239) needed = 3;
      else if (byte >= 240 && byte <= 244) needed = 4;
      else return 0;
      const available = len - i;
      return available < needed ? available : 0;
    }
    function trailingBytesSeen(data) {
      const len = data.byteLength;
      if (len === 0) return 0;
      const last = data[len - 1];
      if (last <= 127) return 0;
      if ((last & 192) !== 128) return 1;
      const limit = Math.max(0, len - 4);
      let i = len - 2;
      while (i >= limit && (data[i] & 192) === 128) i--;
      if (i < 0) return 1;
      const first = data[i];
      let needed;
      if (first >= 194 && first <= 223) needed = 2;
      else if (first >= 224 && first <= 239) needed = 3;
      else if (first >= 240 && first <= 244) needed = 4;
      else return 1;
      if (len - i !== needed) return 1;
      if (needed >= 3) {
        const second = data[i + 1];
        if (first === 224 && second < 160) return 1;
        if (first === 237 && second > 159) return 1;
        if (first === 240 && second < 144) return 1;
        if (first === 244 && second > 143) return 1;
      }
      return 0;
    }
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/text-decoder/index.js
var require_text_decoder = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/text-decoder/index.js"(exports2, module2) {
    var PassThroughDecoder = require_pass_through_decoder();
    var UTF8Decoder = require_utf8_decoder();
    module2.exports = class TextDecoder {
      constructor(encoding = "utf8") {
        this.encoding = normalizeEncoding(encoding);
        switch (this.encoding) {
          case "utf8":
            this.decoder = new UTF8Decoder();
            break;
          case "utf16le":
          case "base64":
            throw new Error("Unsupported encoding: " + this.encoding);
          default:
            this.decoder = new PassThroughDecoder(this.encoding);
        }
      }
      get remaining() {
        return this.decoder.remaining;
      }
      push(data) {
        if (typeof data === "string") return data;
        return this.decoder.decode(data);
      }
      // For Node.js compatibility
      write(data) {
        return this.push(data);
      }
      end(data) {
        let result = "";
        if (data) result = this.push(data);
        result += this.decoder.flush();
        return result;
      }
    };
    function normalizeEncoding(encoding) {
      encoding = encoding.toLowerCase();
      switch (encoding) {
        case "utf8":
        case "utf-8":
          return "utf8";
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return "utf16le";
        case "latin1":
        case "binary":
          return "latin1";
        case "base64":
        case "ascii":
        case "hex":
          return encoding;
        default:
          throw new Error("Unknown encoding: " + encoding);
      }
    }
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/streamx/lib/errors.js
var require_errors = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/streamx/lib/errors.js"(exports2, module2) {
    module2.exports = class StreamError extends Error {
      constructor(msg, code, fn = StreamError) {
        super(msg);
        this.code = code;
        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, fn);
        }
      }
      static isStreamDestroyed(err) {
        return err && err.code === "STREAM_DESTROYED";
      }
      static isPrematureClose(err) {
        return err && err.code === "PREMATURE_CLOSE";
      }
      static isAborted(err) {
        return err && err.code === "ABORTED";
      }
      static isBadArgument(err) {
        return err && err.code === "BAD_ARGUMENT";
      }
      get name() {
        return "StreamError";
      }
      static STREAM_DESTROYED() {
        return new StreamError("Stream was destroyed", "STREAM_DESTROYED", StreamError.STREAM_DESTROYED);
      }
      static PREMATURE_CLOSE(msg = "Premature close") {
        return new StreamError(msg, "PREMATURE_CLOSE", StreamError.PREMATURE_CLOSE);
      }
      static ABORTED() {
        return new StreamError("Stream aborted", "ABORTED", StreamError.ABORTED);
      }
      static BAD_ARGUMENT(msg = "Bad argument") {
        return new StreamError(msg, "BAD_ARGUMENT", StreamError.BAD_ARGUMENT);
      }
    };
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/streamx/index.js
var require_streamx = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/streamx/index.js"(exports2, module2) {
    var { EventEmitter } = require_default();
    var FIFO = require_fast_fifo();
    var TextDecoder = require_text_decoder();
    var StreamError = require_errors();
    var qmt = typeof queueMicrotask === "undefined" ? (fn) => global.process.nextTick(fn) : queueMicrotask;
    var MAX = (1 << 29) - 1;
    var OPENING = 1;
    var PREDESTROYING = 2;
    var DESTROYING = 4;
    var DESTROYED = 8;
    var NOT_OPENING = MAX ^ OPENING;
    var NOT_PREDESTROYING = MAX ^ PREDESTROYING;
    var READ_ACTIVE = 1 << 4;
    var READ_UPDATING = 2 << 4;
    var READ_PRIMARY = 4 << 4;
    var READ_QUEUED = 8 << 4;
    var READ_RESUMED = 16 << 4;
    var READ_PIPE_DRAINED = 32 << 4;
    var READ_ENDING = 64 << 4;
    var READ_EMIT_DATA = 128 << 4;
    var READ_EMIT_READABLE = 256 << 4;
    var READ_EMITTED_READABLE = 512 << 4;
    var READ_DONE = 1024 << 4;
    var READ_NEXT_TICK = 2048 << 4;
    var READ_NEEDS_PUSH = 4096 << 4;
    var READ_READ_AHEAD = 8192 << 4;
    var READ_FLOWING = READ_RESUMED | READ_PIPE_DRAINED;
    var READ_ACTIVE_AND_NEEDS_PUSH = READ_ACTIVE | READ_NEEDS_PUSH;
    var READ_PRIMARY_AND_ACTIVE = READ_PRIMARY | READ_ACTIVE;
    var READ_EMIT_READABLE_AND_QUEUED = READ_EMIT_READABLE | READ_QUEUED;
    var READ_RESUMED_READ_AHEAD = READ_RESUMED | READ_READ_AHEAD;
    var READ_NOT_ACTIVE = MAX ^ READ_ACTIVE;
    var READ_NON_PRIMARY = MAX ^ READ_PRIMARY;
    var READ_NON_PRIMARY_AND_PUSHED = MAX ^ (READ_PRIMARY | READ_NEEDS_PUSH);
    var READ_PUSHED = MAX ^ READ_NEEDS_PUSH;
    var READ_PAUSED = MAX ^ READ_RESUMED;
    var READ_NOT_QUEUED = MAX ^ (READ_QUEUED | READ_EMITTED_READABLE);
    var READ_NOT_ENDING = MAX ^ READ_ENDING;
    var READ_PIPE_NOT_DRAINED = MAX ^ READ_FLOWING;
    var READ_NOT_NEXT_TICK = MAX ^ READ_NEXT_TICK;
    var READ_NOT_UPDATING = MAX ^ READ_UPDATING;
    var READ_NO_READ_AHEAD = MAX ^ READ_READ_AHEAD;
    var READ_PAUSED_NO_READ_AHEAD = MAX ^ READ_RESUMED_READ_AHEAD;
    var WRITE_ACTIVE = 1 << 18;
    var WRITE_UPDATING = 2 << 18;
    var WRITE_PRIMARY = 4 << 18;
    var WRITE_QUEUED = 8 << 18;
    var WRITE_UNDRAINED = 16 << 18;
    var WRITE_DONE = 32 << 18;
    var WRITE_EMIT_DRAIN = 64 << 18;
    var WRITE_NEXT_TICK = 128 << 18;
    var WRITE_WRITING = 256 << 18;
    var WRITE_FINISHING = 512 << 18;
    var WRITE_CORKED = 1024 << 18;
    var WRITE_NOT_ACTIVE = MAX ^ (WRITE_ACTIVE | WRITE_WRITING);
    var WRITE_NON_PRIMARY = MAX ^ WRITE_PRIMARY;
    var WRITE_NOT_FINISHING = MAX ^ (WRITE_ACTIVE | WRITE_FINISHING);
    var WRITE_DRAINED = MAX ^ WRITE_UNDRAINED;
    var WRITE_NOT_QUEUED = MAX ^ WRITE_QUEUED;
    var WRITE_NOT_NEXT_TICK = MAX ^ WRITE_NEXT_TICK;
    var WRITE_NOT_UPDATING = MAX ^ WRITE_UPDATING;
    var WRITE_NOT_CORKED = MAX ^ WRITE_CORKED;
    var ACTIVE = READ_ACTIVE | WRITE_ACTIVE;
    var NOT_ACTIVE = MAX ^ ACTIVE;
    var DONE = READ_DONE | WRITE_DONE;
    var DESTROY_STATUS = DESTROYING | DESTROYED | PREDESTROYING;
    var OPEN_STATUS = DESTROY_STATUS | OPENING;
    var AUTO_DESTROY = DESTROY_STATUS | DONE;
    var NON_PRIMARY = WRITE_NON_PRIMARY & READ_NON_PRIMARY;
    var ACTIVE_OR_TICKING = WRITE_NEXT_TICK | READ_NEXT_TICK;
    var TICKING = ACTIVE_OR_TICKING & NOT_ACTIVE;
    var IS_OPENING = OPEN_STATUS | TICKING;
    var READ_PRIMARY_STATUS = OPEN_STATUS | READ_ENDING | READ_DONE;
    var READ_STATUS = OPEN_STATUS | READ_DONE | READ_QUEUED;
    var READ_ENDING_STATUS = OPEN_STATUS | READ_ENDING | READ_QUEUED;
    var READ_READABLE_STATUS = OPEN_STATUS | READ_EMIT_READABLE | READ_QUEUED | READ_EMITTED_READABLE;
    var SHOULD_NOT_READ = OPEN_STATUS | READ_ACTIVE | READ_ENDING | READ_DONE | READ_NEEDS_PUSH | READ_READ_AHEAD;
    var READ_BACKPRESSURE_STATUS = DESTROY_STATUS | READ_ENDING | READ_DONE;
    var READ_UPDATE_SYNC_STATUS = READ_UPDATING | OPEN_STATUS | READ_NEXT_TICK | READ_PRIMARY;
    var READ_NEXT_TICK_OR_OPENING = READ_NEXT_TICK | OPENING;
    var WRITE_PRIMARY_STATUS = OPEN_STATUS | WRITE_FINISHING | WRITE_DONE;
    var WRITE_QUEUED_AND_UNDRAINED = WRITE_QUEUED | WRITE_UNDRAINED;
    var WRITE_QUEUED_AND_ACTIVE = WRITE_QUEUED | WRITE_ACTIVE;
    var WRITE_DRAIN_STATUS = WRITE_QUEUED | WRITE_UNDRAINED | OPEN_STATUS | WRITE_ACTIVE;
    var WRITE_STATUS = OPEN_STATUS | WRITE_ACTIVE | WRITE_QUEUED | WRITE_CORKED;
    var WRITE_PRIMARY_AND_ACTIVE = WRITE_PRIMARY | WRITE_ACTIVE;
    var WRITE_ACTIVE_AND_WRITING = WRITE_ACTIVE | WRITE_WRITING;
    var WRITE_FINISHING_STATUS = OPEN_STATUS | WRITE_FINISHING | WRITE_QUEUED_AND_ACTIVE | WRITE_DONE;
    var WRITE_BACKPRESSURE_STATUS = WRITE_UNDRAINED | DESTROY_STATUS | WRITE_FINISHING | WRITE_DONE;
    var WRITE_UPDATE_SYNC_STATUS = WRITE_UPDATING | OPEN_STATUS | WRITE_NEXT_TICK | WRITE_PRIMARY;
    var WRITE_DROP_DATA = WRITE_FINISHING | WRITE_DONE | DESTROY_STATUS;
    var asyncIterator = Symbol.asyncIterator || Symbol("asyncIterator");
    var WritableState = class {
      constructor(stream, { highWaterMark = 16384, map = null, mapWritable, byteLength, byteLengthWritable } = {}) {
        this.stream = stream;
        this.queue = new FIFO();
        this.highWaterMark = highWaterMark;
        this.buffered = 0;
        this.error = null;
        this.pipeline = null;
        this.drains = null;
        this.byteLength = byteLengthWritable || byteLength || defaultByteLength;
        this.map = mapWritable || map;
        this.afterWrite = afterWrite.bind(this);
        this.afterUpdateNextTick = updateWriteNT.bind(this);
      }
      get ending() {
        return (this.stream._duplexState & WRITE_FINISHING) !== 0;
      }
      get ended() {
        return (this.stream._duplexState & WRITE_DONE) !== 0;
      }
      push(data) {
        if ((this.stream._duplexState & WRITE_DROP_DATA) !== 0) return false;
        if (this.map !== null) data = this.map(data);
        this.buffered += this.byteLength(data);
        this.queue.push(data);
        if (this.buffered < this.highWaterMark) {
          this.stream._duplexState |= WRITE_QUEUED;
          return true;
        }
        this.stream._duplexState |= WRITE_QUEUED_AND_UNDRAINED;
        return false;
      }
      shift() {
        const data = this.queue.shift();
        this.buffered -= this.byteLength(data);
        if (this.buffered === 0) this.stream._duplexState &= WRITE_NOT_QUEUED;
        return data;
      }
      end(data) {
        if (typeof data === "function") {
          this.stream.once("finish", data);
        } else if (data !== void 0 && data !== null) {
          this.push(data);
        }
        this.stream._duplexState = (this.stream._duplexState | WRITE_FINISHING) & WRITE_NON_PRIMARY;
      }
      autoBatch(data, cb) {
        const buffer = [];
        const stream = this.stream;
        buffer.push(data);
        while ((stream._duplexState & WRITE_STATUS) === WRITE_QUEUED_AND_ACTIVE) {
          buffer.push(stream._writableState.shift());
        }
        if ((stream._duplexState & OPEN_STATUS) !== 0) return cb(null);
        stream._writev(buffer, cb);
      }
      update() {
        const stream = this.stream;
        stream._duplexState |= WRITE_UPDATING;
        do {
          while ((stream._duplexState & WRITE_STATUS) === WRITE_QUEUED) {
            const data = this.shift();
            stream._duplexState |= WRITE_ACTIVE_AND_WRITING;
            stream._write(data, this.afterWrite);
          }
          if ((stream._duplexState & WRITE_PRIMARY_AND_ACTIVE) === 0) this.updateNonPrimary();
        } while (this.continueUpdate() === true);
        stream._duplexState &= WRITE_NOT_UPDATING;
      }
      updateNonPrimary() {
        const stream = this.stream;
        if ((stream._duplexState & WRITE_FINISHING_STATUS) === WRITE_FINISHING) {
          stream._duplexState = stream._duplexState | WRITE_ACTIVE;
          stream._final(afterFinal.bind(this));
          return;
        }
        if ((stream._duplexState & DESTROY_STATUS) === DESTROYING) {
          if ((stream._duplexState & ACTIVE_OR_TICKING) === 0) {
            stream._duplexState |= ACTIVE;
            stream._destroy(afterDestroy.bind(this));
          }
          return;
        }
        if ((stream._duplexState & IS_OPENING) === OPENING) {
          stream._duplexState = (stream._duplexState | ACTIVE) & NOT_OPENING;
          stream._open(afterOpen.bind(this));
        }
      }
      continueUpdate() {
        if ((this.stream._duplexState & WRITE_NEXT_TICK) === 0) return false;
        this.stream._duplexState &= WRITE_NOT_NEXT_TICK;
        return true;
      }
      updateCallback() {
        if ((this.stream._duplexState & WRITE_UPDATE_SYNC_STATUS) === WRITE_PRIMARY) {
          this.update();
        } else {
          this.updateNextTick();
        }
      }
      updateNextTick() {
        if ((this.stream._duplexState & WRITE_NEXT_TICK) !== 0) return;
        this.stream._duplexState |= WRITE_NEXT_TICK;
        if ((this.stream._duplexState & WRITE_UPDATING) === 0) qmt(this.afterUpdateNextTick);
      }
    };
    var ReadableState = class {
      constructor(stream, { highWaterMark = 16384, map = null, mapReadable, byteLength, byteLengthReadable } = {}) {
        this.stream = stream;
        this.queue = new FIFO();
        this.highWaterMark = highWaterMark === 0 ? 1 : highWaterMark;
        this.buffered = 0;
        this.readAhead = highWaterMark > 0;
        this.error = null;
        this.pipeline = null;
        this.byteLength = byteLengthReadable || byteLength || defaultByteLength;
        this.map = mapReadable || map;
        this.pipeTo = null;
        this.afterRead = afterRead.bind(this);
        this.afterUpdateNextTick = updateReadNT.bind(this);
      }
      get ending() {
        return (this.stream._duplexState & READ_ENDING) !== 0;
      }
      get ended() {
        return (this.stream._duplexState & READ_DONE) !== 0;
      }
      pipe(pipeTo, cb) {
        if (this.pipeTo !== null) throw StreamError.BAD_ARGUMENT("Can only pipe to one destination");
        if (typeof cb !== "function") cb = null;
        this.stream._duplexState |= READ_PIPE_DRAINED;
        this.pipeTo = pipeTo;
        this.pipeline = new Pipeline(this.stream, pipeTo, cb);
        if (cb) this.stream.on("error", noop);
        if (isStreamx(pipeTo)) {
          pipeTo._writableState.pipeline = this.pipeline;
          if (cb) pipeTo.on("error", noop);
          pipeTo.on("finish", this.pipeline.finished.bind(this.pipeline));
        } else {
          const onerror = this.pipeline.done.bind(this.pipeline, pipeTo);
          const onclose = this.pipeline.done.bind(this.pipeline, pipeTo, null);
          pipeTo.on("error", onerror);
          pipeTo.on("close", onclose);
          pipeTo.on("finish", this.pipeline.finished.bind(this.pipeline));
        }
        pipeTo.on("drain", afterDrain.bind(this));
        this.stream.emit("piping", pipeTo);
        pipeTo.emit("pipe", this.stream);
      }
      push(data) {
        const stream = this.stream;
        if (data === null) {
          this.highWaterMark = 0;
          stream._duplexState = (stream._duplexState | READ_ENDING) & READ_NON_PRIMARY_AND_PUSHED;
          return false;
        }
        if (this.map !== null) {
          data = this.map(data);
          if (data === null) {
            stream._duplexState &= READ_PUSHED;
            return this.buffered < this.highWaterMark;
          }
        }
        this.buffered += this.byteLength(data);
        this.queue.push(data);
        stream._duplexState = (stream._duplexState | READ_QUEUED) & READ_PUSHED;
        return this.buffered < this.highWaterMark;
      }
      shift() {
        const data = this.queue.shift();
        this.buffered -= this.byteLength(data);
        if (this.buffered === 0) {
          this.stream._duplexState &= READ_NOT_QUEUED;
        }
        return data;
      }
      unshift(data) {
        const pending2 = [this.map !== null ? this.map(data) : data];
        while (this.buffered > 0) pending2.push(this.shift());
        for (let i = 0; i < pending2.length - 1; i++) {
          const data2 = pending2[i];
          this.buffered += this.byteLength(data2);
          this.queue.push(data2);
        }
        this.push(pending2[pending2.length - 1]);
      }
      read() {
        const stream = this.stream;
        if ((stream._duplexState & READ_STATUS) === READ_QUEUED) {
          const data = this.shift();
          if (this.pipeTo !== null && this.pipeTo.write(data) === false) {
            stream._duplexState &= READ_PIPE_NOT_DRAINED;
          }
          if ((stream._duplexState & READ_EMIT_DATA) !== 0) {
            stream.emit("data", data);
          }
          return data;
        }
        if (this.readAhead === false) {
          stream._duplexState |= READ_READ_AHEAD;
          this.updateNextTick();
        }
        return null;
      }
      drain() {
        const stream = this.stream;
        while ((stream._duplexState & READ_STATUS) === READ_QUEUED && (stream._duplexState & READ_FLOWING) !== 0) {
          const data = this.shift();
          if (this.pipeTo !== null && this.pipeTo.write(data) === false) {
            stream._duplexState &= READ_PIPE_NOT_DRAINED;
          }
          if ((stream._duplexState & READ_EMIT_DATA) !== 0) {
            stream.emit("data", data);
          }
        }
      }
      update() {
        const stream = this.stream;
        stream._duplexState |= READ_UPDATING;
        do {
          this.drain();
          while (this.buffered < this.highWaterMark && (stream._duplexState & SHOULD_NOT_READ) === READ_READ_AHEAD) {
            stream._duplexState |= READ_ACTIVE_AND_NEEDS_PUSH;
            stream._read(this.afterRead);
            this.drain();
          }
          if ((stream._duplexState & READ_READABLE_STATUS) === READ_EMIT_READABLE_AND_QUEUED) {
            stream._duplexState |= READ_EMITTED_READABLE;
            stream.emit("readable");
          }
          if ((stream._duplexState & READ_PRIMARY_AND_ACTIVE) === 0) {
            this.updateNonPrimary();
          }
        } while (this.continueUpdate() === true);
        stream._duplexState &= READ_NOT_UPDATING;
      }
      updateNonPrimary() {
        const stream = this.stream;
        if ((stream._duplexState & READ_ENDING_STATUS) === READ_ENDING) {
          stream._duplexState = (stream._duplexState | READ_DONE) & READ_NOT_ENDING;
          stream.emit("end");
          if ((stream._duplexState & AUTO_DESTROY) === DONE) {
            stream._duplexState |= DESTROYING;
          }
          if (this.pipeTo !== null) {
            this.pipeTo.end();
          }
        }
        if ((stream._duplexState & DESTROY_STATUS) === DESTROYING) {
          if ((stream._duplexState & ACTIVE_OR_TICKING) === 0) {
            stream._duplexState |= ACTIVE;
            stream._destroy(afterDestroy.bind(this));
          }
          return;
        }
        if ((stream._duplexState & IS_OPENING) === OPENING) {
          stream._duplexState = (stream._duplexState | ACTIVE) & NOT_OPENING;
          stream._open(afterOpen.bind(this));
        }
      }
      continueUpdate() {
        if ((this.stream._duplexState & READ_NEXT_TICK) === 0) return false;
        this.stream._duplexState &= READ_NOT_NEXT_TICK;
        return true;
      }
      updateCallback() {
        if ((this.stream._duplexState & READ_UPDATE_SYNC_STATUS) === READ_PRIMARY) {
          this.update();
        } else {
          this.updateNextTick();
        }
      }
      updateNextTickIfOpen() {
        if ((this.stream._duplexState & READ_NEXT_TICK_OR_OPENING) !== 0) return;
        this.stream._duplexState |= READ_NEXT_TICK;
        if ((this.stream._duplexState & READ_UPDATING) === 0) qmt(this.afterUpdateNextTick);
      }
      updateNextTick() {
        if ((this.stream._duplexState & READ_NEXT_TICK) !== 0) return;
        this.stream._duplexState |= READ_NEXT_TICK;
        if ((this.stream._duplexState & READ_UPDATING) === 0) qmt(this.afterUpdateNextTick);
      }
    };
    var TransformState = class {
      constructor(stream) {
        this.data = null;
        this.afterTransform = afterTransform.bind(stream);
        this.afterFinal = null;
      }
    };
    var Pipeline = class {
      constructor(src, dst, cb) {
        this.from = src;
        this.to = dst;
        this.afterPipe = cb;
        this.error = null;
        this.pipeToFinished = false;
      }
      finished() {
        this.pipeToFinished = true;
      }
      done(stream, err) {
        if (err) this.error = err;
        if (stream === this.to) {
          this.to = null;
          if (this.from !== null) {
            if ((this.from._duplexState & READ_DONE) === 0 || !this.pipeToFinished) {
              this.from.destroy(this.error || StreamError.PREMATURE_CLOSE("Writable stream closed"));
            }
            return;
          }
        }
        if (stream === this.from) {
          this.from = null;
          if (this.to !== null) {
            if ((stream._duplexState & READ_DONE) === 0) {
              this.to.destroy(this.error || StreamError.PREMATURE_CLOSE("Readable stream closed"));
            }
            return;
          }
        }
        if (this.afterPipe !== null) this.afterPipe(this.error);
        this.to = this.from = this.afterPipe = null;
      }
    };
    function afterDrain() {
      this.stream._duplexState |= READ_PIPE_DRAINED;
      this.updateCallback();
    }
    function afterFinal(err) {
      const stream = this.stream;
      if (err) stream.destroy(err);
      if ((stream._duplexState & DESTROY_STATUS) === 0) {
        stream._duplexState |= WRITE_DONE;
        stream.emit("finish");
      }
      if ((stream._duplexState & AUTO_DESTROY) === DONE) {
        stream._duplexState |= DESTROYING;
      }
      stream._duplexState &= WRITE_NOT_FINISHING;
      if ((stream._duplexState & WRITE_UPDATING) === 0) {
        this.update();
      } else {
        this.updateNextTick();
      }
    }
    function afterDestroy(err) {
      const stream = this.stream;
      if (!err && !StreamError.isStreamDestroyed(this.error)) err = this.error;
      if (err) stream.emit("error", err);
      stream._duplexState |= DESTROYED;
      stream.emit("close");
      const rs = stream._readableState;
      const ws = stream._writableState;
      if (rs !== null && rs.pipeline !== null) {
        rs.pipeline.done(stream, err);
      }
      if (ws !== null) {
        while (ws.drains !== null && ws.drains.length > 0) {
          ws.drains.shift().resolve(false);
        }
        if (ws.pipeline !== null) {
          ws.pipeline.done(stream, err);
        }
      }
    }
    function afterWrite(err) {
      const stream = this.stream;
      if (err) stream.destroy(err);
      stream._duplexState &= WRITE_NOT_ACTIVE;
      if (this.drains !== null) tickDrains(this.drains);
      if ((stream._duplexState & WRITE_DRAIN_STATUS) === WRITE_UNDRAINED) {
        stream._duplexState &= WRITE_DRAINED;
        if ((stream._duplexState & WRITE_EMIT_DRAIN) === WRITE_EMIT_DRAIN) {
          stream.emit("drain");
        }
      }
      this.updateCallback();
    }
    function afterRead(err) {
      if (err) this.stream.destroy(err);
      this.stream._duplexState &= READ_NOT_ACTIVE;
      if (this.readAhead === false && (this.stream._duplexState & READ_RESUMED) === 0) {
        this.stream._duplexState &= READ_NO_READ_AHEAD;
      }
      this.updateCallback();
    }
    function updateReadNT() {
      if ((this.stream._duplexState & READ_UPDATING) === 0) {
        this.stream._duplexState &= READ_NOT_NEXT_TICK;
        this.update();
      }
    }
    function updateWriteNT() {
      if ((this.stream._duplexState & WRITE_UPDATING) === 0) {
        this.stream._duplexState &= WRITE_NOT_NEXT_TICK;
        this.update();
      }
    }
    function tickDrains(drains) {
      for (let i = 0; i < drains.length; i++) {
        if (--drains[i].writes === 0) {
          drains.shift().resolve(true);
          i--;
        }
      }
    }
    function afterOpen(err) {
      const stream = this.stream;
      if (err) stream.destroy(err);
      if ((stream._duplexState & DESTROYING) === 0) {
        if ((stream._duplexState & READ_PRIMARY_STATUS) === 0) {
          stream._duplexState |= READ_PRIMARY;
        }
        if ((stream._duplexState & WRITE_PRIMARY_STATUS) === 0) {
          stream._duplexState |= WRITE_PRIMARY;
        }
        stream.emit("open");
      }
      stream._duplexState &= NOT_ACTIVE;
      if (stream._writableState !== null) {
        stream._writableState.updateCallback();
      }
      if (stream._readableState !== null) {
        stream._readableState.updateCallback();
      }
    }
    function afterTransform(err, data) {
      if (data !== void 0 && data !== null) this.push(data);
      this._writableState.afterWrite(err);
    }
    function newListener(name) {
      if (this._readableState !== null) {
        if (name === "data") {
          this._duplexState |= READ_EMIT_DATA | READ_RESUMED_READ_AHEAD;
          this._readableState.updateNextTick();
        }
        if (name === "readable") {
          this._duplexState |= READ_EMIT_READABLE;
          this._readableState.updateNextTick();
        }
      }
      if (this._writableState !== null) {
        if (name === "drain") {
          this._duplexState |= WRITE_EMIT_DRAIN;
          this._writableState.updateNextTick();
        }
      }
    }
    var Stream = class extends EventEmitter {
      constructor(opts) {
        super();
        this._duplexState = 0;
        this._readableState = null;
        this._writableState = null;
        if (opts) {
          if (opts.open) this._open = opts.open;
          if (opts.destroy) this._destroy = opts.destroy;
          if (opts.predestroy) this._predestroy = opts.predestroy;
          if (opts.signal) opts.signal.addEventListener("abort", abort.bind(this));
        }
        this.on("newListener", newListener);
      }
      _open(cb) {
        cb(null);
      }
      _destroy(cb) {
        cb(null);
      }
      _predestroy() {
      }
      get readable() {
        return this._readableState !== null ? true : void 0;
      }
      get writable() {
        return this._writableState !== null ? true : void 0;
      }
      get destroyed() {
        return (this._duplexState & DESTROYED) !== 0;
      }
      get destroying() {
        return (this._duplexState & DESTROY_STATUS) !== 0;
      }
      destroy(err) {
        if ((this._duplexState & DESTROY_STATUS) === 0) {
          if (!err) err = StreamError.STREAM_DESTROYED();
          this._duplexState = (this._duplexState | DESTROYING) & NON_PRIMARY;
          if (this._readableState !== null) {
            this._readableState.highWaterMark = 0;
            this._readableState.error = err;
          }
          if (this._writableState !== null) {
            this._writableState.highWaterMark = 0;
            this._writableState.error = err;
          }
          this._duplexState |= PREDESTROYING;
          this._predestroy();
          this._duplexState &= NOT_PREDESTROYING;
          if (this._readableState !== null) {
            this._readableState.updateNextTick();
          }
          if (this._writableState !== null) {
            this._writableState.updateNextTick();
          }
        }
      }
    };
    var Readable = class _Readable extends Stream {
      constructor(opts) {
        super(opts);
        this._duplexState |= OPENING | WRITE_DONE | READ_READ_AHEAD;
        this._readableState = new ReadableState(this, opts);
        if (opts) {
          if (this._readableState.readAhead === false) this._duplexState &= READ_NO_READ_AHEAD;
          if (opts.read) this._read = opts.read;
          if (opts.eagerOpen) this._readableState.updateNextTick();
          if (opts.encoding) this.setEncoding(opts.encoding);
        }
      }
      static deferred(fn, opts) {
        const out = new PassThrough(opts);
        fn().then((src) => {
          if (src === null) return out.end();
          if (out.destroying) return;
          pipeline(src, out, noop);
        }).catch((err) => out.destroy(err));
        return out;
      }
      setEncoding(encoding) {
        const dec = new TextDecoder(encoding);
        const map = this._readableState.map || echo;
        this._readableState.map = mapOrSkip;
        return this;
        function mapOrSkip(data) {
          const next2 = dec.push(data);
          return next2 === "" && (data.byteLength !== 0 || dec.remaining > 0) ? null : map(next2);
        }
      }
      _read(cb) {
        cb(null);
      }
      pipe(dest, cb) {
        this._readableState.updateNextTick();
        this._readableState.pipe(dest, cb);
        return dest;
      }
      read() {
        this._readableState.updateNextTick();
        return this._readableState.read();
      }
      push(data) {
        this._readableState.updateNextTickIfOpen();
        return this._readableState.push(data);
      }
      unshift(data) {
        this._readableState.updateNextTickIfOpen();
        return this._readableState.unshift(data);
      }
      resume() {
        this._duplexState |= READ_RESUMED_READ_AHEAD;
        this._readableState.updateNextTick();
        return this;
      }
      pause() {
        this._duplexState &= this._readableState.readAhead === false ? READ_PAUSED_NO_READ_AHEAD : READ_PAUSED;
        return this;
      }
      static _fromAsyncIterator(ite, opts) {
        let destroy;
        const rs = new _Readable({
          ...opts,
          read(cb) {
            ite.next().then(push).then(cb.bind(null, null)).catch(cb);
          },
          predestroy() {
            destroy = ite.return();
          },
          destroy(cb) {
            if (!destroy) return cb(null);
            destroy.then(cb.bind(null, null)).catch(cb);
          }
        });
        return rs;
        function push(data) {
          if (data.done) rs.push(null);
          else rs.push(data.value);
        }
      }
      static from(data, opts) {
        if (isReadStreamx(data)) return data;
        if (data[asyncIterator]) return this._fromAsyncIterator(data[asyncIterator](), opts);
        if (!Array.isArray(data)) data = data === void 0 ? [] : [data];
        let i = 0;
        return new _Readable({
          ...opts,
          read(cb) {
            this.push(i === data.length ? null : data[i++]);
            cb(null);
          }
        });
      }
      static isBackpressured(rs) {
        return (rs._duplexState & READ_BACKPRESSURE_STATUS) !== 0 || rs._readableState.buffered >= rs._readableState.highWaterMark;
      }
      static isPaused(rs) {
        return (rs._duplexState & READ_RESUMED) === 0;
      }
      [asyncIterator]() {
        const stream = this;
        let error = null;
        let promiseResolve = null;
        let promiseReject = null;
        this.on("error", (err) => {
          error = err;
        });
        this.on("readable", onreadable);
        this.on("close", onclose);
        return {
          [asyncIterator]() {
            return this;
          },
          next() {
            return new Promise(function(resolve, reject) {
              promiseResolve = resolve;
              promiseReject = reject;
              const data = stream.read();
              if (data !== null) ondata(data);
              else if ((stream._duplexState & DESTROYED) !== 0) ondata(null);
            });
          },
          return() {
            return destroy(null);
          },
          throw(err) {
            return destroy(err);
          }
        };
        function onreadable() {
          if (promiseResolve !== null) ondata(stream.read());
        }
        function onclose() {
          if (promiseResolve !== null) ondata(null);
        }
        function ondata(data) {
          if (promiseReject === null) return;
          if (error) {
            promiseReject(error);
          } else if (data === null && (stream._duplexState & READ_DONE) === 0) {
            promiseReject(StreamError.STREAM_DESTROYED());
          } else {
            promiseResolve({ value: data, done: data === null });
          }
          promiseReject = promiseResolve = null;
        }
        function destroy(err) {
          stream.destroy(err);
          return new Promise((resolve, reject) => {
            if (stream._duplexState & DESTROYED) return resolve({ value: void 0, done: true });
            stream.once("close", function() {
              if (err) reject(err);
              else resolve({ value: void 0, done: true });
            });
          });
        }
      }
    };
    var Writable = class extends Stream {
      constructor(opts) {
        super(opts);
        this._duplexState |= OPENING | READ_DONE;
        this._writableState = new WritableState(this, opts);
        if (opts) {
          if (opts.writev) this._writev = opts.writev;
          if (opts.write) this._write = opts.write;
          if (opts.final) this._final = opts.final;
          if (opts.eagerOpen) this._writableState.updateNextTick();
        }
      }
      cork() {
        this._duplexState |= WRITE_CORKED;
      }
      uncork() {
        this._duplexState &= WRITE_NOT_CORKED;
        this._writableState.updateNextTick();
      }
      _writev(batch, cb) {
        cb(null);
      }
      _write(data, cb) {
        this._writableState.autoBatch(data, cb);
      }
      _final(cb) {
        cb(null);
      }
      static isBackpressured(ws) {
        return (ws._duplexState & WRITE_BACKPRESSURE_STATUS) !== 0;
      }
      static drained(ws) {
        if (ws.destroyed) return Promise.resolve(false);
        const state = ws._writableState;
        const pending2 = isWritev(ws) ? Math.min(1, state.queue.length) : state.queue.length;
        const writes = pending2 + (ws._duplexState & WRITE_WRITING ? 1 : 0);
        if (writes === 0) return Promise.resolve(true);
        if (state.drains === null) state.drains = [];
        return new Promise((resolve) => {
          state.drains.push({ writes, resolve });
        });
      }
      write(data) {
        this._writableState.updateNextTick();
        return this._writableState.push(data);
      }
      end(data) {
        this._writableState.updateNextTick();
        this._writableState.end(data);
        return this;
      }
    };
    var Duplex = class extends Readable {
      // and Writable
      constructor(opts) {
        super(opts);
        this._duplexState = OPENING | this._duplexState & READ_READ_AHEAD;
        this._writableState = new WritableState(this, opts);
        if (opts) {
          if (opts.writev) this._writev = opts.writev;
          if (opts.write) this._write = opts.write;
          if (opts.final) this._final = opts.final;
        }
      }
      cork() {
        this._duplexState |= WRITE_CORKED;
      }
      uncork() {
        this._duplexState &= WRITE_NOT_CORKED;
        this._writableState.updateNextTick();
      }
      _writev(batch, cb) {
        cb(null);
      }
      _write(data, cb) {
        this._writableState.autoBatch(data, cb);
      }
      _final(cb) {
        cb(null);
      }
      write(data) {
        this._writableState.updateNextTick();
        return this._writableState.push(data);
      }
      end(data) {
        this._writableState.updateNextTick();
        this._writableState.end(data);
        return this;
      }
    };
    var Transform = class extends Duplex {
      constructor(opts) {
        super(opts);
        this._transformState = new TransformState(this);
        if (opts) {
          if (opts.transform) this._transform = opts.transform;
          if (opts.flush) this._flush = opts.flush;
        }
      }
      _write(data, cb) {
        if (this._readableState.buffered >= this._readableState.highWaterMark) {
          this._transformState.data = data;
        } else {
          this._transform(data, this._transformState.afterTransform);
        }
      }
      _read(cb) {
        if (this._transformState.data !== null) {
          const data = this._transformState.data;
          this._transformState.data = null;
          cb(null);
          this._transform(data, this._transformState.afterTransform);
        } else {
          cb(null);
        }
      }
      destroy(err) {
        super.destroy(err);
        if (this._transformState.data !== null) {
          this._transformState.data = null;
          this._transformState.afterTransform();
        }
      }
      _transform(data, cb) {
        cb(null, data);
      }
      _flush(cb) {
        cb(null);
      }
      _final(cb) {
        this._transformState.afterFinal = cb;
        this._flush(transformAfterFlush.bind(this));
      }
    };
    var PassThrough = class extends Transform {
    };
    function transformAfterFlush(err, data) {
      const cb = this._transformState.afterFinal;
      if (err) return cb(err);
      if (data !== null && data !== void 0) this.push(data);
      this.push(null);
      cb(null);
    }
    function pipelinePromise(...streams) {
      return new Promise((resolve, reject) => {
        return pipeline(...streams, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
    function pipeline(stream, ...streams) {
      const all = Array.isArray(stream) ? [...stream, ...streams] : [stream, ...streams];
      const done = all.length && typeof all[all.length - 1] === "function" ? all.pop() : null;
      if (all.length < 2) throw StreamError.BAD_ARGUMENT("Pipeline requires at least 2 streams");
      let src = all[0];
      let dest = null;
      let error = null;
      for (let i = 1; i < all.length; i++) {
        dest = all[i];
        if (isStreamx(src)) {
          src.pipe(dest, onerror);
        } else {
          errorHandle(src, true, i > 1, onerror);
          src.pipe(dest);
        }
        src = dest;
      }
      if (done) {
        let fin = false;
        const autoDestroy = isStreamx(dest) || !!(dest._writableState && dest._writableState.autoDestroy);
        dest.on("error", (err) => {
          if (error === null) error = err;
        });
        dest.on("finish", () => {
          fin = true;
          if (!autoDestroy) done(error);
        });
        if (autoDestroy) {
          dest.on("close", () => done(error || (fin ? null : StreamError.PREMATURE_CLOSE())));
        }
      }
      return dest;
      function errorHandle(s, rd, wr, onerror2) {
        s.on("error", onerror2);
        s.on("close", onclose);
        function onclose() {
          if (rd && s._readableState && !s._readableState.ended) {
            return onerror2(StreamError.PREMATURE_CLOSE());
          }
          if (wr && s._writableState && !s._writableState.ended) {
            return onerror2(StreamError.PREMATURE_CLOSE());
          }
        }
      }
      function onerror(err) {
        if (!err || error) return;
        error = err;
        for (const s of all) {
          s.destroy(err);
        }
      }
    }
    function echo(s) {
      return s;
    }
    function isStream(stream) {
      return !!stream._readableState || !!stream._writableState;
    }
    function isStreamx(stream) {
      return typeof stream._duplexState === "number" && isStream(stream);
    }
    function isEnding(stream) {
      return !!stream._readableState && stream._readableState.ending;
    }
    function isEnded(stream) {
      return !!stream._readableState && stream._readableState.ended;
    }
    function isFinishing(stream) {
      return !!stream._writableState && stream._writableState.ending;
    }
    function isFinished(stream) {
      return !!stream._writableState && stream._writableState.ended;
    }
    function getStreamError(stream, opts = {}) {
      const err = stream._readableState && stream._readableState.error || stream._writableState && stream._writableState.error;
      return !opts.all && StreamError.isStreamDestroyed(err) ? null : err;
    }
    function isReadStreamx(stream) {
      return isStreamx(stream) && stream.readable;
    }
    function isDisturbed(stream) {
      return (stream._duplexState & OPENING) !== OPENING || (stream._duplexState & DESTROYING) === DESTROYING || (stream._duplexState & ACTIVE_OR_TICKING) !== 0;
    }
    function isTypedArray(data) {
      return typeof data === "object" && data !== null && typeof data.byteLength === "number";
    }
    function defaultByteLength(data) {
      return isTypedArray(data) ? data.byteLength : 1024;
    }
    function noop() {
    }
    function abort() {
      this.destroy(StreamError.ABORTED());
    }
    function isWritev(s) {
      return s._writev !== Writable.prototype._writev && s._writev !== Duplex.prototype._writev;
    }
    module2.exports = {
      pipeline,
      pipelinePromise,
      isStream,
      isStreamx,
      isEnding,
      isEnded,
      isFinishing,
      isFinished,
      isDisturbed,
      getStreamError,
      Stream,
      Writable,
      Readable,
      Duplex,
      Transform,
      // Export PassThrough for compatibility with Node.js core's stream module
      PassThrough
    };
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/tar-stream/headers.js
var require_headers = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/tar-stream/headers.js"(exports2) {
    var b4a = require_b4a();
    var ZEROS = "0000000000000000000";
    var SEVENS = "7777777777777777777";
    var ZERO_OFFSET = "0".charCodeAt(0);
    var USTAR_MAGIC = b4a.from([117, 115, 116, 97, 114, 0]);
    var USTAR_VER = b4a.from([ZERO_OFFSET, ZERO_OFFSET]);
    var GNU_MAGIC = b4a.from([117, 115, 116, 97, 114, 32]);
    var GNU_VER = b4a.from([32, 0]);
    var MASK = 4095;
    var MAGIC_OFFSET = 257;
    var VERSION_OFFSET = 263;
    exports2.decodeLongPath = function decodeLongPath(buf, encoding) {
      return decodeStr(buf, 0, buf.length, encoding);
    };
    exports2.encodePax = function encodePax(opts) {
      let result = "";
      if (opts.name) result += addLength(" path=" + opts.name + "\n");
      if (opts.linkname) result += addLength(" linkpath=" + opts.linkname + "\n");
      const pax = opts.pax;
      if (pax) {
        for (const key in pax) {
          result += addLength(" " + key + "=" + pax[key] + "\n");
        }
      }
      return b4a.from(result);
    };
    exports2.decodePax = function decodePax(buf) {
      const result = {};
      while (buf.length) {
        let i = 0;
        while (i < buf.length && buf[i] !== 32) i++;
        const len = parseInt(b4a.toString(buf.subarray(0, i)), 10);
        if (!len) return result;
        const b = b4a.toString(buf.subarray(i + 1, len - 1));
        const keyIndex = b.indexOf("=");
        if (keyIndex === -1) return result;
        result[b.slice(0, keyIndex)] = b.slice(keyIndex + 1);
        buf = buf.subarray(len);
      }
      return result;
    };
    exports2.encode = function encode(opts) {
      const buf = b4a.alloc(512);
      let name = opts.name;
      let prefix = "";
      if (opts.typeflag === 5 && name[name.length - 1] !== "/") name += "/";
      if (b4a.byteLength(name) !== name.length) return null;
      while (b4a.byteLength(name) > 100) {
        const i = name.indexOf("/");
        if (i === -1) return null;
        prefix += prefix ? "/" + name.slice(0, i) : name.slice(0, i);
        name = name.slice(i + 1);
      }
      if (b4a.byteLength(name) > 100 || b4a.byteLength(prefix) > 155) return null;
      if (opts.linkname && b4a.byteLength(opts.linkname) > 100) return null;
      b4a.write(buf, name);
      b4a.write(buf, encodeOct(opts.mode & MASK, 6), 100);
      b4a.write(buf, encodeOct(opts.uid, 6), 108);
      b4a.write(buf, encodeOct(opts.gid, 6), 116);
      encodeSize(opts.size, buf, 124);
      b4a.write(buf, encodeOct(opts.mtime.getTime() / 1e3 | 0, 11), 136);
      buf[156] = ZERO_OFFSET + toTypeflag(opts.type);
      if (opts.linkname) b4a.write(buf, opts.linkname, 157);
      b4a.copy(USTAR_MAGIC, buf, MAGIC_OFFSET);
      b4a.copy(USTAR_VER, buf, VERSION_OFFSET);
      if (opts.uname) b4a.write(buf, opts.uname, 265);
      if (opts.gname) b4a.write(buf, opts.gname, 297);
      b4a.write(buf, encodeOct(opts.devmajor || 0, 6), 329);
      b4a.write(buf, encodeOct(opts.devminor || 0, 6), 337);
      if (prefix) b4a.write(buf, prefix, 345);
      b4a.write(buf, encodeOct(cksum(buf), 6), 148);
      return buf;
    };
    exports2.decode = function decode(buf, filenameEncoding, allowUnknownFormat) {
      let typeflag = buf[156] === 0 ? 0 : buf[156] - ZERO_OFFSET;
      let name = decodeStr(buf, 0, 100, filenameEncoding);
      const mode = decodeOct(buf, 100, 8);
      const uid = decodeOct(buf, 108, 8);
      const gid = decodeOct(buf, 116, 8);
      const size = decodeOct(buf, 124, 12);
      const mtime = decodeOct(buf, 136, 12);
      const type = toType(typeflag);
      const linkname = buf[157] === 0 ? null : decodeStr(buf, 157, 100, filenameEncoding);
      const uname = decodeStr(buf, 265, 32);
      const gname = decodeStr(buf, 297, 32);
      const devmajor = decodeOct(buf, 329, 8);
      const devminor = decodeOct(buf, 337, 8);
      const c = cksum(buf);
      if (c === 8 * 32) return null;
      if (c !== decodeOct(buf, 148, 8)) throw new Error("Invalid tar header. Maybe the tar is corrupted or it needs to be gunzipped?");
      if (isUSTAR(buf)) {
        if (buf[345]) name = decodeStr(buf, 345, 155, filenameEncoding) + "/" + name;
      } else if (isGNU(buf)) {
      } else {
        if (!allowUnknownFormat) {
          throw new Error("Invalid tar header: unknown format.");
        }
      }
      if (typeflag === 0 && name && name[name.length - 1] === "/") typeflag = 5;
      return {
        name,
        mode,
        uid,
        gid,
        size,
        byteOffset: 0,
        mtime: new Date(1e3 * mtime),
        type,
        linkname,
        uname,
        gname,
        devmajor,
        devminor,
        pax: null
      };
    };
    function isUSTAR(buf) {
      return b4a.equals(USTAR_MAGIC, buf.subarray(MAGIC_OFFSET, MAGIC_OFFSET + 6));
    }
    function isGNU(buf) {
      return b4a.equals(GNU_MAGIC, buf.subarray(MAGIC_OFFSET, MAGIC_OFFSET + 6)) && b4a.equals(GNU_VER, buf.subarray(VERSION_OFFSET, VERSION_OFFSET + 2));
    }
    function clamp(index, len, defaultValue) {
      if (typeof index !== "number") return defaultValue;
      index = ~~index;
      if (index >= len) return len;
      if (index >= 0) return index;
      index += len;
      if (index >= 0) return index;
      return 0;
    }
    function toType(flag) {
      switch (flag) {
        case 0:
          return "file";
        case 1:
          return "link";
        case 2:
          return "symlink";
        case 3:
          return "character-device";
        case 4:
          return "block-device";
        case 5:
          return "directory";
        case 6:
          return "fifo";
        case 7:
          return "contiguous-file";
        case 72:
          return "pax-header";
        case 55:
          return "pax-global-header";
        case 27:
          return "gnu-long-link-path";
        case 28:
        case 30:
          return "gnu-long-path";
      }
      return null;
    }
    function toTypeflag(flag) {
      switch (flag) {
        case "file":
          return 0;
        case "link":
          return 1;
        case "symlink":
          return 2;
        case "character-device":
          return 3;
        case "block-device":
          return 4;
        case "directory":
          return 5;
        case "fifo":
          return 6;
        case "contiguous-file":
          return 7;
        case "pax-header":
          return 72;
      }
      return 0;
    }
    function indexOf(block, num, offset, end) {
      for (; offset < end; offset++) {
        if (block[offset] === num) return offset;
      }
      return end;
    }
    function cksum(block) {
      let sum = 8 * 32;
      for (let i = 0; i < 148; i++) sum += block[i];
      for (let j = 156; j < 512; j++) sum += block[j];
      return sum;
    }
    function encodeOct(val, n) {
      val = val.toString(8);
      if (val.length > n) return SEVENS.slice(0, n) + " ";
      return ZEROS.slice(0, n - val.length) + val + " ";
    }
    function encodeSizeBin(num, buf, off) {
      buf[off] = 128;
      for (let i = 11; i > 0; i--) {
        buf[off + i] = num & 255;
        num = Math.floor(num / 256);
      }
    }
    function encodeSize(num, buf, off) {
      if (num.toString(8).length > 11) {
        encodeSizeBin(num, buf, off);
      } else {
        b4a.write(buf, encodeOct(num, 11), off);
      }
    }
    function parse256(buf) {
      let positive;
      if (buf[0] === 128) positive = true;
      else if (buf[0] === 255) positive = false;
      else return null;
      const tuple = [];
      let i;
      for (i = buf.length - 1; i > 0; i--) {
        const byte = buf[i];
        if (positive) tuple.push(byte);
        else tuple.push(255 - byte);
      }
      let sum = 0;
      const l = tuple.length;
      for (i = 0; i < l; i++) {
        sum += tuple[i] * Math.pow(256, i);
      }
      return positive ? sum : -1 * sum;
    }
    function decodeOct(val, offset, length) {
      val = val.subarray(offset, offset + length);
      offset = 0;
      if (val[offset] & 128) {
        return parse256(val);
      } else {
        while (offset < val.length && val[offset] === 32) offset++;
        const end = clamp(indexOf(val, 32, offset, val.length), val.length, val.length);
        while (offset < end && val[offset] === 0) offset++;
        if (end === offset) return 0;
        return parseInt(b4a.toString(val.subarray(offset, end)), 8);
      }
    }
    function decodeStr(val, offset, length, encoding) {
      return b4a.toString(val.subarray(offset, indexOf(val, 0, offset, offset + length)), encoding);
    }
    function addLength(str) {
      const len = b4a.byteLength(str);
      let digits = Math.floor(Math.log(len) / Math.log(10)) + 1;
      if (len + digits >= Math.pow(10, digits)) digits++;
      return len + digits + str;
    }
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/tar-stream/extract.js
var require_extract = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/tar-stream/extract.js"(exports2, module2) {
    var { Writable, Readable, getStreamError } = require_streamx();
    var FIFO = require_fast_fifo();
    var b4a = require_b4a();
    var headers = require_headers();
    var EMPTY = b4a.alloc(0);
    var MAX_HEADER_SIZE = 4 * 1024 * 1024;
    var BufferList = class {
      constructor() {
        this.buffered = 0;
        this.shifted = 0;
        this.queue = new FIFO();
        this._offset = 0;
      }
      push(buffer) {
        this.buffered += buffer.byteLength;
        this.queue.push(buffer);
      }
      shiftFirst(size) {
        return this.buffered === 0 ? null : this._next(size);
      }
      shift(size) {
        if (size > this.buffered) return null;
        if (size === 0) return EMPTY;
        let chunk = this._next(size);
        if (size === chunk.byteLength) return chunk;
        const chunks = [chunk];
        while ((size -= chunk.byteLength) > 0) {
          chunk = this._next(size);
          chunks.push(chunk);
        }
        return b4a.concat(chunks);
      }
      _next(size) {
        const buf = this.queue.peek();
        const rem = buf.byteLength - this._offset;
        if (size >= rem) {
          const sub = this._offset ? buf.subarray(this._offset, buf.byteLength) : buf;
          this.queue.shift();
          this._offset = 0;
          this.buffered -= rem;
          this.shifted += rem;
          return sub;
        }
        this.buffered -= size;
        this.shifted += size;
        return buf.subarray(this._offset, this._offset += size);
      }
    };
    var Source = class extends Readable {
      constructor(self, header, offset) {
        super();
        this.header = header;
        this.offset = offset;
        this._parent = self;
      }
      _read(cb) {
        if (this.header.size === 0) {
          this.push(null);
        }
        if (this._parent._stream === this) {
          this._parent._update();
        }
        cb(null);
      }
      _predestroy() {
        this._parent.destroy(getStreamError(this));
      }
      _detach() {
        if (this._parent._stream === this) {
          this._parent._stream = null;
          this._parent._missing = overflow(this.header.size);
          this._parent._update();
        }
      }
      _destroy(cb) {
        this._detach();
        cb(null);
      }
    };
    var Extract = class extends Writable {
      constructor(opts) {
        super(opts);
        if (!opts) opts = {};
        this._buffer = new BufferList();
        this._offset = 0;
        this._header = null;
        this._stream = null;
        this._missing = 0;
        this._longHeader = false;
        this._callback = noop;
        this._locked = false;
        this._finished = false;
        this._pax = null;
        this._paxGlobal = null;
        this._gnuLongPath = null;
        this._gnuLongLinkPath = null;
        this._filenameEncoding = opts.filenameEncoding || "utf-8";
        this._allowUnknownFormat = !!opts.allowUnknownFormat;
        this._unlockBound = this._unlock.bind(this);
      }
      _unlock(err) {
        this._locked = false;
        if (err) {
          this.destroy(err);
          this._continueWrite(err);
          return;
        }
        this._update();
      }
      _consumeHeader() {
        if (this._locked) return false;
        this._offset = this._buffer.shifted;
        try {
          this._header = headers.decode(this._buffer.shift(512), this._filenameEncoding, this._allowUnknownFormat);
        } catch (err) {
          this._continueWrite(err);
          return false;
        }
        if (!this._header) return true;
        this._header.byteOffset = this._buffer.shifted;
        switch (this._header.type) {
          case "gnu-long-path":
          case "gnu-long-link-path":
          case "pax-global-header":
          case "pax-header":
            this._longHeader = true;
            this._missing = this._header.size;
            if (this._missing > MAX_HEADER_SIZE) {
              this._continueWrite(new Error("Header exceeds max size"));
              return false;
            }
            return true;
        }
        this._locked = true;
        this._applyLongHeaders();
        if (!(this._header.size >= 0)) {
          this._continueWrite(new Error("Invalid header"));
          return false;
        }
        if (this._header.size === 0 || this._header.type === "directory") {
          this.emit("entry", this._header, this._createStream(), this._unlockBound);
          return true;
        }
        this._stream = this._createStream();
        this._missing = this._header.size;
        this.emit("entry", this._header, this._stream, this._unlockBound);
        return true;
      }
      _applyLongHeaders() {
        if (this._gnuLongPath) {
          this._header.name = this._gnuLongPath;
          this._gnuLongPath = null;
        }
        if (this._gnuLongLinkPath) {
          this._header.linkname = this._gnuLongLinkPath;
          this._gnuLongLinkPath = null;
        }
        if (this._pax) {
          if (this._pax.path) this._header.name = this._pax.path;
          if (this._pax.linkpath) this._header.linkname = this._pax.linkpath;
          if (this._pax.size) this._header.size = parseInt(this._pax.size, 10);
          this._header.pax = this._pax;
          this._pax = null;
        }
      }
      _decodeLongHeader(buf) {
        switch (this._header.type) {
          case "gnu-long-path":
            this._gnuLongPath = headers.decodeLongPath(buf, this._filenameEncoding);
            break;
          case "gnu-long-link-path":
            this._gnuLongLinkPath = headers.decodeLongPath(buf, this._filenameEncoding);
            break;
          case "pax-global-header":
            this._paxGlobal = headers.decodePax(buf);
            break;
          case "pax-header":
            this._pax = this._paxGlobal === null ? headers.decodePax(buf) : Object.assign({}, this._paxGlobal, headers.decodePax(buf));
            break;
        }
      }
      _consumeLongHeader() {
        this._longHeader = false;
        this._missing = overflow(this._header.size);
        const buf = this._buffer.shift(this._header.size);
        try {
          this._decodeLongHeader(buf);
        } catch (err) {
          this._continueWrite(err);
          return false;
        }
        return true;
      }
      _consumeStream() {
        const buf = this._buffer.shiftFirst(this._missing);
        if (buf === null) return false;
        this._missing -= buf.byteLength;
        const drained = this._stream.push(buf);
        if (this._missing === 0) {
          this._stream.push(null);
          if (drained) this._stream._detach();
          return drained && this._locked === false;
        }
        return drained;
      }
      _createStream() {
        return new Source(this, this._header, this._offset);
      }
      _update() {
        while (this._buffer.buffered > 0 && !this.destroying) {
          if (this._missing > 0) {
            if (this._stream !== null) {
              if (this._consumeStream() === false) return;
              continue;
            }
            if (this._longHeader === true) {
              if (this._missing > this._buffer.buffered) break;
              if (this._consumeLongHeader() === false) return false;
              continue;
            }
            const ignore = this._buffer.shiftFirst(this._missing);
            if (ignore !== null) this._missing -= ignore.byteLength;
            continue;
          }
          if (this._buffer.buffered < 512) break;
          if (this._stream !== null || this._consumeHeader() === false) return;
        }
        this._continueWrite(null);
      }
      _continueWrite(err) {
        const cb = this._callback;
        this._callback = noop;
        cb(err);
      }
      _write(data, cb) {
        this._callback = cb;
        this._buffer.push(data);
        this._update();
      }
      _final(cb) {
        this._finished = this._missing === 0 && this._buffer.buffered === 0;
        cb(this._finished ? null : new Error("Unexpected end of data"));
      }
      _predestroy() {
        this._continueWrite(null);
      }
      _destroy(cb) {
        if (this._stream) this._stream.destroy(getStreamError(this));
        cb(null);
      }
      [Symbol.asyncIterator]() {
        let error = null;
        let promiseResolve = null;
        let promiseReject = null;
        let entryStream = null;
        let entryCallback = null;
        const extract = this;
        this.on("entry", onentry);
        this.on("error", (err) => {
          error = err;
        });
        this.on("close", onclose);
        return {
          [Symbol.asyncIterator]() {
            return this;
          },
          next() {
            return new Promise(onnext);
          },
          return() {
            return destroy(null);
          },
          throw(err) {
            return destroy(err);
          }
        };
        function consumeCallback(err) {
          if (!entryCallback) return;
          const cb = entryCallback;
          entryCallback = null;
          cb(err);
        }
        function onnext(resolve, reject) {
          if (error) {
            return reject(error);
          }
          if (entryStream) {
            resolve({ value: entryStream, done: false });
            entryStream = null;
            return;
          }
          promiseResolve = resolve;
          promiseReject = reject;
          consumeCallback(null);
          if (extract._finished && promiseResolve) {
            promiseResolve({ value: void 0, done: true });
            promiseResolve = promiseReject = null;
          }
        }
        function onentry(header, stream, callback) {
          entryCallback = callback;
          stream.on("error", noop);
          if (promiseResolve) {
            promiseResolve({ value: stream, done: false });
            promiseResolve = promiseReject = null;
          } else {
            entryStream = stream;
          }
        }
        function onclose() {
          consumeCallback(error);
          if (!promiseResolve) return;
          if (error) promiseReject(error);
          else promiseResolve({ value: void 0, done: true });
          promiseResolve = promiseReject = null;
        }
        function destroy(err) {
          extract.destroy(err);
          consumeCallback(err);
          return new Promise((resolve, reject) => {
            if (extract.destroyed) return resolve({ value: void 0, done: true });
            extract.once("close", function() {
              if (err) reject(err);
              else resolve({ value: void 0, done: true });
            });
          });
        }
      }
    };
    module2.exports = function extract(opts) {
      return new Extract(opts);
    };
    function noop() {
    }
    function overflow(size) {
      size &= 511;
      return size && 512 - size;
    }
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/tar-stream/constants.js
var require_constants = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/tar-stream/constants.js"(exports2, module2) {
    var constants = {
      // just for envs without fs
      S_IFMT: 61440,
      S_IFDIR: 16384,
      S_IFCHR: 8192,
      S_IFBLK: 24576,
      S_IFIFO: 4096,
      S_IFLNK: 40960
    };
    try {
      module2.exports = require("fs").constants || constants;
    } catch {
      module2.exports = constants;
    }
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/tar-stream/pack.js
var require_pack = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/tar-stream/pack.js"(exports2, module2) {
    var { Readable, Writable, getStreamError } = require_streamx();
    var b4a = require_b4a();
    var constants = require_constants();
    var headers = require_headers();
    var DMODE = 493;
    var FMODE = 420;
    var END_OF_TAR = b4a.alloc(1024);
    var Sink = class extends Writable {
      constructor(pack, header, callback) {
        super({ mapWritable, eagerOpen: true });
        this.written = 0;
        this.header = header;
        this._callback = callback;
        this._linkname = null;
        this._isLinkname = header.type === "symlink" && !header.linkname;
        this._isVoid = header.type !== "file" && header.type !== "contiguous-file";
        this._finished = false;
        this._pack = pack;
        this._openCallback = null;
        if (this._pack._stream === null) this._pack._stream = this;
        else this._pack._pending.push(this);
      }
      _open(cb) {
        this._openCallback = cb;
        if (this._pack._stream === this) this._continueOpen();
      }
      _continuePack(err) {
        if (this._callback === null) return;
        const callback = this._callback;
        this._callback = null;
        callback(err);
      }
      _continueOpen() {
        if (this._pack._stream === null) this._pack._stream = this;
        const cb = this._openCallback;
        this._openCallback = null;
        if (cb === null) return;
        if (this._pack.destroying) return cb(new Error("pack stream destroyed"));
        if (this._pack._finalized) return cb(new Error("pack stream is already finalized"));
        this._pack._stream = this;
        if (!this._isLinkname) {
          this._pack._encode(this.header);
        }
        if (this._isVoid) {
          this._finish();
          this._continuePack(null);
        }
        cb(null);
      }
      _write(data, cb) {
        if (this._isLinkname) {
          this._linkname = this._linkname ? b4a.concat([this._linkname, data]) : data;
          return cb(null);
        }
        if (this._isVoid) {
          if (data.byteLength > 0) {
            return cb(new Error("No body allowed for this entry"));
          }
          return cb();
        }
        this.written += data.byteLength;
        if (this._pack.push(data)) return cb();
        this._pack._drain = cb;
      }
      _finish() {
        if (this._finished) return;
        this._finished = true;
        if (this._isLinkname) {
          this.header.linkname = this._linkname ? b4a.toString(this._linkname, "utf-8") : "";
          this._pack._encode(this.header);
        }
        overflow(this._pack, this.header.size);
        this._pack._done(this);
      }
      _final(cb) {
        if (this.written !== this.header.size) {
          return cb(new Error("Size mismatch"));
        }
        this._finish();
        cb(null);
      }
      _getError() {
        return getStreamError(this) || new Error("tar entry destroyed");
      }
      _predestroy() {
        this._pack.destroy(this._getError());
      }
      _destroy(cb) {
        this._pack._done(this);
        this._continuePack(this._finished ? null : this._getError());
        cb();
      }
    };
    var Pack = class extends Readable {
      constructor(opts) {
        super(opts);
        this._drain = noop;
        this._finalized = false;
        this._finalizing = false;
        this._pending = [];
        this._stream = null;
      }
      entry(header, buffer, callback) {
        if (this._finalized || this.destroying) throw new Error("already finalized or destroyed");
        if (typeof buffer === "function") {
          callback = buffer;
          buffer = null;
        }
        if (!callback) callback = noop;
        if (!header.size || header.type === "symlink") header.size = 0;
        if (!header.type) header.type = modeToType(header.mode);
        if (!header.mode) header.mode = header.type === "directory" ? DMODE : FMODE;
        if (!header.uid) header.uid = 0;
        if (!header.gid) header.gid = 0;
        if (!header.mtime) header.mtime = /* @__PURE__ */ new Date();
        if (typeof buffer === "string") buffer = b4a.from(buffer);
        const sink = new Sink(this, header, callback);
        if (b4a.isBuffer(buffer)) {
          header.size = buffer.byteLength;
          sink.write(buffer);
          sink.end();
          return sink;
        }
        if (sink._isVoid) {
          return sink;
        }
        return sink;
      }
      finalize() {
        if (this._stream || this._pending.length > 0) {
          this._finalizing = true;
          return;
        }
        if (this._finalized) return;
        this._finalized = true;
        this.push(END_OF_TAR);
        this.push(null);
      }
      _done(stream) {
        if (stream !== this._stream) return;
        this._stream = null;
        if (this._finalizing) this.finalize();
        if (this._pending.length) this._pending.shift()._continueOpen();
      }
      _encode(header) {
        if (!header.pax) {
          const buf = headers.encode(header);
          if (buf) {
            this.push(buf);
            return;
          }
        }
        this._encodePax(header);
      }
      _encodePax(header) {
        const paxHeader = headers.encodePax({
          name: header.name,
          linkname: header.linkname,
          pax: header.pax
        });
        const newHeader = {
          name: "PaxHeader",
          mode: header.mode,
          uid: header.uid,
          gid: header.gid,
          size: paxHeader.byteLength,
          mtime: header.mtime,
          type: "pax-header",
          linkname: header.linkname && "PaxHeader",
          uname: header.uname,
          gname: header.gname,
          devmajor: header.devmajor,
          devminor: header.devminor
        };
        this.push(headers.encode(newHeader));
        this.push(paxHeader);
        overflow(this, paxHeader.byteLength);
        newHeader.size = header.size;
        newHeader.type = header.type;
        this.push(headers.encode(newHeader));
      }
      _doDrain() {
        const drain = this._drain;
        this._drain = noop;
        drain();
      }
      _predestroy() {
        const err = getStreamError(this);
        if (this._stream) this._stream.destroy(err);
        while (this._pending.length) {
          const stream = this._pending.shift();
          stream.destroy(err);
          stream._continueOpen();
        }
        this._doDrain();
      }
      _read(cb) {
        this._doDrain();
        cb();
      }
    };
    module2.exports = function pack(opts) {
      return new Pack(opts);
    };
    function modeToType(mode) {
      switch (mode & constants.S_IFMT) {
        case constants.S_IFBLK:
          return "block-device";
        case constants.S_IFCHR:
          return "character-device";
        case constants.S_IFDIR:
          return "directory";
        case constants.S_IFIFO:
          return "fifo";
        case constants.S_IFLNK:
          return "symlink";
      }
      return "file";
    }
    function noop() {
    }
    function overflow(self, size) {
      size &= 511;
      if (size) self.push(END_OF_TAR.subarray(0, 512 - size));
    }
    function mapWritable(buf) {
      return b4a.isBuffer(buf) ? buf : b4a.from(buf);
    }
  }
});

// ../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/tar-stream/index.js
var require_tar_stream = __commonJS({
  "../Eva-0.1.17-Source-20261029-094504/Eva-Source/node_modules/tar-stream/index.js"(exports2) {
    exports2.extract = require_extract();
    exports2.pack = require_pack();
  }
});

// migration/desktop-extensions/src/renderer/native-plugin-add/original-hosted-service.mjs
function bindOriginalComponent(deps = {}) {
  const { e, t, n, r, i, a, s, u, p, m, _, S, le, ue, A, P, R, G, K, $ } = deps;
  function qe(e2, t2, n2) {
    if (e2 === `tunnel`) {
      let e3 = n2.trim();
      return /^tunnel_(?:[a-z0-9]{4}_)?[a-z0-9]{32}$/.test(e3) ? { tunnel_id: e3 } : null;
    }
    let r2 = t2.trim();
    if (!/^https?:\/\/[^/?#\s@\\]+(?:[/?#]|$)/i.test(r2) || new RegExp("[\\s\\\\]|\\p{Cc}", "u").test(r2)) return null;
    try {
      let e3 = new URL(r2);
      return (e3.protocol === `http:` || e3.protocol === `https:`) && e3.hostname && !e3.username && !e3.password ? { mcp_url: r2 } : null;
    } catch {
      return null;
    }
  }
  async function Je(e2) {
    return (await P.safeGet(`/aip/connectors/mcp/tunnels`, { surface: `plugin_management`, additionalHeaders: K(e2) })).tunnels ?? [];
  }
  function Ye(e2) {
    return e2.size <= 10240 && (e2.type.toLowerCase() === `image/png` || e2.name.toLowerCase().endsWith(`.png`));
  }
  async function Xe(e2) {
    if (e2.icon != null && !Ye(e2.icon)) throw new G(`invalid-icon`);
    let t2 = { supported_auth: [] };
    if ((e2.authentication === `NONE` || e2.authentication === `MIXED`) && t2.supported_auth?.push({ type: `NONE` }), e2.authentication === `API_KEY` && t2.supported_auth?.push({ type: `API_KEY`, header_scheme: e2.apiKeyHeader === `CUSTOM_HEADER` ? { type: `CUSTOM_HEADER`, header_name: e2.customHeaderName.trim() } : { type: e2.apiKeyHeader } }), e2.authentication === `OAUTH` || e2.authentication === `MIXED`) {
      let n3 = e2.oauthSettings, r3 = n3?.supportsPkceS256 && !n3.config.pkce_methods?.length, i3 = n3 == null ? await Qe(e2.accountId, e2.target) : { ...n3.config, pkce_required: r3 ? true : n3.config.pkce_required, pkce_methods: r3 ? [`S256`] : n3.config.pkce_methods, authorization_url: n3.config.authorization_url.trim(), token_url: n3.config.token_url.trim(), registration_url: n3.config.registration_url?.trim() || null, authorization_server_base: n3.config.authorization_server_base?.trim() || null, authorization_response_iss_parameter_supported: n3.config.authorization_response_iss_parameter_supported === true ? !!n3.config.authorization_server_base?.trim() : n3.config.authorization_response_iss_parameter_supported, resource: n3.config.resource?.trim() || null, base_scopes: W(n3.baseScopes), oidc_configuration_url: n3.config.oidc_configuration_url?.trim() || null, oidc_userinfo_endpoint: n3.config.oidc_userinfo_endpoint?.trim() || null, oidc_scopes_supported: W(n3.oidcScopes), token_endpoint_auth_methods_supported: n3.discovered ? n3.config.token_endpoint_auth_methods_supported : [n3.tokenAuthMethod], supports_domain_restriction: false };
      if (i3 == null) throw new G(`oauth-unavailable`);
      if (!i3.authorization_url || !i3.token_url) throw new G(`invalid-oauth-endpoints`);
      for (let e3 of [i3.authorization_url, i3.token_url, i3.registration_url, i3.authorization_server_base, i3.oidc_configuration_url, i3.oidc_userinfo_endpoint]) if (e3 && qe(`url`, e3, ``) == null) throw new G(`invalid-oauth-url`);
      t2.supported_auth?.push(i3);
      let a2 = et(i3, n3?.clientMode);
      if (a2 === `USER_DEFINED`) {
        if (n3?.clientId.trim()) t2.oauth_client_params = { client_id: n3.clientId.trim(), client_secret: n3.clientSecret.trim(), token_endpoint_auth_method: rt(nt(n3)) };
        else {
          if (n3?.clientSecret.trim()) throw new G(`oauth-client-id-required`);
          let t3 = `mcp_url` in e2.target ? new URL(e2.target.mcp_url).origin : null;
          if (!(e2.hasPreconfiguredOAuthClient ?? (t3 != null && await it(e2.accountId, t3)))) throw new G(`oauth-client-id-required`);
        }
      }
      if (n3 != null) {
        t2.use_cimd = a2 === `USER_DEFINED` ? void 0 : a2 === `CIMD`, t2.oidc_enabled = !!i3.oidc_configuration_url && n3.oidcEnabled;
        let e3 = W(n3.scopes);
        t2.default_scopes = n3.discovered ? e3.filter((e4) => i3.scopes_supported?.includes(e4)) : e3;
      }
    }
    let n2 = e2.icon, r2 = n2 == null ? null : await new Promise((e3, t3) => {
      let r3 = new FileReader();
      r3.onload = () => typeof r3.result == `string` ? e3(r3.result) : t3(new G(`icon-read-failed`)), r3.onerror = () => t3(new G(`icon-read-failed`)), r3.readAsDataURL(n2);
    }), { connector: i2 } = await P.safePost(`/aip/connectors/mcp`, { surface: `plugin_management`, additionalHeaders: K(e2.accountId), requestBody: { name: e2.name.trim(), description: e2.description.trim(), ...e2.target, logo_url: r2, auth_request: t2 }, expectedErrorStatuses: [400, 401, 403, 409, 413, 422, 424, 429] });
    return i2;
  }
  function Ze(e2) {
    if (e2 instanceof G) return e2.code;
    if (!(e2 instanceof R)) return null;
    if (e2.errorKind === `network`) return `network-error`;
    if (e2.errorCode === `tunnel_client_network_access_denied`) return `tunnel-network-denied`;
    let t2;
    try {
      t2 = m({ detail: ue() }).parse(JSON.parse(e2.message)).detail;
    } catch {
    }
    let n2 = A([le(), m({ message: le() }).transform((e3) => e3.message)]).safeParse(t2).data;
    if (e2.status === 403 && n2 === `Developer mode is required`) return `developer-mode-required`;
    if (e2.status === 409 && n2 != null && /^Connector with name '[\s\S]*' already exists$/.test(n2)) return `name-already-exists`;
    if (e2.status === 400 && n2 != null && (n2 === `Failed to resolve OAuth client` || /^The server \S+ doesn't support (usable CIMD or RFC 7591 Dynamic Client Registration|RFC 7591 Dynamic Client Registration)$/.test(n2))) return `oauth-registration-failed`;
    let r2 = m({ type: i(`mcp_error`), kind: s([`http`, `network`, `json_rpc`, `invalid_response`]), upstream_status: p().int().min(100).max(599).nullish(), upstream_error_code: le().nullish() }).safeParse(t2);
    if (e2.status === 424 && r2.success) {
      switch (r2.data.upstream_error_code) {
        case `tunnel_client_network_access_denied`:
          return `tunnel-network-denied`;
        case `tunnel_client_not_seen`:
        case `tunnel_client_not_connected`:
          return `tunnel-unavailable`;
        case null:
        case void 0:
      }
      if (r2.data.kind === `network`) return `server-unreachable`;
      if (r2.data.kind === `http` || r2.data.kind === `invalid_response`) {
        switch (r2.data.upstream_status) {
          case 401:
          case 403:
            return `server-auth-rejected`;
          case 404:
            return `server-not-found`;
          case 413:
            return `request-too-large`;
          case 429:
            return `rate-limited`;
          case null:
          case void 0:
        }
        if (r2.data.upstream_status != null && r2.data.upstream_status >= 500) return `service-unavailable`;
      }
      return `invalid-server-response`;
    }
    switch (e2.status) {
      case 400:
      case 422:
        return `invalid-configuration`;
      case 401:
        return `sign-in-required`;
      case 403:
        return `custom-app-not-allowed`;
      case 413:
        return `request-too-large`;
      case 429:
        return `rate-limited`;
    }
    return e2.status >= 500 && e2.status <= 599 ? `service-unavailable` : null;
  }
  async function Qe(e2, t2, n2) {
    return (await P.safePost(`/aip/connectors/mcp/oauth_config`, { surface: `plugin_management`, additionalHeaders: K(e2), requestBody: t2, expectedErrorStatuses: [400, 401, 403, 404, 413, 422, 424, 429], signal: n2 }).catch((e3) => {
      if (e3 instanceof R && e3.status === 404) return null;
      throw e3;
    }))?.oauth_config ?? null;
  }
  function $e(e2) {
    let t2 = et(e2), n2 = (e2?.token_endpoint_auth_methods_supported ?? []).map((e3) => e3.trim()).filter(Boolean).sort((e3, t3) => e3.localeCompare(t3));
    return { config: e2 ?? { type: `OAUTH`, authorization_url: ``, token_url: `` }, discovered: e2 != null, supportsPkceS256: false, clientMode: t2, clientId: ``, clientSecret: ``, tokenAuthMethod: t2 === `USER_DEFINED` ? `none` : [`none`, `client_secret_post`, `client_secret_basic`].find((e3) => n2.includes(e3)) ?? n2[0] ?? `none`, scopes: (e2?.scopes_supported ?? []).join(`
`), baseScopes: (e2?.base_scopes ?? []).join(`
`), oidcScopes: (e2?.oidc_scopes_supported ?? []).join(`
`), oidcEnabled: !!e2?.oidc_configuration_url };
  }
  function et(e2, t2) {
    return t2 === `USER_DEFINED` || t2 === `DCR` && e2?.registration_url?.trim() || t2 === `CIMD` && e2?.client_id_metadata_document_supported ? t2 : e2?.client_id_metadata_document_supported ? `CIMD` : e2?.registration_url?.trim() ? `DCR` : `USER_DEFINED`;
  }
  function tt(e2) {
    return [...new Set([...e2.config.token_endpoint_auth_methods_supported ?? [], `none`, `client_secret_post`, `client_secret_basic`].map((e3) => e3.trim()).filter(Boolean))].filter((t2) => !e2.clientSecret.trim() || t2 === `none` || t2 === `client_secret_post` || t2 === `client_secret_basic`).sort((e3, t2) => e3 === `none` ? -1 : t2 === `none` ? 1 : e3.localeCompare(t2));
  }
  function nt(e2) {
    return e2.clientSecret.trim() ? e2.tokenAuthMethod === `client_secret_basic` ? `client_secret_basic` : `client_secret_post` : tt(e2).includes(e2.tokenAuthMethod) ? e2.tokenAuthMethod : `none`;
  }
  function rt(e2) {
    switch (e2) {
      case `none`:
      case `client_secret_post`:
      case `client_secret_basic`:
      case `private_key_jwt`:
        return e2;
      default:
        return;
    }
  }
  async function it(e2, t2, n2) {
    let { oauth_clients: r2 } = await P.safeGet(`/aip/connectors/oauth_clients`, { surface: `plugin_management`, additionalHeaders: K(e2), parameters: { query: { service: t2 } }, signal: n2 });
    return !!r2?.length;
  }
  function W(e2) {
    return [...new Set(e2.split(/\r?\n|,/).map((e3) => e3.trim()).filter(Boolean))];
  }
  function at(e2, t2) {
    let n2 = new URL(e2), r2 = n2.protocol === `http:` || n2.protocol === `https:` ? n2.origin : `https://chatgpt.com`;
    return { redirect: new URL(t2 == null ? `/connector_platform_oauth_redirect` : `/connector/oauth/${encodeURIComponent(t2)}`, r2).href, metadata: new URL(t2 == null ? `/oauth/client.json` : `/oauth/${encodeURIComponent(t2)}/client.json`, r2).href };
  }
  return { qe, Je, Ye, Xe, Ze, Qe, $e, et, tt, nt, rt, it, W, at };
}
var init_original_hosted_service = __esm({
  "migration/desktop-extensions/src/renderer/native-plugin-add/original-hosted-service.mjs"() {
  }
});

// migration/desktop-extensions/src/renderer/native-plugin-add/original-archive-service.mjs
function bindOriginalComponent2(deps = {}) {
  const { __vite__mapDeps, e, t, n, r, i, a, o, s, c, u } = deps;
  function d(e2) {
    return /\.(zip|tar\.gz|tgz)$/i.test(e2.name) ? e2.size > 104857600 ? `size` : null : `type`;
  }
  async function f(e2, t2, n2) {
    return (await p(e2, t2, n2))?.can_refresh_from_source === false;
  }
  async function p(e2, t2, n2) {
    let r2;
    do {
      let i2 = await o.safeGet(`/ps/plugins/workspace/created`, { surface: `plugin_management`, additionalHeaders: { "ChatGPT-Account-Id": t2 }, parameters: { query: { limit: 100, pageToken: r2 } }, signal: n2, expectedErrorStatuses: [403, 404] }), a2 = i2.plugins.find(({ id: t3 }) => t3 === e2);
      if (a2 != null) return a2;
      r2 = i2.pagination.next_page_token ?? void 0;
    } while (r2 != null);
    return null;
  }
  async function m(e2, t2, n2) {
    let r2 = await g(t2, n2, e2);
    await o.safePost(`/public/plugins/workspace/{plugin_id}`, { surface: `plugin_management`, additionalHeaders: { "ChatGPT-Account-Id": t2 }, parameters: { path: { plugin_id: e2 } }, requestBody: r2, expectedErrorStatuses: [400, 403, 409, 422] });
  }
  async function h(e2, t2) {
    let n2 = await g(e2, t2);
    return (await o.safePost(`/public/plugins/workspace`, { surface: `plugin_management`, additionalHeaders: { "ChatGPT-Account-Id": e2 }, requestBody: n2, expectedErrorStatuses: [400, 403, 409, 422] })).plugin_id;
  }
  async function g(e2, t2, r2) {
    if (d(t2) != null) throw Error(`Invalid plugin archive`);
    let { uploadChatGptFileBytes: i2 } = await n(async () => {
      let { uploadChatGptFileBytes: e3 } = await import("./chatgpt-file-upload-502fb0ac54f8.js");
      return { uploadChatGptFileBytes: e3 };
    }, __vite__mapDeps([0, 1, 2, 3, 4, 5]), import_meta.url), a2 = t2.name.toLowerCase().endsWith(`.zip`) ? `application/zip` : `application/gzip`;
    for (let n2 = 0; n2 < 2; n2 += 1) {
      let s2 = await o.safePost(`/public/plugins/workspace/upload-url`, { surface: `plugin_management`, additionalHeaders: { "ChatGPT-Account-Id": e2 }, requestBody: { filename: t2.name, mime_type: a2, size_bytes: t2.size, ...r2 == null ? {} : { plugin_id: r2 } }, expectedErrorStatuses: [400, 403, 409, 413, 422] });
      if (!s2.etag) throw Error(`Plugin upload session is missing an etag`);
      try {
        await i2(void 0, { fileId: s2.file_id, file: t2, fileName: t2.name, contentType: a2, uploadUrl: s2.upload_url });
      } catch (e3) {
        if (n2 === 0 && e3 instanceof u && e3.status === 403) continue;
        throw e3;
      }
      return { file_id: s2.file_id, etag: s2.etag };
    }
    throw Error(`Plugin upload failed`);
  }
  async function _(e2, t2) {
    let n2 = await s.getInstance().fetch(`/ps/plugins/${encodeURIComponent(e2)}/archive`, { headers: { "ChatGPT-Account-Id": t2, [r]: `plugin_management` } });
    c(await n2.blob(), `plugin.zip`);
  }
  return { d, f, p, m, h, g, _ };
}
var import_meta;
var init_original_archive_service = __esm({
  "migration/desktop-extensions/src/renderer/native-plugin-add/original-archive-service.mjs"() {
    import_meta = {};
  }
});

// migration/desktop-extensions/src/renderer/native-plugin-add/original-marketplace-service.mjs
function bindOriginalComponent3(deps = {}) {
  const { e, r } = deps;
  function t(e2) {
    let t2 = e2.source.trim();
    if (t2.length === 0) return null;
    let n2 = e2.refName.trim(), r2 = e2.sparsePaths.split(/[\n,]+/).map((e3) => e3.trim()).filter((e3) => e3.length > 0);
    return { source: t2, refName: n2.length > 0 ? n2 : null, sparsePaths: r2.length > 0 ? r2 : null };
  }
  async function n({ forceReloadPlugins: e2, onReloadError: t2, params: n2, sendAddMarketplace: r2 }) {
    let i = await r2(n2);
    try {
      await e2();
    } catch (e3) {
      return t2(e3), { kind: `reload-failed`, marketplaceName: i.marketplaceName };
    }
    return { alreadyAdded: i.alreadyAdded, kind: `added`, marketplaceName: i.marketplaceName };
  }
  return { t, n };
}
var init_original_marketplace_service = __esm({
  "migration/desktop-extensions/src/renderer/native-plugin-add/original-marketplace-service.mjs"() {
  }
});

// migration/desktop-extensions/src/renderer/native-plugin-add/service-adapter.mjs
var service_adapter_exports = {};
__export(service_adapter_exports, {
  createPluginAddServices: () => createPluginAddServices
});
function createPluginAddServices(transport) {
  for (const key of ["safeGet", "safePost", "headersForAccount"]) if (typeof transport[key] !== "function") throw new TypeError("Missing authenticated plugin transport: " + key);
  const boundary = {
    P: transport,
    K: transport.headersForAccount,
    R: transport.HttpError,
    G: class PluginConfigurationError extends Error {
      constructor(code) {
        super(code);
        this.code = code;
      }
    },
    // Error decoding is source-bound to the caller's original schema library.
    ...transport.originalErrorSchemaBindings
  };
  const mcp = bindOriginalComponent(boundary);
  const archive = bindOriginalComponent2({
    o: transport,
    u: transport.HttpError,
    n: async () => {
      if (typeof transport.uploadChatGptFileBytes !== "function") throw Error("Authenticated archive byte upload is unavailable");
      return { uploadChatGptFileBytes: transport.uploadChatGptFileBytes };
    },
    __vite__mapDeps: () => [],
    s: { getInstance: () => transport },
    c: transport.downloadBlob,
    r: transport.surfaceHeaderName
  });
  const market = bindOriginalComponent3();
  return {
    validateTarget: mcp.qe,
    validateIcon: mcp.Ye,
    validateArchive: archive.d,
    normalizeMarketplace: market.t,
    addMarketplace: market.n,
    listTunnels: mcp.Je,
    discoverOAuth: mcp.Qe,
    hasOAuthClient: mcp.it,
    initialOAuthSettings: mcp.$e,
    oauthClientMode: mcp.et,
    tokenAuthMethods: mcp.tt,
    tokenAuthMethod: mcp.nt,
    oauthRedirects: mcp.at,
    createMcp: mcp.Xe,
    uploadArchive: archive.h,
    replaceArchive: archive.m,
    findCreatedPlugin: archive.p,
    isRefreshableFromSource: archive.f,
    downloadArchive: archive._,
    // Ze needs the pinned schema bindings, deliberately never guessed.
    classifyMcpError: transport.originalErrorSchemaBindings ? mcp.Ze : void 0
  };
}
var init_service_adapter = __esm({
  "migration/desktop-extensions/src/renderer/native-plugin-add/service-adapter.mjs"() {
    init_original_hosted_service();
    init_original_archive_service();
    init_original_marketplace_service();
  }
});

// migration/desktop-extensions/src/main/local-plugin-authoring.js
var require_local_plugin_authoring = __commonJS({
  "migration/desktop-extensions/src/main/local-plugin-authoring.js"(exports2, module2) {
    "use strict";
    var fs = require("node:fs");
    var path = require("node:path");
    var crypto = require("node:crypto");
    var zlib = require("node:zlib");
    var { pipeline } = require("node:stream/promises");
    var MAX_ARCHIVE = 104857600;
    var MAX_EXPANDED = 268435456;
    var MAX_FILES = 1e4;
    function name(value) {
      if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)) throw Error("\u540D\u79F0\u53EA\u652F\u6301\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u548C\u8FDE\u5B57\u7B26");
      return value;
    }
    function relative(value) {
      if (typeof value !== "string" || !value || value.includes("\\") || value.includes("\0") || /^[a-zA-Z]:/.test(value) || value.startsWith("/")) throw Error("\u538B\u7F29\u5305\u5305\u542B\u4E0D\u5B89\u5168\u7684\u8DEF\u5F84");
      const pieces = value.split("/");
      if (pieces.includes("..")) throw Error("\u538B\u7F29\u5305\u5305\u542B\u8D8A\u754C\u8DEF\u5F84");
      return pieces.filter((x) => x && x !== ".").join("/");
    }
    async function extractArchive(file, destination) {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size > MAX_ARCHIVE || !/\.(zip|tar\.gz|tgz)$/i.test(file)) throw Error("\u8BF7\u9009\u62E9\u4E0D\u8D85\u8FC7 100 MB \u7684 ZIP\u3001TAR.GZ \u6216 TGZ \u63D2\u4EF6\u538B\u7F29\u5305");
      let total = 0, count = 0;
      const seen = /* @__PURE__ */ new Set();
      async function entry(raw, type, stream, declaredSize, permissions = 0) {
        const rel = relative(raw);
        if (!rel) return stream.resume();
        if (++count > MAX_FILES) throw Error("\u538B\u7F29\u5305\u6587\u4EF6\u8FC7\u591A");
        const key = rel.normalize("NFC").toLowerCase();
        if (seen.has(key)) throw Error("\u538B\u7F29\u5305\u5305\u542B\u91CD\u540D\u8DEF\u5F84");
        seen.add(key);
        if (!["file", "directory"].includes(type)) throw Error("\u63D2\u4EF6\u538B\u7F29\u5305\u4E0D\u652F\u6301\u7B26\u53F7\u94FE\u63A5\u3001\u786C\u94FE\u63A5\u6216\u7279\u6B8A\u6587\u4EF6");
        const target = path.join(destination, rel);
        if (type === "directory") {
          fs.mkdirSync(target, { recursive: true });
          stream.resume();
          return;
        }
        if (declaredSize > MAX_EXPANDED - total) throw Error("\u63D2\u4EF6\u89E3\u538B\u5927\u5C0F\u8D85\u8FC7 256 MB");
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const meter = new (require("node:stream")).Transform({ transform(chunk, _encoding, done) {
          total += chunk.length;
          if (total > MAX_EXPANDED) return done(Error("\u63D2\u4EF6\u89E3\u538B\u5927\u5C0F\u8D85\u8FC7 256 MB"));
          done(null, chunk);
        } });
        await pipeline(stream, meter, fs.createWriteStream(target, { flags: "wx", mode: permissions & 73 ? 448 : 384 }));
      }
      if (/\.zip$/i.test(file)) {
        const archive = await require_zip_reader().Open.file(file);
        for (const item of archive.files) {
          const mode = item.externalFileAttributes >>> 16 & 61440;
          if (mode && mode !== 32768 && mode !== 16384) throw Error("\u63D2\u4EF6\u538B\u7F29\u5305\u5305\u542B\u94FE\u63A5\u6216\u7279\u6B8A\u6587\u4EF6");
          await entry(item.path, item.type === "Directory" ? "directory" : "file", item.stream(), item.uncompressedSize, item.externalFileAttributes >>> 16);
        }
      } else {
        const archive = require_tar_stream().extract();
        let failure;
        archive.on("entry", (header, stream, next2) => {
          entry(header.name, header.type, stream, header.size, header.mode).then(() => next2(), (error) => {
            failure = error;
            archive.destroy(error);
          });
        });
        try {
          await pipeline(fs.createReadStream(file), zlib.createGunzip(), archive);
        } catch (error) {
          throw failure || error;
        }
      }
      return { files: count, bytes: total };
    }
    function pluginRoots(root) {
      const found = [];
      function visit(dir, depth) {
        if (depth > 3) return;
        if (fs.existsSync(path.join(dir, ".codex-plugin/plugin.json"))) {
          found.push(dir);
          return;
        }
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) if (item.isDirectory() && item.name !== ".git") visit(path.join(dir, item.name), depth + 1);
      }
      visit(root, 0);
      return found;
    }
    function validateManifest(root) {
      const file = path.join(root, ".codex-plugin/plugin.json"), manifest = JSON.parse(fs.readFileSync(file, "utf8"));
      name(manifest.name);
      for (const field of ["skills", "mcpServers", "hooks"]) {
        const values = typeof manifest[field] === "string" ? [manifest[field]] : Array.isArray(manifest[field]) ? manifest[field] : [];
        for (const value of values) if (typeof value === "string") relative(value);
      }
      return manifest;
    }
    function mcpConfig(input) {
      const key = name(input.name), config = { enabled: true };
      if (input.config) {
        if (typeof input.config !== "object" || Array.isArray(input.config)) throw Error("MCP \u914D\u7F6E\u683C\u5F0F\u9519\u8BEF");
        const value = Object.fromEntries(Object.entries(input.config).filter(([, v]) => v !== void 0)), allowed = /* @__PURE__ */ new Set(["command", "args", "env", "env_vars", "cwd", "url", "bearer_token_env_var", "http_headers", "env_http_headers", "enabled"]);
        if (typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((k) => !allowed.has(k))) throw Error("MCP \u914D\u7F6E\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5");
        if (value.url && value.command) throw Error("MCP \u5730\u5740\u548C\u547D\u4EE4\u4E0D\u53EF\u540C\u65F6\u8BBE\u7F6E");
        mcpConfig({ name: key, transport: value.url ? "http" : "stdio", url: value.url, bearerTokenEnvVar: value.bearer_token_env_var, command: value.command, args: value.args, env: value.env });
        for (const field of ["env_vars"]) if (value[field] != null && (!Array.isArray(value[field]) || value[field].some((v) => typeof v !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)))) throw Error("\u73AF\u5883\u53D8\u91CF\u540D\u79F0\u65E0\u6548");
        if (value.cwd != null && (typeof value.cwd !== "string" || !path.isAbsolute(value.cwd) || value.cwd.includes("\0"))) throw Error("MCP \u5DE5\u4F5C\u76EE\u5F55\u5FC5\u987B\u662F\u7EDD\u5BF9\u8DEF\u5F84");
        for (const field of ["http_headers", "env_http_headers"]) if (value[field] != null) {
          if (typeof value[field] !== "object" || Array.isArray(value[field])) throw Error("MCP \u8BF7\u6C42\u5934\u683C\u5F0F\u9519\u8BEF");
          for (const [k, v] of Object.entries(value[field])) if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(k) || typeof v !== "string" || /[\r\n\0]/.test(v) || field === "env_http_headers" && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)) throw Error("MCP \u8BF7\u6C42\u5934\u683C\u5F0F\u9519\u8BEF");
        }
        if (value.enabled != null && typeof value.enabled !== "boolean") throw Error("MCP enabled \u5FC5\u987B\u4E3A\u5E03\u5C14\u503C");
        return { name: key, config: { enabled: true, ...value } };
      }
      if (input.transport === "stdio") {
        if (typeof input.command !== "string" || !input.command.trim() || /[\r\n\0]/.test(input.command)) throw Error("\u8BF7\u8F93\u5165\u6709\u6548\u7684 MCP \u542F\u52A8\u547D\u4EE4");
        if (input.args != null && (!Array.isArray(input.args) || input.args.some((arg) => typeof arg !== "string" || arg.includes("\0")))) throw Error("MCP \u53C2\u6570\u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4");
        config.command = input.command.trim();
        config.args = input.args || [];
        if (input.env) {
          if (typeof input.env !== "object" || Array.isArray(input.env)) throw Error("\u73AF\u5883\u53D8\u91CF\u683C\u5F0F\u9519\u8BEF");
          config.env = {};
          for (const [key2, value] of Object.entries(input.env)) {
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key2) || typeof value !== "string" || value.includes("\0")) throw Error("\u73AF\u5883\u53D8\u91CF\u683C\u5F0F\u9519\u8BEF");
            config.env[key2] = value;
          }
        }
      } else if (input.transport === "http") {
        let url;
        try {
          url = new URL(input.url);
        } catch {
          throw Error("\u8BF7\u8F93\u5165\u6709\u6548\u7684 MCP \u5730\u5740");
        }
        if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || /[\s\\\x00-\x1f]/.test(input.url)) throw Error("MCP \u5730\u5740\u5FC5\u987B\u662F HTTP \u6216 HTTPS \u4E14\u4E0D\u80FD\u5305\u542B\u51ED\u636E");
        config.url = input.url.trim();
        if (input.bearerTokenEnvVar) {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(input.bearerTokenEnvVar)) throw Error("\u4EE4\u724C\u73AF\u5883\u53D8\u91CF\u540D\u79F0\u65E0\u6548");
          config.bearer_token_env_var = input.bearerTokenEnvVar;
        }
      } else throw Error("\u4E0D\u652F\u6301\u7684 MCP \u4F20\u8F93\u65B9\u5F0F");
      return { name: key, config };
    }
    var LocalPluginAuthoring2 = class {
      constructor({ home, request }) {
        if (!path.isAbsolute(home) || typeof request !== "function") throw Error("\u672C\u5730\u63D2\u4EF6\u914D\u7F6E\u65E0\u6548");
        this.home = home;
        this.request = request;
        this.busy = false;
      }
      async addMarketplace(params) {
        const { createPluginAddServices: createPluginAddServices2 } = await Promise.resolve().then(() => (init_service_adapter(), service_adapter_exports));
        const services = createPluginAddServices2({ safeGet() {
        }, safePost() {
        }, headersForAccount() {
        } }), normalized = services.normalizeMarketplace({ source: params.source, refName: params.refName || "", sparsePaths: Array.isArray(params.sparsePaths) ? params.sparsePaths.join("\n") : params.sparsePaths || "" });
        if (!normalized?.source) throw Error("\u8BF7\u8F93\u5165\u63D2\u4EF6\u5E02\u573A\u6765\u6E90");
        return this.request("marketplace/add", normalized);
      }
      async importArchive(file) {
        if (this.busy) throw Error("\u4E0A\u4E00\u9879\u63D2\u4EF6\u5BFC\u5165\u5C1A\u672A\u5B8C\u6210");
        this.busy = true;
        let stage, registered = false, currentPlugin;
        const installed = [];
        try {
          const base = path.join(this.home, "local-plugin-imports");
          fs.mkdirSync(base, { recursive: true, mode: 448 });
          if (fs.lstatSync(base).isSymbolicLink()) throw Error("\u63D2\u4EF6\u5BFC\u5165\u76EE\u5F55\u4E0D\u53EF\u4E3A\u94FE\u63A5");
          stage = fs.mkdtempSync(path.join(base, "import-"));
          const content = path.join(stage, "content");
          fs.mkdirSync(content);
          const extracted = await extractArchive(file, content), roots = pluginRoots(content);
          if (!roots.length) throw Error("\u538B\u7F29\u5305\u4E2D\u672A\u627E\u5230 .codex-plugin/plugin.json");
          const manifests = roots.map(validateManifest);
          if (new Set(manifests.map((x) => x.name)).size !== manifests.length) throw Error("\u538B\u7F29\u5305\u4E2D\u7684\u63D2\u4EF6\u540D\u79F0\u91CD\u590D");
          const market = "eva-import-" + crypto.randomBytes(6).toString("hex"), meta = path.join(stage, ".agents/plugins");
          fs.mkdirSync(meta, { recursive: true });
          fs.writeFileSync(path.join(meta, "marketplace.json"), JSON.stringify({ name: market, plugins: roots.map((root, i) => ({ name: manifests[i].name, source: { source: "local", path: "./" + path.relative(stage, root).split(path.sep).join("/") }, policy: { installation: "AVAILABLE", authentication: "ON_USE" } })) }, null, 2) + "\n", { mode: 384 });
          const added = await this.request("marketplace/add", { source: stage });
          registered = true;
          const listing = await this.request("plugin/list", { marketplaceKinds: ["local"], forceRefetch: true });
          const source = listing.marketplaces?.find((x) => x.name === market || x.name === added.marketplaceName);
          if (!source?.path) throw Error("\u5185\u6838\u672A\u786E\u8BA4\u5BFC\u5165\u7684\u63D2\u4EF6\u5E02\u573A");
          for (const manifest of manifests) {
            currentPlugin = manifest.name;
            const result = await this.request("plugin/install", { pluginName: manifest.name, marketplacePath: source.path });
            installed.push({ name: manifest.name, result });
          }
          return { marketplaceName: source.name, marketplacePath: source.path, installed, extracted };
        } catch (error) {
          if (installed.length) {
            const cause = error;
            error = new Error("\u63D2\u4EF6\u5305\u672A\u5168\u90E8\u5B89\u88C5\uFF1A\u5DF2\u5B89\u88C5 " + installed.map((x) => x.name).join("\u3001") + "\uFF1B\u5931\u8D25\u63D2\u4EF6 " + currentPlugin + "\u3002" + cause.message, { cause });
            error.code = "PARTIAL_PLUGIN_IMPORT";
            error.installedPluginNames = installed.map((x) => x.name);
            error.failedPluginName = currentPlugin;
          }
          if (stage && !registered) fs.rmSync(stage, { recursive: true, force: true });
          throw error;
        } finally {
          this.busy = false;
        }
      }
      async addMcp(input) {
        if (this.mcpBusy) throw Error("\u4E0A\u4E00\u9879 MCP \u914D\u7F6E\u5C1A\u672A\u4FDD\u5B58");
        this.mcpBusy = true;
        try {
          const { name: key, config } = mcpConfig(input), current = await this.request("config/read", { includeLayers: true });
          if (Object.prototype.hasOwnProperty.call(current.config?.mcp_servers || {}, key)) throw Error("\u5DF2\u5B58\u5728\u540C\u540D MCP\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u7F16\u8F91\u73B0\u6709\u914D\u7F6E");
          const configPath = path.join(this.home, "config.toml"), layer = current.layers?.find((x) => x.name?.type === "user" && x.name.file === configPath && !x.name.profile);
          const saved = await this.request("config/value/write", { ...layer?.version ? { expectedVersion: layer.version } : {}, keyPath: "mcp_servers." + key, value: config, mergeStrategy: "replace", filePath: path.join(this.home, "config.toml") });
          let reloadError = null;
          try {
            await this.request("config/mcpServer/reload", null);
          } catch {
            reloadError = "\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u4F46 MCP \u5237\u65B0\u5931\u8D25\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u91CD\u8BD5\u3002";
          }
          return { name: key, saved, reloadError };
        } finally {
          this.mcpBusy = false;
        }
      }
      // Explicit local adapter for the retained hosted creation form. No cloud identity.
      async createMcp(input) {
        if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.length > 128) throw Error("\u8BF7\u8F93\u5165\u4E0D\u8D85\u8FC7 128 \u5B57\u7B26\u7684\u540D\u79F0");
        if (input.description != null && (typeof input.description !== "string" || input.description.length > 4096)) throw Error("\u8BF4\u660E\u8FC7\u957F");
        if (!input.target?.mcp_url || Object.keys(input.target).some((k) => k !== "mcp_url")) throw Error("\u672C\u5730\u8FDE\u63A5\u4EC5\u652F\u6301\u670D\u52A1\u5668 URL\uFF1BOpenAI \u96A7\u9053\u5C1A\u672A\u63A5\u5165");
        if (!["NONE", "OAUTH", "MIXED"].includes(input.authentication)) throw Error("\u5F53\u524D\u672C\u5730\u8FDE\u63A5\u4E0D\u652F\u6301\u6B64\u8BA4\u8BC1\u65B9\u5F0F");
        if (input.oauthSettings != null) throw Error("\u672C\u5730\u5185\u6838\u5C1A\u4E0D\u652F\u6301\u6B64\u9875\u9762\u7684\u624B\u52A8 OAuth \u914D\u7F6E\uFF0C\u8BF7\u5173\u95ED\u9AD8\u7EA7\u8BBE\u7F6E\u5E76\u4F7F\u7528\u670D\u52A1\u5668\u81EA\u52A8\u53D1\u73B0");
        if (input.icon != null) throw Error("\u672C\u5730 MCP \u56FE\u6807\u4E0A\u4F20\u5C1A\u672A\u63A5\u5165");
        const displayName = input.name.trim(), key = "eva_" + crypto.createHash("sha256").update(displayName).digest("hex").slice(0, 24);
        const normalized = mcpConfig({ name: key, transport: "http", url: input.target.mcp_url });
        const saved = await this.addMcp({ name: key, config: normalized.config });
        const meta = { id: key, name: displayName, description: input.description || "", target: { mcp_url: normalized.config.url }, authentication: input.authentication, scope: "local", createdAt: (/* @__PURE__ */ new Date()).toISOString() };
        const dir = path.join(this.home, "local-mcp-metadata");
        try {
          fs.mkdirSync(dir, { recursive: true, mode: 448 });
          if (fs.lstatSync(dir).isSymbolicLink()) throw Error("metadata directory is symlink");
          fs.writeFileSync(path.join(dir, key + ".json"), JSON.stringify(meta, null, 2) + "\n", { flag: "wx", mode: 384 });
        } catch {
          throw Error("MCP \u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u4F46\u540D\u79F0\u4E0E\u8BF4\u660E\u8BB0\u5F55\u5931\u8D25\uFF1B\u8BF7\u5230\u8BBE\u7F6E\u68C0\u67E5\u73B0\u6709\u8FDE\u63A5\uFF0C\u52FF\u91CD\u590D\u521B\u5EFA");
        }
        return { ...meta, reloadError: saved.reloadError, requiresAuthorization: input.authentication !== "NONE" };
      }
      async connectMcp(input) {
        const key = name(input?.id), file = path.join(this.home, "local-mcp-metadata", key + ".json");
        const meta = JSON.parse(fs.readFileSync(file, "utf8"));
        if (meta.id !== key) throw Error("MCP \u8FDE\u63A5\u8BB0\u5F55\u4E0D\u5339\u914D");
        if (meta.authentication === "NONE") return { id: key, authorizationRequired: false };
        const result = await this.oauth(key);
        return { id: key, authorizationRequired: true, ...result };
      }
      async snapshot() {
        const current = await this.request("config/read", { includeLayers: false });
        return { scope: "local", accountRequired: false, marketplace: true, archive: true, mcp: true, mcpServerNames: Object.keys(current.config?.mcp_servers || {}) };
      }
      async oauth(nameValue) {
        return this.request("mcpServer/oauth/login", { name: name(nameValue), timeoutSecs: 180 });
      }
    };
    module2.exports = { LocalPluginAuthoring: LocalPluginAuthoring2, extractArchive, validateManifest, mcpConfig };
  }
});

// migration/desktop-extensions/authoring-worker.cjs
var readline = require("node:readline");
var { LocalPluginAuthoring } = require_local_plugin_authoring();
var next = 1;
var pending = /* @__PURE__ */ new Map();
var output = (value) => process.stdout.write(JSON.stringify(value) + "\n");
var author = new LocalPluginAuthoring({ home: process.env.EVA_EXTENSION_TEST_HOME || "/root/.eva-codex", request: (method, params) => new Promise((resolve, reject) => {
  const id = next++;
  pending.set(id, { resolve, reject });
  output({ id, method, params });
}) });
readline.createInterface({ input: process.stdin }).on("line", async (line) => {
  let value;
  try {
    value = JSON.parse(line);
    if (value.reply) {
      const p = pending.get(value.reply);
      if (p) {
        pending.delete(value.reply);
        value.error ? p.reject(Error(value.error)) : p.resolve(value.result);
      }
      return;
    }
    if (!["addMarketplace", "importArchive", "addMcp", "createMcp", "connectMcp", "snapshot"].includes(value.action)) throw Error("\u4E0D\u652F\u6301\u7684\u6269\u5C55\u64CD\u4F5C");
    const result = await author[value.action](value.action === "importArchive" ? value.path : value.params || {});
    output({ done: true, result });
    process.exitCode = 0;
    process.stdin.destroy();
  } catch (e) {
    output({ done: true, error: e.message });
    process.exitCode = 1;
    process.stdin.destroy();
  }
});
