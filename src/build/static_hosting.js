(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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

  // node_modules/crypt/crypt.js
  var require_crypt = __commonJS({
    "node_modules/crypt/crypt.js"(exports, module) {
      (function() {
        var base64map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", crypt = {
          // Bit-wise rotation left
          rotl: function(n, b) {
            return n << b | n >>> 32 - b;
          },
          // Bit-wise rotation right
          rotr: function(n, b) {
            return n << 32 - b | n >>> b;
          },
          // Swap big-endian to little-endian and vice versa
          endian: function(n) {
            if (n.constructor == Number) {
              return crypt.rotl(n, 8) & 16711935 | crypt.rotl(n, 24) & 4278255360;
            }
            for (var i = 0; i < n.length; i++)
              n[i] = crypt.endian(n[i]);
            return n;
          },
          // Generate an array of any length of random bytes
          randomBytes: function(n) {
            for (var bytes = []; n > 0; n--)
              bytes.push(Math.floor(Math.random() * 256));
            return bytes;
          },
          // Convert a byte array to big-endian 32-bit words
          bytesToWords: function(bytes) {
            for (var words = [], i = 0, b = 0; i < bytes.length; i++, b += 8)
              words[b >>> 5] |= bytes[i] << 24 - b % 32;
            return words;
          },
          // Convert big-endian 32-bit words to a byte array
          wordsToBytes: function(words) {
            for (var bytes = [], b = 0; b < words.length * 32; b += 8)
              bytes.push(words[b >>> 5] >>> 24 - b % 32 & 255);
            return bytes;
          },
          // Convert a byte array to a hex string
          bytesToHex: function(bytes) {
            for (var hex = [], i = 0; i < bytes.length; i++) {
              hex.push((bytes[i] >>> 4).toString(16));
              hex.push((bytes[i] & 15).toString(16));
            }
            return hex.join("");
          },
          // Convert a hex string to a byte array
          hexToBytes: function(hex) {
            for (var bytes = [], c = 0; c < hex.length; c += 2)
              bytes.push(parseInt(hex.substr(c, 2), 16));
            return bytes;
          },
          // Convert a byte array to a base-64 string
          bytesToBase64: function(bytes) {
            for (var base64 = [], i = 0; i < bytes.length; i += 3) {
              var triplet = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
              for (var j = 0; j < 4; j++)
                if (i * 8 + j * 6 <= bytes.length * 8)
                  base64.push(base64map.charAt(triplet >>> 6 * (3 - j) & 63));
                else
                  base64.push("=");
            }
            return base64.join("");
          },
          // Convert a base-64 string to a byte array
          base64ToBytes: function(base64) {
            base64 = base64.replace(/[^A-Z0-9+\/]/ig, "");
            for (var bytes = [], i = 0, imod4 = 0; i < base64.length; imod4 = ++i % 4) {
              if (imod4 == 0)
                continue;
              bytes.push((base64map.indexOf(base64.charAt(i - 1)) & Math.pow(2, -2 * imod4 + 8) - 1) << imod4 * 2 | base64map.indexOf(base64.charAt(i)) >>> 6 - imod4 * 2);
            }
            return bytes;
          }
        };
        module.exports = crypt;
      })();
    }
  });

  // node_modules/charenc/charenc.js
  var require_charenc = __commonJS({
    "node_modules/charenc/charenc.js"(exports, module) {
      var charenc = {
        // UTF-8 encoding
        utf8: {
          // Convert a string to a byte array
          stringToBytes: function(str) {
            return charenc.bin.stringToBytes(unescape(encodeURIComponent(str)));
          },
          // Convert a byte array to a string
          bytesToString: function(bytes) {
            return decodeURIComponent(escape(charenc.bin.bytesToString(bytes)));
          }
        },
        // Binary encoding
        bin: {
          // Convert a string to a byte array
          stringToBytes: function(str) {
            for (var bytes = [], i = 0; i < str.length; i++)
              bytes.push(str.charCodeAt(i) & 255);
            return bytes;
          },
          // Convert a byte array to a string
          bytesToString: function(bytes) {
            for (var str = [], i = 0; i < bytes.length; i++)
              str.push(String.fromCharCode(bytes[i]));
            return str.join("");
          }
        }
      };
      module.exports = charenc;
    }
  });

  // node_modules/is-buffer/index.js
  var require_is_buffer = __commonJS({
    "node_modules/is-buffer/index.js"(exports, module) {
      module.exports = function(obj) {
        return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer);
      };
      function isBuffer(obj) {
        return !!obj.constructor && typeof obj.constructor.isBuffer === "function" && obj.constructor.isBuffer(obj);
      }
      function isSlowBuffer(obj) {
        return typeof obj.readFloatLE === "function" && typeof obj.slice === "function" && isBuffer(obj.slice(0, 0));
      }
    }
  });

  // node_modules/md5/md5.js
  var require_md5 = __commonJS({
    "node_modules/md5/md5.js"(exports, module) {
      (function() {
        var crypt = require_crypt(), utf8 = require_charenc().utf8, isBuffer = require_is_buffer(), bin = require_charenc().bin, md52 = function(message, options) {
          if (message.constructor == String)
            if (options && options.encoding === "binary")
              message = bin.stringToBytes(message);
            else
              message = utf8.stringToBytes(message);
          else if (isBuffer(message))
            message = Array.prototype.slice.call(message, 0);
          else if (!Array.isArray(message) && message.constructor !== Uint8Array)
            message = message.toString();
          var m = crypt.bytesToWords(message), l = message.length * 8, a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
          for (var i = 0; i < m.length; i++) {
            m[i] = (m[i] << 8 | m[i] >>> 24) & 16711935 | (m[i] << 24 | m[i] >>> 8) & 4278255360;
          }
          m[l >>> 5] |= 128 << l % 32;
          m[(l + 64 >>> 9 << 4) + 14] = l;
          var FF = md52._ff, GG = md52._gg, HH = md52._hh, II = md52._ii;
          for (var i = 0; i < m.length; i += 16) {
            var aa = a, bb = b, cc = c, dd = d;
            a = FF(a, b, c, d, m[i + 0], 7, -680876936);
            d = FF(d, a, b, c, m[i + 1], 12, -389564586);
            c = FF(c, d, a, b, m[i + 2], 17, 606105819);
            b = FF(b, c, d, a, m[i + 3], 22, -1044525330);
            a = FF(a, b, c, d, m[i + 4], 7, -176418897);
            d = FF(d, a, b, c, m[i + 5], 12, 1200080426);
            c = FF(c, d, a, b, m[i + 6], 17, -1473231341);
            b = FF(b, c, d, a, m[i + 7], 22, -45705983);
            a = FF(a, b, c, d, m[i + 8], 7, 1770035416);
            d = FF(d, a, b, c, m[i + 9], 12, -1958414417);
            c = FF(c, d, a, b, m[i + 10], 17, -42063);
            b = FF(b, c, d, a, m[i + 11], 22, -1990404162);
            a = FF(a, b, c, d, m[i + 12], 7, 1804603682);
            d = FF(d, a, b, c, m[i + 13], 12, -40341101);
            c = FF(c, d, a, b, m[i + 14], 17, -1502002290);
            b = FF(b, c, d, a, m[i + 15], 22, 1236535329);
            a = GG(a, b, c, d, m[i + 1], 5, -165796510);
            d = GG(d, a, b, c, m[i + 6], 9, -1069501632);
            c = GG(c, d, a, b, m[i + 11], 14, 643717713);
            b = GG(b, c, d, a, m[i + 0], 20, -373897302);
            a = GG(a, b, c, d, m[i + 5], 5, -701558691);
            d = GG(d, a, b, c, m[i + 10], 9, 38016083);
            c = GG(c, d, a, b, m[i + 15], 14, -660478335);
            b = GG(b, c, d, a, m[i + 4], 20, -405537848);
            a = GG(a, b, c, d, m[i + 9], 5, 568446438);
            d = GG(d, a, b, c, m[i + 14], 9, -1019803690);
            c = GG(c, d, a, b, m[i + 3], 14, -187363961);
            b = GG(b, c, d, a, m[i + 8], 20, 1163531501);
            a = GG(a, b, c, d, m[i + 13], 5, -1444681467);
            d = GG(d, a, b, c, m[i + 2], 9, -51403784);
            c = GG(c, d, a, b, m[i + 7], 14, 1735328473);
            b = GG(b, c, d, a, m[i + 12], 20, -1926607734);
            a = HH(a, b, c, d, m[i + 5], 4, -378558);
            d = HH(d, a, b, c, m[i + 8], 11, -2022574463);
            c = HH(c, d, a, b, m[i + 11], 16, 1839030562);
            b = HH(b, c, d, a, m[i + 14], 23, -35309556);
            a = HH(a, b, c, d, m[i + 1], 4, -1530992060);
            d = HH(d, a, b, c, m[i + 4], 11, 1272893353);
            c = HH(c, d, a, b, m[i + 7], 16, -155497632);
            b = HH(b, c, d, a, m[i + 10], 23, -1094730640);
            a = HH(a, b, c, d, m[i + 13], 4, 681279174);
            d = HH(d, a, b, c, m[i + 0], 11, -358537222);
            c = HH(c, d, a, b, m[i + 3], 16, -722521979);
            b = HH(b, c, d, a, m[i + 6], 23, 76029189);
            a = HH(a, b, c, d, m[i + 9], 4, -640364487);
            d = HH(d, a, b, c, m[i + 12], 11, -421815835);
            c = HH(c, d, a, b, m[i + 15], 16, 530742520);
            b = HH(b, c, d, a, m[i + 2], 23, -995338651);
            a = II(a, b, c, d, m[i + 0], 6, -198630844);
            d = II(d, a, b, c, m[i + 7], 10, 1126891415);
            c = II(c, d, a, b, m[i + 14], 15, -1416354905);
            b = II(b, c, d, a, m[i + 5], 21, -57434055);
            a = II(a, b, c, d, m[i + 12], 6, 1700485571);
            d = II(d, a, b, c, m[i + 3], 10, -1894986606);
            c = II(c, d, a, b, m[i + 10], 15, -1051523);
            b = II(b, c, d, a, m[i + 1], 21, -2054922799);
            a = II(a, b, c, d, m[i + 8], 6, 1873313359);
            d = II(d, a, b, c, m[i + 15], 10, -30611744);
            c = II(c, d, a, b, m[i + 6], 15, -1560198380);
            b = II(b, c, d, a, m[i + 13], 21, 1309151649);
            a = II(a, b, c, d, m[i + 4], 6, -145523070);
            d = II(d, a, b, c, m[i + 11], 10, -1120210379);
            c = II(c, d, a, b, m[i + 2], 15, 718787259);
            b = II(b, c, d, a, m[i + 9], 21, -343485551);
            a = a + aa >>> 0;
            b = b + bb >>> 0;
            c = c + cc >>> 0;
            d = d + dd >>> 0;
          }
          return crypt.endian([a, b, c, d]);
        };
        md52._ff = function(a, b, c, d, x, s, t) {
          var n = a + (b & c | ~b & d) + (x >>> 0) + t;
          return (n << s | n >>> 32 - s) + b;
        };
        md52._gg = function(a, b, c, d, x, s, t) {
          var n = a + (b & d | c & ~d) + (x >>> 0) + t;
          return (n << s | n >>> 32 - s) + b;
        };
        md52._hh = function(a, b, c, d, x, s, t) {
          var n = a + (b ^ c ^ d) + (x >>> 0) + t;
          return (n << s | n >>> 32 - s) + b;
        };
        md52._ii = function(a, b, c, d, x, s, t) {
          var n = a + (c ^ (b | ~d)) + (x >>> 0) + t;
          return (n << s | n >>> 32 - s) + b;
        };
        md52._blocksize = 16;
        md52._digestsize = 16;
        module.exports = function(message, options) {
          if (message === void 0 || message === null)
            throw new Error("Illegal argument " + message);
          var digestbytes = crypt.wordsToBytes(md52(message, options));
          return options && options.asBytes ? digestbytes : options && options.asString ? bin.bytesToString(digestbytes) : crypt.bytesToHex(digestbytes);
        };
      })();
    }
  });

  // ../../barbe-serverless/src/barbe-std/rpc.ts
  function isFailure(resp) {
    return resp.error !== void 0;
  }
  function barbeRpcCall(req) {
    const msg = JSON.stringify(req);
    console.log(msg);
    const rawResp = readline();
    return JSON.parse(rawResp);
  }

  // ../../barbe-serverless/src/barbe-std/utils.ts
  var SyntaxTokenTypes = {
    "literal_value": true,
    "scope_traversal": true,
    "function_call": true,
    "template": true,
    "object_const": true,
    "array_const": true,
    "index_access": true,
    "for": true,
    "relative_traversal": true,
    "conditional": true,
    "binary_op": true,
    "unary_op": true,
    "parens": true,
    "splat": true,
    "anon": true
  };
  function asStr(token) {
    if (typeof token === "string") {
      return token;
    }
    switch (token.Type) {
      default:
        throw new Error(`cannot convert token type '${token.Type}' to string`);
      case "scope_traversal":
        return token.Traversal?.map((traverse, i) => {
          if (traverse.Type === "attr") {
            return traverse.Name + (i === token.Traversal.length - 1 || token.Traversal[i + 1].Type !== "attr" ? "" : ".");
          } else {
            return "[" + (typeof traverse.Index === "string" ? '"' : "") + traverse.Index + (typeof traverse.Index === "string" ? '"' : "") + "]" + (i === token.Traversal.length - 1 || token.Traversal[i + 1].Type !== "attr" ? "" : ".");
          }
        }).join("") || "";
      case "literal_value":
        return token.Value + "";
      case "template":
        return token.Parts?.map((part) => asStr(part)).join("") || "";
    }
  }
  function mergeTokens(values) {
    if (values.length === 0) {
      return asSyntax({});
    }
    if (values.length === 1) {
      return values[0];
    }
    if (values[0] === null) {
      throw new Error("tried to merge null value");
    }
    switch (values[0].Type) {
      default:
        return values[values.length - 1];
      case "literal_value":
        return values[values.length - 1];
      case "array_const":
        return {
          Type: "array_const",
          ArrayConst: values.map((value) => value.ArrayConst || []).flat()
        };
      case "object_const":
        const allObjConst = values.map((value) => value.ObjectConst || []).flat();
        const v = {};
        allObjConst.forEach((item, i) => {
          if (!v.hasOwnProperty(item.Key)) {
            v[item.Key] = mergeTokens(
              allObjConst.slice(i).filter((v2) => v2.Key === item.Key).map((v2) => v2.Value)
            );
          }
        });
        return {
          Type: "object_const",
          ObjectConst: Object.keys(v).map((key) => ({
            Key: key,
            Value: v[key]
          }))
        };
    }
  }
  function asVal(token) {
    switch (token.Type) {
      case "template":
        return token.Parts?.map((part) => asStr(part)).join("") || "";
      case "literal_value":
        return token.Value || null;
      case "array_const":
        return token.ArrayConst || [];
      case "object_const":
        const keys = token.ObjectConst?.map((pair) => pair.Key) || [];
        const uniqKeys = new Set(keys);
        const allValues = (key) => token.ObjectConst?.filter((pair) => pair.Key === key).map((pair) => pair.Value) || [];
        const obj = {};
        uniqKeys.forEach((key) => obj[key] = mergeTokens(allValues(key)));
        return obj;
      default:
        throw new Error(`cannot turn token type '${token.Type}' into a value`);
    }
  }
  function asSyntax(token) {
    if (typeof token === "object" && token !== null && token.hasOwnProperty("Type") && token.Type in SyntaxTokenTypes) {
      return token;
    } else if (typeof token === "string" || typeof token === "number" || typeof token === "boolean") {
      return {
        Type: "literal_value",
        Value: token
      };
    } else if (Array.isArray(token)) {
      return {
        Type: "array_const",
        ArrayConst: token.filter((child) => child !== null).map((child) => asSyntax(child))
      };
    } else if (typeof token === "object" && token !== null) {
      return {
        Type: "object_const",
        ObjectConst: Object.keys(token).map((key) => ({
          Key: key,
          Value: asSyntax(token[key])
        }))
      };
    } else {
      return token;
    }
  }
  function appendToTemplate(source, toAdd) {
    let parts = [];
    if (source.Type === "template") {
      parts = source.Parts?.slice() || [];
    } else if (source.Type === "literal_value") {
      parts = [source];
    } else {
      parts = [source];
    }
    parts.push(...toAdd.map(asSyntax));
    return {
      Type: "template",
      Parts: parts
    };
  }
  function asBlock(arr) {
    return {
      Type: "array_const",
      Meta: { IsBlock: true },
      ArrayConst: arr.map((obj) => {
        if (typeof obj === "function") {
          const { block, labels } = obj();
          return {
            Type: "object_const",
            Meta: {
              IsBlock: true,
              Labels: labels
            },
            ObjectConst: Object.keys(block).map((key) => ({
              Key: key,
              Value: asSyntax(block[key])
            }))
          };
        }
        return {
          Type: "object_const",
          Meta: { IsBlock: true },
          ObjectConst: Object.keys(obj).map((key) => ({
            Key: key,
            Value: asSyntax(obj[key])
          }))
        };
      })
    };
  }
  function iterateAllBlocks(container2, func) {
    const types = Object.keys(container2);
    let output = [];
    for (const type of types) {
      const blockNames = Object.keys(container2[type]);
      for (const blockName of blockNames) {
        for (const block of container2[type][blockName]) {
          output.push(func(block));
        }
      }
    }
    return output;
  }
  function iterateBlocks(container2, ofType, func) {
    if (!(ofType in container2)) {
      return [];
    }
    let output = [];
    const blockNames = Object.keys(container2[ofType]);
    for (const blockName of blockNames) {
      for (const block of container2[ofType][blockName]) {
        output.push(func(block));
      }
    }
    return output;
  }
  function exportDatabags(bags) {
    if (!Array.isArray(bags)) {
      bags = iterateAllBlocks(bags, (bag) => bag);
    }
    if (bags.length === 0) {
      return;
    }
    const resp = barbeRpcCall({
      method: "exportDatabags",
      params: [{
        databags: bags
      }]
    });
    if (isFailure(resp)) {
      throw new Error(resp.error);
    }
  }
  function applyTransformers(input) {
    const resp = barbeRpcCall({
      method: "transformContainer",
      params: [{
        databags: input
      }]
    });
    if (isFailure(resp)) {
      throw new Error(resp.error);
    }
    return resp.result;
  }
  function importComponents(container2, components) {
    let barbeImportComponent = [];
    for (const component of components) {
      let importComponentInput = {
        url: component.url,
        input: {}
      };
      if (component.copyFromContainer) {
        for (const copyFrom of component.copyFromContainer) {
          if (copyFrom in container2) {
            importComponentInput.input[copyFrom] = container2[copyFrom];
          }
        }
      }
      if (component.input) {
        for (const databag of component.input) {
          const type = databag.Type;
          const name = databag.Name;
          if (!(type in importComponentInput.input)) {
            importComponentInput.input[type] = {};
          }
          if (!(name in importComponentInput.input[type])) {
            importComponentInput.input[type][name] = [];
          }
          importComponentInput.input[type][name].push(databag);
        }
      }
      const id = `${component.name || ""}_${component.url}`;
      barbeImportComponent.push({
        Type: "barbe_import_component",
        Name: id,
        Value: importComponentInput
      });
    }
    const resp = barbeRpcCall({
      method: "importComponents",
      params: [{
        databags: barbeImportComponent
      }]
    });
    if (isFailure(resp)) {
      throw new Error(resp.error);
    }
    return resp.result;
  }
  function readDatabagContainer() {
    return JSON.parse(os.file.readFile("__barbe_input.json"));
  }
  var IS_VERBOSE = os.getenv("BARBE_VERBOSE") === "1";
  function barbeLifecycleStep() {
    return os.getenv("BARBE_LIFECYCLE_STEP");
  }
  function uniq(arr, key) {
    const seen = /* @__PURE__ */ new Set();
    return arr.filter((item) => {
      const val = key ? key(item) : item;
      if (seen.has(val)) {
        return false;
      }
      seen.add(val);
      return true;
    });
  }

  // ../../barbe-serverless/src/barbe-sls-lib/lib.ts
  function compileDefaults(container2, name) {
    let blocks = [];
    if (container2.global_default) {
      const globalDefaults = Object.values(container2.global_default).flatMap((group) => group.map((block) => block.Value)).filter((block) => block);
      blocks.push(...globalDefaults);
    }
    if (container2.default && container2.default[name]) {
      blocks.push(...container2.default[name].map((block) => block.Value).filter((block) => block));
    }
    return mergeTokens(blocks);
  }
  function applyDefaults(container2, block) {
    if (block.Type !== "object_const") {
      throw new Error(`cannot apply defaults to token type '${block.Type}'`);
    }
    const copyFrom = block.ObjectConst?.find((pair) => pair.Key === "copy_from");
    let defaults;
    if (copyFrom) {
      defaults = compileDefaults(container2, asStr(copyFrom.Value));
    } else {
      defaults = compileDefaults(container2, "");
    }
    const blockVal = asVal(mergeTokens([defaults, block]));
    delete blockVal.name_prefix;
    return [
      blockVal,
      compileNamePrefix(container2, block)
    ];
  }
  function compileNamePrefix(container2, block) {
    let namePrefixes = [];
    if (container2.global_default) {
      const globalDefaults = Object.values(container2.global_default).flatMap((group) => group.map((block2) => block2.Value)).filter((block2) => block2).flatMap((block2) => block2.ObjectConst?.filter((pair) => pair.Key === "name_prefix")).filter((block2) => block2).map((block2) => block2.Value);
      namePrefixes.push(...globalDefaults);
    }
    let defaultName = "";
    if (block) {
      const copyFrom = block.ObjectConst?.find((pair) => pair.Key === "copy_from");
      if (copyFrom) {
        defaultName = asStr(copyFrom.Value);
      }
    }
    if (container2.default && container2.default[defaultName]) {
      const defaults = container2.default[defaultName].map((bag) => bag.Value).filter((block2) => block2).flatMap((block2) => block2.ObjectConst?.filter((pair) => pair.Key === "name_prefix")).filter((block2) => block2).map((block2) => block2.Value);
      namePrefixes.push(...defaults);
    }
    if (block) {
      namePrefixes.push(...block.ObjectConst?.filter((pair) => pair.Key === "name_prefix").map((pair) => pair.Value) || []);
    }
    let output = {
      Type: "template",
      Parts: []
    };
    const mergeIn = (namePrefixToken) => {
      switch (namePrefixToken.Type) {
        case "literal_value":
          output.Parts.push(namePrefixToken);
          break;
        case "template":
          output.Parts.push(...namePrefixToken.Parts || []);
          break;
        case "array_const":
          namePrefixToken.ArrayConst?.forEach(mergeIn);
          break;
        default:
          console.log("unknown name_prefix type '", namePrefixToken.Type, "'");
      }
    };
    for (const namePrefixToken of namePrefixes) {
      mergeIn(namePrefixToken);
    }
    return output;
  }
  function compileBlockParam(blockVal, blockName) {
    return asVal(mergeTokens((blockVal[blockName] || asSyntax([])).ArrayConst || []));
  }

  // anyfront-lib/consts.ts
  var GCP_CLOUDRUN_STATIC_HOSTING = "gcp_cloudrun_static_hosting";
  var AWS_CLOUDFRONT_STATIC_HOSTING = "aws_cloudfront_static_hosting";
  var STATIC_HOSTING = "static_hosting";
  var BARBE_SLS_VERSION = "v0.2.3";
  var ANYFRONT_VERSION = "v0.2.3";
  var TERRAFORM_EXECUTE_URL = `https://hub.barbe.app/barbe-serverless/terraform_execute.js:${BARBE_SLS_VERSION}`;
  var AWS_IAM_URL = `https://hub.barbe.app/barbe-serverless/aws_iam.js:${BARBE_SLS_VERSION}`;
  var AWS_LAMBDA_URL = `https://hub.barbe.app/barbe-serverless/aws_function.js:${BARBE_SLS_VERSION}`;
  var GCP_PROJECT_SETUP_URL = `https://hub.barbe.app/anyfront/gcp_project_setup.js:${ANYFRONT_VERSION}`;
  var AWS_S3_SYNC_URL = `https://hub.barbe.app/anyfront/aws_s3_sync_files.js:${ANYFRONT_VERSION}`;
  var FRONTEND_BUILD_URL = `https://hub.barbe.app/anyfront/frontend_build.js:${ANYFRONT_VERSION}`;
  var GCP_CLOUDRUN_STATIC_HOSTING_URL = `https://hub.barbe.app/anyfront/gcp_cloudrun_static_hosting.js:${ANYFRONT_VERSION}`;
  var AWS_NEXT_JS_URL = `https://hub.barbe.app/anyfront/aws_next_js.js:${ANYFRONT_VERSION}`;
  var GCP_NEXT_JS_URL = `https://hub.barbe.app/anyfront/gcp_next_js.js:${ANYFRONT_VERSION}`;
  var AWS_SVELTEKIT_URL = `https://hub.barbe.app/anyfront/aws_sveltekit.js:${ANYFRONT_VERSION}`;
  var AWS_CLOUDFRONT_STATIC_HOSTING_URL = `https://hub.barbe.app/anyfront/aws_cloudfront_static_hosting.js:${ANYFRONT_VERSION}`;
  var STATIC_HOSTING_URL = `https://hub.barbe.app/anyfront/static_hosting.js:${ANYFRONT_VERSION}`;

  // static_hosting.ts
  var import_md5 = __toESM(require_md5());

  // anyfront-lib/pipeline.ts
  function mergeDatabagContainers(...containers) {
    let output = {};
    for (const container2 of containers) {
      for (const [blockType, block] of Object.entries(container2)) {
        output[blockType] = output[blockType] || {};
        for (const [bagName, bag] of Object.entries(block)) {
          output[blockType][bagName] = output[blockType][bagName] || [];
          output[blockType][bagName].push(...bag);
        }
      }
    }
    return output;
  }
  function databagArrayToContainer(array) {
    let output = {};
    for (const bag of array) {
      output[bag.Type] = output[bag.Type] || {};
      output[bag.Type][bag.Name] = output[bag.Type][bag.Name] || [];
      output[bag.Type][bag.Name].push(bag);
    }
    return output;
  }
  function executePipelineGroup(container2, pipelines) {
    const lifecycleStep = barbeLifecycleStep();
    const maxStep = pipelines.map((p) => p.steps.length).reduce((a, b) => Math.max(a, b), 0);
    let previousStepResult = {};
    let history = [];
    for (let i = 0; i < maxStep; i++) {
      let stepResults = {};
      let stepImports = [];
      let stepTransforms = [];
      let stepDatabags = [];
      let stepNames = [];
      for (let pipeline2 of pipelines) {
        if (i >= pipeline2.steps.length) {
          continue;
        }
        const stepMeta = pipeline2.steps[i];
        if (stepMeta.name) {
          stepNames.push(stepMeta.name);
        }
        if (stepMeta.lifecycleSteps && stepMeta.lifecycleSteps.length > 0) {
          if (!stepMeta.lifecycleSteps.includes(lifecycleStep)) {
            if (IS_VERBOSE) {
              console.log(`${pipeline2.name}: skipping step ${i}${stepMeta.name ? ` (${stepMeta.name})` : ""} (${lifecycleStep} not in [${stepMeta.lifecycleSteps.join(", ")}]`);
            }
            continue;
          }
        }
        if (IS_VERBOSE) {
          console.log(`${pipeline2.name}: running step ${i}${stepMeta.name ? ` (${stepMeta.name})` : ""}`);
          console.log(`step ${i} input:`, JSON.stringify(previousStepResult));
        }
        let stepRequests = stepMeta.f({
          previousStepResult,
          history
        });
        if (IS_VERBOSE) {
          console.log(`${pipeline2.name}: step ${i}${stepMeta.name ? ` (${stepMeta.name})` : ""} requests:`, JSON.stringify(stepRequests));
        }
        if (!stepRequests) {
          continue;
        }
        if (stepRequests.imports) {
          stepImports.push(...stepRequests.imports);
        }
        if (stepRequests.transforms) {
          stepTransforms.push(...stepRequests.transforms);
        }
        if (stepRequests.databags) {
          stepDatabags.push(...stepRequests.databags);
        }
      }
      if (stepImports.length > 0) {
        const importsResults = importComponents(container2, stepImports);
        stepResults = mergeDatabagContainers(stepResults, importsResults);
      }
      if (stepTransforms.length > 0) {
        const transformResults = applyTransformers(stepTransforms);
        stepResults = mergeDatabagContainers(stepResults, transformResults);
      }
      if (stepDatabags.length > 0) {
        exportDatabags(stepDatabags);
        stepResults = mergeDatabagContainers(stepResults, databagArrayToContainer(stepDatabags));
      }
      if (IS_VERBOSE) {
        console.log(`step ${i} output:`, JSON.stringify(stepResults));
      }
      history.push({
        databags: stepResults,
        stepNames
      });
      previousStepResult = stepResults;
      for (let pipeline2 of pipelines) {
        pipeline2.mostRecentInput = {
          previousStepResult,
          history
        };
      }
    }
  }
  function getHistoryItem(history, stepName) {
    for (const item of history) {
      if (item.stepNames.includes(stepName)) {
        return item;
      }
    }
    return null;
  }
  function step(f, params) {
    return {
      ...params,
      f
    };
  }
  function pipeline(steps, params) {
    return {
      ...params,
      steps,
      pushWithParams(params2, f) {
        this.steps.push(step(f, params2));
      },
      push(f) {
        this.steps.push(step(f));
      },
      merge(...steps2) {
        this.steps.push(...steps2);
      },
      runAfter(other) {
        this.steps = [
          ...Array.from({ length: other.steps.length }, () => step(() => {
          }, { name: `padding_${other.name || ""}` })),
          ...this.steps
        ];
      }
    };
  }

  // static_hosting.ts
  var container = readDatabagContainer();
  function iterateBlocksPerPlatform(container2, iteratorGcp, iteratorAws) {
    return iterateBlocks(container2, STATIC_HOSTING, (bag) => {
      const [block, namePrefix] = applyDefaults(container2, bag.Value);
      const platform = asStr(block.platform || "aws");
      switch (platform) {
        case "gcp":
          return iteratorGcp(bag, block, namePrefix);
        case "aws":
          return iteratorAws(bag, block, namePrefix);
        default:
          throw new Error(`unknown platform for static_hosting.${bag.Name}: '${platform}'`);
      }
    });
  }
  function computeBagBuildHash(bag) {
    const [block, _] = applyDefaults(container, bag.Value);
    const dotBuild = compileBlockParam(block, "build");
    const dotEnvironment = compileBlockParam(block, "environment");
    return (0, import_md5.default)(`
        ${asVal(dotBuild.disabled || asSyntax(false))}
        ${asStr(dotBuild.nodejs_version || "null")}
        ${asStr(dotBuild.build_dir || "null")}
        ${asStr(dotBuild.build_output_dir || "null")}
        ${asStr(dotBuild.install_cmd || "null")}
        ${asStr(dotBuild.build_cmd || "null")}
        ${Object.entries(dotEnvironment).map(([k, v]) => `${k}:${JSON.stringify(asStr(v))}`).join(",")}
    `);
  }
  function autoCreateMultiplatformStateStore() {
    if (container.state_store) {
      return;
    }
    let gcpCount2 = 0;
    let awsCount2 = 0;
    const gcpIterator = (bag, block, namePrefix) => {
      const dotGcpProject = compileBlockParam(block, "google_cloud_project");
      gcpCount2++;
      return {
        Type: "state_store",
        Name: "",
        Value: {
          name_prefix: [`${bag.Name}-`],
          gcs: asBlock([{
            project_id: dotGcpProject.project_id || block.google_cloud_project_id || block.project_id
          }])
        }
      };
    };
    const awsIterator = (bag, block, namePrefix) => {
      awsCount2++;
      return {
        Type: "state_store",
        Name: "",
        Value: {
          name_prefix: [`${bag.Name}-`],
          s3: asBlock([{}])
        }
      };
    };
    const databags = iterateBlocksPerPlatform(container, gcpIterator, awsIterator);
    if (gcpCount2 > 1) {
      throw new Error("more than 1 static_hosting block with platform 'gcp' detected without a state_store block declared, this would risk loosing your terraform/barbe state. To fix this you can explicitely declare a state_store block: `state_store { gcs { ... } }`. See https://github.com/Plenituz/barbe-serverless/blob/main/docs/references/state_store.md");
    }
    if (awsCount2 > 1) {
      throw new Error("more than 1 static_hosting block with platform 'aws' detected without a state_store block declared, this would risk loosing your terraform/barbe state. To fix this you can explicitely declare a state_store block: `state_store { s3 { ... } }`. See https://github.com/Plenituz/barbe-serverless/blob/main/docs/references/state_store.md");
    }
    if (awsCount2 + gcpCount2 > 0) {
      throw new Error("more than 1 static_hosting block with platform 'aws' and 'gcp' detected without a state_store block declared, this would risk loosing your terraform/barbe state. To fix this you can explicitely declare a state_store block: `state_store { s3 { ... } }`. See https://github.com/Plenituz/barbe-serverless/blob/main/docs/references/state_store.md");
    }
    exportDatabags(databags);
  }
  function retrieveBuildOuputDirMap() {
    if (barbeLifecycleStep() === "generate") {
      const buildOutputDirs2 = getHistoryItem(buildPipeline.mostRecentInput?.history || [], "builds_output")?.databags;
      if (!buildOutputDirs2?.static_hosting_build_dir_map?.[""]?.[0]?.Value) {
        return void 0;
      }
      return buildOutputDirs2?.static_hosting_build_dir_map?.[""]?.[0]?.Value;
    }
    const tmp = container.static_hosting_build_dir_map?.[""]?.[0]?.Value;
    if (!tmp) {
      return void 0;
    }
    let buildOutputDirs = asVal(tmp);
    Object.keys(buildOutputDirs).forEach((key) => buildOutputDirs[key] = asStr(buildOutputDirs[key]));
    return buildOutputDirs;
  }
  function buildFrontendPipeline() {
    const uniqueBagAndHashes = uniq(
      iterateBlocks(container, STATIC_HOSTING, (bag) => ({ hash: computeBagBuildHash(bag), bag })),
      (x) => x.hash
    );
    let frontEndBuildReqs = [];
    let buildOutputDirs = {};
    for (const { hash, bag } of uniqueBagAndHashes) {
      const [block, namePrefix] = applyDefaults(container, bag.Value);
      const dotBuild = compileBlockParam(block, "build");
      if (dotBuild.disabled && asVal(dotBuild.disabled)) {
        if (!dotBuild.build_output_dir) {
          throw new Error(`static_hosting.${bag.Name}.build.build_output_dir is required when static_hosting.${bag.Name}.build.disabled is true. The files in that directory will be uploaded to the static hosting provider`);
        }
        buildOutputDirs[hash] = asStr(dotBuild.build_output_dir);
        continue;
      }
      frontEndBuildReqs.push({
        Type: "frontend_build",
        Name: hash,
        Value: {
          nodejs_version: dotBuild.nodejs_version || "18",
          build_dir: dotBuild.build_dir,
          build_output_dir: dotBuild.build_output_dir,
          install_cmd: dotBuild.install_cmd,
          build_cmd: dotBuild.build_cmd,
          environment: dotBuild.environment
        }
      });
    }
    if (frontEndBuildReqs.length === 0) {
      return pipeline([]);
    }
    return pipeline([
      step(() => {
        return {
          imports: [{
            url: FRONTEND_BUILD_URL,
            input: frontEndBuildReqs
          }]
        };
      }, { name: "builds", lifecycleSteps: ["generate"] }),
      step((input) => {
        const frontendBuildResults = input.previousStepResult;
        iterateBlocks(frontendBuildResults, "frontend_build_output", (bag) => buildOutputDirs[bag.Name] = asStr(bag.Value));
        const databags = [{
          Type: "static_hosting_build_dir_map",
          Name: "",
          Value: buildOutputDirs
        }];
        return { databags };
      }, { name: "builds_output", lifecycleSteps: ["generate"] })
    ], { name: "static_hosting_frontend_builds" });
  }
  function staticHostingGcp(bag, block, namePrefix) {
    let pipe = pipeline([], { name: `static_hosting[gcp].${bag.Name}` });
    pipe.runAfter(buildPipeline);
    pipe.pushWithParams({ name: "import_gcp" }, () => {
      const buildOutputDirs = retrieveBuildOuputDirMap();
      if (!buildOutputDirs) {
        return;
      }
      const hash = computeBagBuildHash(bag);
      const buildOutputDir = buildOutputDirs[hash];
      if (!buildOutputDir) {
        return;
      }
      const dotGcpProject = compileBlockParam(block, "google_cloud_project");
      const dotDomain = compileBlockParam(block, "domain");
      const gcpStaticHosting = {
        Type: GCP_CLOUDRUN_STATIC_HOSTING,
        Name: bag.Name,
        Value: {
          name_prefix: [`${bag.Name}-`],
          root_object: block.root_object,
          region: block.region || "us-central1",
          project_id: dotGcpProject.project_id || block.google_cloud_project_id || block.project_id,
          project_name: dotGcpProject.project_name || bag.Name,
          organization_id: dotGcpProject.organization_id,
          organization_domain: dotGcpProject.organization_domain,
          billing_account_name: dotGcpProject.billing_account_name,
          billing_account_id: dotGcpProject.billing_account_id,
          //gcp requires the end dot
          domain: dotDomain.name ? appendToTemplate(dotDomain.name, ["."]) : void 0,
          dns_zone: dotDomain.zone,
          dns_zone_project: dotDomain.zone_project,
          build_dir: buildOutputDir
        }
      };
      const imports = [{
        url: GCP_CLOUDRUN_STATIC_HOSTING_URL,
        copyFromContainer: ["default", "global_default", "cr_[terraform]"],
        input: [gcpStaticHosting]
      }];
      return { imports };
    });
    pipe.pushWithParams({ name: "export_results" }, (input) => {
      return {
        databags: iterateAllBlocks(input.previousStepResult, (d) => d)
      };
    });
    return pipe;
  }
  function staticHostingAws(bag, block, namePrefix) {
    let pipe = pipeline([], { name: `static_hosting[aws].${bag.Name}` });
    pipe.runAfter(buildPipeline);
    pipe.pushWithParams({ name: "import_aws" }, () => {
      const buildOutputDirs = retrieveBuildOuputDirMap();
      if (!buildOutputDirs) {
        return;
      }
      const hash = computeBagBuildHash(bag);
      const buildOutputDir = buildOutputDirs[hash];
      if (!buildOutputDir) {
        return;
      }
      const dotDomain = compileBlockParam(block, "domain");
      const awsStaticHosting = {
        Type: AWS_CLOUDFRONT_STATIC_HOSTING,
        Name: bag.Name,
        Value: {
          name_prefix: [`${bag.Name}-`],
          root_object: block.root_object,
          region: block.region || os.getenv("AWS_REGION") || "us-east-1",
          build_dir: buildOutputDir,
          domain: asBlock([{
            certificate_domain_to_create: dotDomain.name,
            ...dotDomain
          }])
        }
      };
      const imports = [{
        url: AWS_CLOUDFRONT_STATIC_HOSTING_URL,
        copyFromContainer: ["default", "global_default", "cr_[terraform]"],
        input: [awsStaticHosting]
      }];
      return { imports };
    });
    pipe.pushWithParams({ name: "export_results" }, (input) => {
      return {
        databags: iterateAllBlocks(input.previousStepResult, (d) => d)
      };
    });
    return pipe;
  }
  if (barbeLifecycleStep() === "pre_generate") {
    autoCreateMultiplatformStateStore();
  }
  var buildPipeline = buildFrontendPipeline();
  var pipes = [
    buildPipeline,
    ...iterateBlocksPerPlatform(container, staticHostingGcp, staticHostingAws)
  ];
  var awsCount = 0;
  var gcpCount = 0;
  iterateBlocksPerPlatform(container, () => gcpCount++, () => awsCount++);
  if (container["cr_[terraform]"] && gcpCount === 0) {
    pipes.push(pipeline([
      step(() => ({
        imports: [{
          url: GCP_CLOUDRUN_STATIC_HOSTING_URL,
          copyFromContainer: ["default", "global_default", "cr_[terraform]"],
          input: []
        }]
      }))
    ]));
  }
  if (container["cr_[terraform]"] && awsCount === 0) {
    pipes.push(pipeline([
      step(() => ({
        imports: [{
          url: AWS_CLOUDFRONT_STATIC_HOSTING_URL,
          copyFromContainer: ["default", "global_default", "cr_[terraform]"],
          input: []
        }]
      }))
    ]));
  }
  executePipelineGroup(container, pipes);
})();
/*! Bundled license information:

is-buffer/index.js:
  (*!
   * Determine if an object is a Buffer
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)
*/
