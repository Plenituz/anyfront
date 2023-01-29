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
  function visitTokens(root, visitor) {
    const result = visitor(root);
    if (result) {
      return result;
    }
    switch (root.Type) {
      default:
        return root;
      case "anon":
      case "literal_value":
      case "scope_traversal":
        return root;
      case "relative_traversal":
        return {
          Type: "relative_traversal",
          Meta: root.Meta || void 0,
          Source: visitTokens(root.Source, visitor),
          Traversal: root.Traversal
        };
      case "splat":
        return {
          Type: "splat",
          Meta: root.Meta || void 0,
          Source: visitTokens(root.Source, visitor),
          SplatEach: visitTokens(root.SplatEach, visitor)
        };
      case "object_const":
        return {
          Type: "object_const",
          Meta: root.Meta || void 0,
          ObjectConst: root.ObjectConst?.map((item) => ({
            Key: item.Key,
            Value: visitTokens(item.Value, visitor)
          }))
        };
      case "array_const":
        return {
          Type: "array_const",
          Meta: root.Meta || void 0,
          ArrayConst: root.ArrayConst?.map((item) => visitTokens(item, visitor))
        };
      case "template":
        return {
          Type: "template",
          Meta: root.Meta || void 0,
          Parts: root.Parts?.map((item) => visitTokens(item, visitor))
        };
      case "function_call":
        return {
          Type: "function_call",
          Meta: root.Meta || void 0,
          FunctionName: root.FunctionName,
          FunctionArgs: root.FunctionArgs?.map((item) => visitTokens(item, visitor))
        };
      case "index_access":
        return {
          Type: "index_access",
          Meta: root.Meta || void 0,
          IndexCollection: visitTokens(root.IndexCollection, visitor),
          IndexKey: visitTokens(root.IndexKey, visitor)
        };
      case "conditional":
        return {
          Type: "conditional",
          Meta: root.Meta || void 0,
          Condition: visitTokens(root.Condition, visitor),
          TrueResult: visitTokens(root.TrueResult, visitor),
          FalseResult: visitTokens(root.FalseResult, visitor)
        };
      case "parens":
        return {
          Type: "parens",
          Meta: root.Meta || void 0,
          Source: visitTokens(root.Source, visitor)
        };
      case "binary_op":
        return {
          Type: "binary_op",
          Meta: root.Meta || void 0,
          Operator: root.Operator,
          RightHandSide: visitTokens(root.RightHandSide, visitor),
          LeftHandSide: visitTokens(root.LeftHandSide, visitor)
        };
      case "unary_op":
        return {
          Type: "unary_op",
          Meta: root.Meta || void 0,
          Operator: root.Operator,
          RightHandSide: visitTokens(root.RightHandSide, visitor)
        };
      case "for":
        return {
          Type: "for",
          Meta: root.Meta || void 0,
          ForKeyVar: root.ForKeyVar,
          ForValVar: root.ForValVar,
          ForCollExpr: visitTokens(root.ForCollExpr, visitor),
          ForKeyExpr: root.ForKeyExpr ? visitTokens(root.ForKeyExpr, visitor) : void 0,
          ForValExpr: visitTokens(root.ForValExpr, visitor),
          ForCondExpr: root.ForCondExpr ? visitTokens(root.ForCondExpr, visitor) : void 0
        };
    }
  }
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
  function asValArrayConst(token) {
    return asVal(token).map((item) => asVal(item));
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
  function asTraversal(str) {
    return {
      Type: "scope_traversal",
      // TODO will output correct string for indexing ("abc[0]") but
      // is using the wrong syntax token (Type: "attr" instead of Type: "index")
      Traversal: str.split(".").map((part) => ({
        Type: "attr",
        Name: part
      }))
    };
  }
  function asTemplate(arr) {
    return {
      Type: "template",
      Parts: arr.map(asSyntax)
    };
  }
  function asTemplateStr(arr) {
    if (!Array.isArray(arr)) {
      arr = [arr];
    }
    return {
      Type: "template",
      Parts: arr.map((item) => {
        if (typeof item === "string") {
          return {
            Type: "literal_value",
            Value: item
          };
        }
        if (item.Type === "scope_traversal" || item.Type === "relative_traversal" || item.Type === "literal_value" || item.Type === "template") {
          return item;
        }
        return {
          Type: "literal_value",
          Value: asStr(item)
        };
      })
    };
  }
  function concatStrArr(token) {
    const arr = asValArrayConst(token);
    const parts = arr.map((item) => asTemplateStr(item).Parts || []).flat();
    return {
      Type: "template",
      Parts: parts
    };
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
  function cloudResourceRaw(params) {
    let typeStr = "cr_";
    if (params.kind) {
      typeStr += "[" + params.kind;
      if (params.id) {
        typeStr += "(" + params.id + ")";
      }
      typeStr += "]";
      if (params.type) {
        typeStr += "_";
      }
    }
    if (params.type) {
      typeStr += params.type;
    }
    let value = params.value || {};
    value = asSyntax(value);
    if (params.dir) {
      value = {
        ...value,
        Meta: {
          sub_dir: params.dir
        }
      };
    }
    return {
      Type: typeStr,
      Name: params.name,
      Value: value
    };
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
      const id = `${component.name}_${component.url}`;
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
  function barbeLifecycleStep() {
    return os.getenv("BARBE_LIFECYCLE_STEP");
  }
  function barbeOutputDir() {
    return os.getenv("BARBE_OUTPUT_DIR");
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
    return [
      blockVal,
      compileNamePrefix(blockVal)
    ];
  }
  function compileNamePrefix(blockVal) {
    return concatStrArr(blockVal.name_prefix || asSyntax([]));
  }
  function preConfCloudResourceFactory(blockVal, kind, preconf, bagPreconf) {
    const cloudResourceId = blockVal.cloudresource_id ? asStr(blockVal.cloudresource_id) : void 0;
    const cloudResourceDir = blockVal.cloudresource_dir ? asStr(blockVal.cloudresource_dir) : void 0;
    return (type, name, value) => {
      value = {
        provider: blockVal.region && type.includes("aws") ? asTraversal(`aws.${asStr(blockVal.region)}`) : void 0,
        ...preconf,
        ...value
      };
      return cloudResourceRaw({
        kind,
        dir: cloudResourceDir,
        id: cloudResourceId,
        type,
        name,
        value: Object.entries(value).filter(([_, v]) => v !== null && v !== void 0).reduce((acc, [k, v]) => Object.assign(acc, { [k]: v }), {}),
        ...bagPreconf
      });
    };
  }
  function applyMixins(str, mixins) {
    for (const mixinName in mixins) {
      str = str.replace(new RegExp(`{{${mixinName}}}`, "g"), mixins[mixinName]);
    }
    return str;
  }

  // aws_cloudfront_static_hosting/lister.go
  var lister_default = 'package main\n\nimport (\n	"bytes"\n	"os"\n	"path/filepath"\n	"strings"\n)\n\n//this is here cause the escaping mecanism of jsonnet doesnt work properly\nconst l = "\\n"\n\nfunc main() {\n	err := listAllFiles()\n	if err != nil {\n		panic(err)\n	}\n}\n\nfunc listAllFiles() error {\n	var files []string\n	err := filepath.WalkDir(".", func(path string, d os.DirEntry, err error) error {\n		if err != nil {\n			return err\n		}\n		if !d.IsDir() {\n			files = append(files, path)\n		}\n		return nil\n	})\n	if err != nil {\n		return err\n	}\n\n	output := strings.Builder{}\n	for i, file := range files {\n		if file == "lister.go" || file == "origin_request.js" {\n			continue\n		}\n		if i != 0 {\n			output.WriteString("    ")\n		}\n		output.WriteString("\\"")\n		output.WriteString(file)\n		output.WriteString("\\": true")\n		if i != len(files)-1 {\n			output.WriteString(",")\n			output.WriteString(l)\n		}\n	}\n\n	template, err := os.ReadFile("origin_request.js")\n	if err != nil {\n		return err\n	}\n\n	template = bytes.ReplaceAll(template, []byte("{{LOCATIONS}}"), []byte(output.String()))\n	return os.WriteFile("origin_request.js", template, 0644)\n}';

  // aws_cloudfront_static_hosting/origin_request.template.js
  var origin_request_template_default = `const locations = {
    {{LOCATIONS}}
}

exports.handler = (event, context, callback) => {
    const request = event.Records[0].cf.request;
    const headers = request.headers;

    if(request.uri.substring(1) in locations) {
        callback(null, request);
        return
    }

    if (request.uri === "/") {
        request.uri = "/{{root_object}}";
    }

    if (request.uri.endsWith("/")) {
        const redirectResponse = {
            status: '301',
            statusDescription: 'Moved Permanently',
            headers: {
                'location': [{
                    key: 'Location',
                    value: request.uri.substring(0, request.uri.length - 1),
                }],
                'cache-control': [{
                    key: 'Cache-Control',
                    value: "max-age=3600"
                }],
            },
        };
        callback(null, redirectResponse)
        return
    }

    if (!request.uri.endsWith(".html")) {
        (() => {
            //receiving something like /docs

            let toFind = request.uri.substring(1)
            if (toFind in locations) {
                return
            }

            // trying file "docs.html"
            toFind += ".html"
            if (toFind in locations) {
                request.uri = "/" + toFind
                return
            }

            // trying file "docs/index.html"
            toFind = toFind.substring(0, toFind.length - ".html".length)
            toFind += "/index.html"
            if (toFind in locations) {
                request.uri = "/" + toFind
                return
            }
            console.log("not found for object request: '" + request.uri + "'")
        })()
    }

    callback(null, request);
};`;

  // anyfront-lib/lib.ts
  function prependTfStateFileName(container2, prefix) {
    const visitor = (token) => {
      if (token.Type === "literal_value" && typeof token.Value === "string" && token.Value.includes(".tfstate")) {
        return {
          ...token,
          Type: "literal_value",
          Value: token.Value.replace(".tfstate", `${prefix}.tfstate`)
        };
      }
      return null;
    };
    return visitTokens(container2["cr_[terraform]"][""][0].Value, visitor);
  }

  // aws_cloudfront_static_hosting/aws_cloudfront_static_hosting.ts
  var import_md5 = __toESM(require_md5());

  // anyfront-lib/consts.ts
  var AWS_CLOUDFRONT_STATIC_HOSTING = "aws_cloudfront_static_hosting";
  var BARBE_SLS_VERSION = "v0.1.1";
  var ANYFRONT_VERSION = "v0.1.1";
  var TERRAFORM_EXECUTE_URL = `https://hub.barbe.app/barbe-serverless/terraform_execute/${BARBE_SLS_VERSION}/.js`;
  var AWS_IAM_URL = `https://hub.barbe.app/barbe-serverless/aws_iam/${BARBE_SLS_VERSION}/.js`;
  var AWS_LAMBDA_URL = `https://hub.barbe.app/barbe-serverless/aws_function/${BARBE_SLS_VERSION}/.js`;
  var GCP_PROJECT_SETUP_URL = `https://hub.barbe.app/anyfront/gcp_project_setup/${ANYFRONT_VERSION}/.js`;

  // ../../barbe-serverless/src/barbe-sls-lib/consts.ts
  var AWS_FUNCTION = "aws_function";
  var AWS_IAM_LAMBDA_ROLE = "aws_iam_lambda_role";
  var BARBE_SLS_VERSION2 = "v0.1.1";
  var TERRAFORM_EXECUTE_URL2 = `https://hub.barbe.app/barbe-serverless/terraform_execute/${BARBE_SLS_VERSION2}/.js`;

  // aws_cloudfront_static_hosting/aws_cloudfront_static_hosting.ts
  var container = readDatabagContainer();
  var outputDir = barbeOutputDir();
  function generateIterator1(bag) {
    if (!bag.Value) {
      return [];
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value);
    if (!block.build_dir) {
      throw new Error(`build_dir is required for 'aws_cloudfront_static_hosting.${bag.Name}'`);
    }
    const dir = `aws_cf_static_hosting_${bag.Name}`;
    const bagPreconf = {
      dir,
      id: dir
    };
    const rootObj = block.root_object || "index.html";
    const domainNames = asVal(block.domain_names || asSyntax([]));
    const cloudResource = preConfCloudResourceFactory(block, "resource", void 0, bagPreconf);
    const cloudData = preConfCloudResourceFactory(block, "data", void 0, bagPreconf);
    const cloudOutput = preConfCloudResourceFactory(block, "output", void 0, bagPreconf);
    const cloudProvider = preConfCloudResourceFactory(block, "provider", void 0, bagPreconf);
    const cloudTerraform = preConfCloudResourceFactory(block, "terraform", void 0, bagPreconf);
    const acmCertificateResources = (domain) => {
      return [
        cloudResource("aws_acm_certificate", "cert", {
          domain_name: domain,
          validation_method: "DNS"
        }),
        cloudResource("aws_route53_record", "validation_record", {
          for_each: {
            Type: "for",
            ForKeyVar: "dvo",
            ForCollExpr: asTraversal("aws_acm_certificate.cert.domain_validation_options"),
            ForKeyExpr: asTraversal("dvo.domain_name"),
            ForValExpr: asSyntax({
              name: asTraversal("dvo.resource_record_name"),
              record: asTraversal("dvo.resource_record_value"),
              type: asTraversal("dvo.resource_record_type")
            })
          },
          allow_overwrite: true,
          name: asTraversal("each.value.name"),
          records: [
            asTraversal("each.value.record")
          ],
          ttl: 60,
          type: asTraversal("each.value.type"),
          zone_id: asTraversal("data.aws_route53_zone.zone.zone_id")
        }),
        cloudResource("aws_acm_certificate_validation", "validation", {
          certificate_arn: asTraversal("aws_acm_certificate.cert.arn"),
          validation_record_fqdns: {
            Type: "for",
            ForValVar: "record",
            ForCollExpr: asTraversal("aws_route53_record.validation_record"),
            ForValExpr: asTraversal("record.fqdn")
          }
        })
      ];
    };
    const staticFileDistrib = () => {
      let localDatabags = [
        cloudProvider("", "aws", {
          region: block.region || os.getenv("AWS_REGION") || "us-east-1"
        }),
        cloudResource("aws_s3_bucket", "origin", {
          bucket: appendToTemplate(namePrefix, ["origin"]),
          force_destroy: true
        }),
        cloudOutput("", "static_hosting_s3_bucket", {
          value: asTraversal("aws_s3_bucket.origin.id")
        }),
        cloudResource("aws_s3_bucket_acl", "origin_acl", {
          bucket: asTraversal("aws_s3_bucket.origin.id"),
          acl: "private"
        }),
        cloudResource("aws_s3_bucket_cors_configuration", "origin_cors", {
          bucket: asTraversal("aws_s3_bucket.origin.id"),
          cors_rule: asBlock([{
            allowed_headers: ["*"],
            allowed_methods: ["GET"],
            allowed_origins: ["*"],
            max_age_seconds: 3e3
          }])
        }),
        cloudResource("aws_cloudfront_origin_access_identity", "origin_access_id", {
          comment: asTemplate([
            "origin access identity for",
            appendToTemplate(namePrefix, ["origin"])
          ])
        }),
        cloudData("aws_iam_policy_document", "origin_policy", {
          statement: asBlock([
            {
              actions: ["s3:GetObject"],
              resources: [
                asTemplate([
                  asTraversal("aws_s3_bucket.origin.arn"),
                  "/*"
                ])
              ],
              principals: asBlock([{
                type: "AWS",
                identifiers: [
                  asTraversal("aws_cloudfront_origin_access_identity.origin_access_id.iam_arn")
                ]
              }])
            },
            {
              actions: ["s3:ListBucket"],
              resources: [
                asTraversal("aws_s3_bucket.origin.arn")
              ],
              principals: asBlock([{
                type: "AWS",
                identifiers: [
                  asTraversal("aws_cloudfront_origin_access_identity.origin_access_id.iam_arn")
                ]
              }])
            }
          ])
        }),
        cloudResource("aws_s3_bucket_policy", "origin_policy", {
          bucket: asTraversal("aws_s3_bucket.origin.id"),
          policy: asTraversal("data.aws_iam_policy_document.origin_policy.json")
        }),
        cloudOutput("", "static_hosting_cf_distrib", {
          value: asTraversal("aws_cloudfront_distribution.distribution.id")
        }),
        cloudData("aws_cloudfront_cache_policy", "caching_optimized", {
          name: "Managed-CachingOptimized"
        }),
        cloudResource("aws_cloudfront_distribution", "distribution", {
          enabled: true,
          default_root_object: rootObj,
          is_ipv6_enabled: true,
          price_class: "PriceClass_All",
          restrictions: asBlock([{
            geo_restriction: asBlock([{
              restriction_type: "none"
            }])
          }]),
          origin: asBlock([{
            domain_name: asTraversal("aws_s3_bucket.origin.bucket_regional_domain_name"),
            origin_id: "bucket",
            s3_origin_config: asBlock([{
              origin_access_identity: asTraversal("aws_cloudfront_origin_access_identity.origin_access_id.cloudfront_access_identity_path")
            }])
          }]),
          default_cache_behavior: asBlock([{
            allowed_methods: ["GET", "HEAD", "OPTIONS"],
            cached_methods: ["GET", "HEAD"],
            target_origin_id: "bucket",
            viewer_protocol_policy: "redirect-to-https",
            compress: true,
            cache_policy_id: asTraversal("data.aws_cloudfront_cache_policy.caching_optimized.id"),
            lambda_function_association: asBlock([{
              event_type: "origin-request",
              lambda_arn: asTraversal("aws_function.origin-request.qualified_arn"),
              include_body: false
            }])
          }]),
          custom_error_response: asBlock([{
            error_caching_min_ttl: 0,
            error_code: 404,
            response_code: 200,
            response_page_path: appendToTemplate(asSyntax("/"), [rootObj])
          }]),
          aliases: domainNames,
          viewer_certificate: asBlock([
            (() => {
              const minimumProtocolVersion = "TLSv1.2_2021";
              if (domainNames.length === 0) {
                return {
                  cloudfront_default_certificate: true
                };
              }
              if (block.certificate_arn) {
                return {
                  acm_certificate_arn: block.certificate_arn,
                  ssl_support_method: "sni-only",
                  minimum_protocol_version: minimumProtocolVersion
                };
              }
              if (block.existing_certificate_domain) {
                return {
                  acm_certificate_arn: asTraversal(`data.aws_acm_certificate.imported_certificate.arn`),
                  ssl_support_method: "sni-only",
                  minimum_protocol_version: minimumProtocolVersion
                };
              }
              if (block.certificate_domain_to_create) {
                return {
                  acm_certificate_arn: asTraversal(`aws_acm_certificate_validation.validation.certificate_arn`),
                  ssl_support_method: "sni-only",
                  minimum_protocol_version: minimumProtocolVersion
                };
              }
              if (domainNames.length > 1) {
                throw new Error("no certificate_domain_to_create, existing_certificate_domain or certificate_arn given with multiple domain names. The easy way to fix this is to provide a certificate_domain_to_create like '*.domain.com'");
              }
              return {
                acm_certificate_arn: asTraversal(`data.aws_acm_certificate.imported_certificate.arn`),
                ssl_support_method: "sni-only",
                minimum_protocol_version: minimumProtocolVersion
              };
            })()
          ])
        })
      ];
      if (domainNames.length > 0) {
        localDatabags.push(
          cloudData("aws_route53_zone", "zone", {
            name: block.zone
          }),
          ...domainNames.map((domainName) => cloudResource("aws_route53_record", `cf_distrib_domain_record_${(0, import_md5.default)(asStr(domainName))}`, {
            zone_id: asTraversal("data.aws_route53_zone.zone.zone_id"),
            name: domainName,
            type: "CNAME",
            ttl: 300,
            records: [
              asTraversal("aws_cloudfront_distribution.distribution.domain_name")
            ]
          }))
        );
        if (!block.certificate_arn) {
          if (block.existing_certificate_domain) {
            localDatabags.push(
              cloudData("aws_acm_certificate", "imported_certificate", {
                domain: block.existing_certificate_domain,
                types: ["AMAZON_ISSUED"],
                most_recent: true
              })
            );
          } else if (block.certificate_domain_to_create) {
            localDatabags.push(...acmCertificateResources(block.certificate_domain_to_create));
          } else if (domainNames.length === 1) {
            localDatabags.push(...acmCertificateResources(domainNames[0]));
          }
        }
      }
      return localDatabags;
    };
    let databags = [
      {
        Type: "buildkit_run_in_container",
        Name: `aws_cloudfront_static_hosting_gen_origin_req_${bag.Name}`,
        Value: {
          no_cache: true,
          display_name: `\u03BB Codegen - aws_cloudfront_static_hosting.${bag.Name}`,
          input_files: {
            "__barbe_lister.go": lister_default,
            "__barbe_base_script.js": applyMixins(origin_request_template_default, {
              root_object: rootObj
            })
          },
          dockerfile: `
                    FROM golang:1.18-alpine AS builder

                    COPY --from=src ./${asStr(block.build_dir)} /src
                    WORKDIR /src

                    COPY --from=src __barbe_base_script.js ./origin_request.js
                    COPY --from=src __barbe_lister.go ./lister.go
                    RUN go run lister.go`,
          exported_files: {
            "origin_request.js": `aws_cf_static_hosting_${bag.Name}/origin_request.js`
          }
        }
      },
      ...staticFileDistrib()
    ];
    if (container["cr_[terraform]"]) {
      databags.push(cloudTerraform("", "", prependTfStateFileName(container, `_aws_cf_static_hosting_${bag.Name}`)));
    }
    let imports = [
      {
        name: `aws_cloudfront_static_hosting_aws_iam_${bag.Name}`,
        url: AWS_IAM_URL,
        input: [{
          Type: AWS_IAM_LAMBDA_ROLE,
          Name: "default",
          Value: {
            cloudresource_dir: dir,
            cloudresource_id: dir,
            assumable_by: ["edgelambda.amazonaws.com", "lambda.amazonaws.com"],
            name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])]
          }
        }]
      },
      {
        name: `aws_cloudfront_static_hosting_aws_lambda_${bag.Name}`,
        url: AWS_LAMBDA_URL,
        input: [{
          Type: AWS_FUNCTION,
          Name: "origin-request",
          Value: {
            cloudresource_dir: dir,
            cloudresource_id: dir,
            package: [{
              file_map: {
                "*": "origin_request.js"
              },
              include: [
                `${outputDir}/${dir}/origin_request.js`
              ]
            }],
            handler: "origin_request.handler",
            runtime: "nodejs16.x",
            timeout: 30,
            name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])]
          }
        }]
      }
    ];
    return [{ databags, imports }];
  }
  function generate() {
    const dbOrImports = iterateBlocks(container, AWS_CLOUDFRONT_STATIC_HOSTING, generateIterator1).flat();
    exportDatabags(dbOrImports.map((db) => db.databags).flat());
    let tmp = importComponents(container, dbOrImports.map((db) => db.imports).flat());
    console.log(JSON.stringify(tmp, null, 2));
    exportDatabags(tmp);
  }
  switch (barbeLifecycleStep()) {
    case "generate":
      generate();
      break;
  }
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
