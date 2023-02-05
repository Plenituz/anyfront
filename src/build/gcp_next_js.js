(() => {
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
  function isSimpleTemplate(token) {
    if (!token) {
      return false;
    }
    if (typeof token === "string" || token.Type === "literal_value") {
      return true;
    }
    if (token.Type !== "template") {
      return false;
    }
    if (!token.Parts) {
      return true;
    }
    return token.Parts.every(isSimpleTemplate);
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
    return {
      Type: "template",
      Parts: asTemplateStr(token.ArrayConst || []).Parts?.flat() || []
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
  function barbeCommand() {
    return os.getenv("BARBE_COMMAND");
  }
  function barbeOutputDir() {
    return os.getenv("BARBE_OUTPUT_DIR");
  }
  var BarbeState = {
    readState: () => JSON.parse(os.file.readFile("__barbe_state.json")),
    setValue: (key, value) => ({
      Type: "barbe_state(set_value)",
      Name: key,
      Value: value
    }),
    deleteKey: (key) => ({
      Type: "barbe_state(delete_key)",
      Name: key,
      Value: null
    }),
    putInObject: (key, value) => ({
      Type: "barbe_state(put_in_object)",
      Name: key,
      Value: value
    }),
    getObjectValue: (state2, key, valueKey) => state2 && state2[key] && state2[key][valueKey],
    deleteFromObject: (key, valueKey) => ({
      Type: "barbe_state(delete_from_object)",
      Name: key,
      Value: valueKey
    })
  };

  // anyfront-lib/consts.ts
  var GCP_PROJECT_SETUP = "gcp_project_setup";
  var GCP_PROJECT_SETUP_GET_INFO = "gcp_project_setup_get_info";
  var GCP_NEXT_JS = "gcp_next_js";
  var BARBE_SLS_VERSION = "v0.2.1";
  var ANYFRONT_VERSION = "v0.2.1";
  var TERRAFORM_EXECUTE_URL = `https://hub.barbe.app/barbe-serverless/terraform_execute/${BARBE_SLS_VERSION}/.js`;
  var AWS_IAM_URL = `https://hub.barbe.app/barbe-serverless/aws_iam/${BARBE_SLS_VERSION}/.js`;
  var AWS_LAMBDA_URL = `https://hub.barbe.app/barbe-serverless/aws_function/${BARBE_SLS_VERSION}/.js`;
  var GCP_PROJECT_SETUP_URL = `https://hub.barbe.app/anyfront/gcp_project_setup/${ANYFRONT_VERSION}/.js`;
  var AWS_S3_SYNC_URL = `https://hub.barbe.app/anyfront/aws_s3_sync_files/${ANYFRONT_VERSION}/.js`;
  var FRONTEND_BUILD_URL = `https://hub.barbe.app/anyfront/frontend_build/${ANYFRONT_VERSION}/.js`;
  var GCP_CLOUDRUN_STATIC_HOSTING_URL = `https://hub.barbe.app/anyfront/gcp_cloudrun_static_hosting/${ANYFRONT_VERSION}/.js`;
  var AWS_CLOUDFRONT_STATIC_HOSTING_URL = `https://hub.barbe.app/anyfront/aws_cloudfront_static_hosting/${ANYFRONT_VERSION}/.js`;

  // gcp_next_js/Dockerfile.dockerfile
  var Dockerfile_default = '# https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile\nFROM node:{{node_version}}{{node_version_tag}}\nWORKDIR /app\n\nENV NODE_ENV production\nENV NEXT_TELEMETRY_DISABLED 1\n\nCOPY . .\n\nEXPOSE 8080\nENV PORT 8080\nCMD ["node", "server.js"]';

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
  function compileBlockParam(blockVal, blockName) {
    return asVal(mergeTokens((blockVal[blockName] || asSyntax([])).ArrayConst || []));
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
  var __gcpTokenCached = "";
  function getGcpToken(optional) {
    if (__gcpTokenCached) {
      return __gcpTokenCached;
    }
    const transformed = applyTransformers([{
      Name: "state_store_credentials",
      Type: "gcp_token_request",
      Value: { optional }
    }]);
    const token = transformed.gcp_token?.state_store_credentials[0]?.Value;
    if (!token) {
      return void 0;
    }
    __gcpTokenCached = asStr(asVal(token).access_token);
    return __gcpTokenCached;
  }
  function applyMixins(str, mixins) {
    for (const mixinName in mixins) {
      str = str.replace(new RegExp(`{{${mixinName}}}`, "g"), mixins[mixinName]);
    }
    return str;
  }

  // anyfront-lib/lib.ts
  function emptyExecuteBagNamePrefix(stateKey) {
    return `${stateKey}_destroy_missing_`;
  }
  function emptyExecuteTemplate(container2, state2, blockType, stateKey) {
    const stateObj = state2[stateKey];
    if (!stateObj) {
      return [];
    }
    let output = [];
    for (const [bagName, tfBlock] of Object.entries(stateObj)) {
      if (container2[blockType][bagName]) {
        continue;
      }
      output.push({
        Type: "terraform_empty_execute",
        Name: `${emptyExecuteBagNamePrefix(stateKey)}${bagName}`,
        Value: {
          mode: "apply",
          template_json: JSON.stringify({
            terraform: (() => {
              let tfObj = {};
              for (const [key, value] of Object.entries(tfBlock)) {
                tfObj[key] = {
                  [value[0].Meta.Labels[0]]: (() => {
                    let obj = {};
                    for (const [innerKey, innerValue] of Object.entries(value[0])) {
                      obj[innerKey] = innerValue;
                    }
                    return obj;
                  })()
                };
              }
              return tfObj;
            })()
          })
        }
      });
    }
    return output;
  }
  function emptyExecutePostProcess(container2, results, blockType, stateKey) {
    if (!results.terraform_empty_execute_output) {
      return [];
    }
    let output = [];
    const prefix = emptyExecuteBagNamePrefix(stateKey);
    for (const prefixedName of Object.keys(results.terraform_empty_execute_output)) {
      if (!prefixedName.startsWith(prefix)) {
        continue;
      }
      const nonPrefixedName = prefixedName.replace(prefix, "");
      if (container2?.[blockType]?.[nonPrefixedName]) {
        continue;
      }
      output.push(BarbeState.deleteFromObject(stateKey, nonPrefixedName));
    }
    return output;
  }
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
    if (!container2["cr_[terraform]"]) {
      return;
    }
    return visitTokens(container2["cr_[terraform]"][""][0].Value, visitor);
  }

  // gcp_next_js/gcp_next_js.ts
  var container = readDatabagContainer();
  var outputDir = barbeOutputDir();
  var state = BarbeState.readState();
  var CREATED_TF_STATE_KEY = "created_tfstate";
  function makeEmptyExecuteDatabags(container2, state2) {
    if (!container2["cr_[terraform]"]) {
      return [];
    }
    return emptyExecuteTemplate(container2, state2, GCP_NEXT_JS, CREATED_TF_STATE_KEY);
  }
  function makeGcpProjectSetupImport(bag, block, namePrefix) {
    return {
      name: `gcp_next_js_${barbeLifecycleStep()}_${bag.Name}`,
      url: GCP_PROJECT_SETUP_URL,
      copyFromContainer: ["cr_[terraform]"],
      input: [{
        Type: GCP_PROJECT_SETUP,
        Name: bag.Name,
        Value: {
          project_id: block.project_id,
          project_name: appendToTemplate(namePrefix, [bag.Name]),
          organization_id: block.organization_id,
          billing_account_id: block.billing_account_id,
          billing_account_name: block.billing_account_name,
          services_to_activate: [
            "run.googleapis.com",
            "compute.googleapis.com",
            "dns.googleapis.com"
          ]
        }
      }]
    };
  }
  function preGenerate() {
    if (container.state_store) {
      return;
    }
    const databags = iterateBlocks(container, GCP_NEXT_JS, (bag) => {
      const [block, namePrefix] = applyDefaults(container, bag.Value);
      if (!isSimpleTemplate(namePrefix)) {
        return [];
      }
      return [{
        Type: "state_store",
        Name: "",
        Value: {
          name_prefix: [`${bag.Name}-`],
          gcs: asBlock([{
            project_id: block.project_id
          }])
        }
      }];
    }).flat();
    exportDatabags(databags);
  }
  function generateIterator1(bag) {
    if (!bag.Value) {
      return [];
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value);
    const dir = `gcp_next_js_${bag.Name}`;
    const bagPreconf = {
      dir,
      id: dir
    };
    const dotDomain = compileBlockParam(block, "domain");
    const dotBuild = compileBlockParam(block, "build");
    const nodeJsVersion = asStr(dotBuild.nodejs_version || block.nodejs_version || "16");
    const cloudResource = preConfCloudResourceFactory(block, "resource", void 0, bagPreconf);
    const cloudData = preConfCloudResourceFactory(block, "data", void 0, bagPreconf);
    const cloudOutput = preConfCloudResourceFactory(block, "output", void 0, bagPreconf);
    const cloudProvider = preConfCloudResourceFactory(block, "provider", void 0, bagPreconf);
    const cloudVariable = preConfCloudResourceFactory(block, "variable", void 0, bagPreconf);
    const cloudTerraform = preConfCloudResourceFactory(block, "terraform", void 0, bagPreconf);
    const nextJsBuild = () => {
      const nodeJsVersionTag = asStr(dotBuild.nodejs_version_tag || block.nodejs_version_tag || "-alpine");
      const appDir = asStr(dotBuild.app_dir || block.app_dir || ".");
      const installCmd = asStr(dotBuild.install_cmd || "npm install");
      const buildCmd = asStr(dotBuild.build_cmd || "npm run build");
      return {
        Type: "buildkit_run_in_container",
        Name: `gcp_next_js_${bag.Name}`,
        Value: {
          display_name: `Next.js build - ${bag.Name}`,
          excludes: [
            "**/node_modules",
            "node_modules",
            outputDir
          ],
          dockerfile: `
                    # https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile
                    # Rebuild the source code only when needed
                    FROM node:${nodeJsVersion}${nodeJsVersionTag} AS builder
                    RUN apk add --no-cache libc6-compat

                    WORKDIR /app
                    COPY --from=src ./${appDir} .
                    
                    ENV NEXT_TELEMETRY_DISABLED 1
                    RUN ${installCmd}
                    RUN ${buildCmd}

                    # Production image, copy all the files and run next
                    FROM scratch
                    WORKDIR /app

                    COPY --from=builder /app/public ./public
                    COPY --from=builder /app/.next/standalone ./
                    COPY --from=builder /app/.next/static ./.next/static`,
          exported_files: {
            "/app": `${dir}/build`
          }
        }
      };
    };
    const gcpNextJsResources = () => {
      let localDatabags = [
        cloudVariable("", "gcp_project", {
          type: asTraversal("string")
        }),
        cloudProvider("", "google", {
          region: block.region || "us-central1",
          project: asTraversal("var.gcp_project")
        }),
        cloudResource("google_cloud_run_service", "cloudrun", {
          name: appendToTemplate(namePrefix, [`${bag.Name}-cloudrun-srv`]),
          location: block.region || "us-central1",
          autogenerate_revision_name: true,
          template: asBlock([{
            spec: asBlock([{
              containers: asBlock([{
                image: asTemplate([
                  "gcr.io/",
                  asTraversal("var.gcp_project"),
                  "/",
                  asStr(appendToTemplate(namePrefix, [`next-${bag.Name}`])),
                  ":latest"
                ])
              }])
            }])
          }]),
          traffic: asBlock([{
            percent: 100,
            latest_revision: true
          }])
        }),
        cloudData("google_iam_policy", "noauth", {
          binding: asBlock([{
            role: "roles/run.invoker",
            members: ["allUsers"]
          }])
        }),
        cloudResource("google_cloud_run_service_iam_policy", "noauth", {
          location: asTraversal("google_cloud_run_service.cloudrun.location"),
          service: asTraversal("google_cloud_run_service.cloudrun.name"),
          project: asTraversal("google_cloud_run_service.cloudrun.project"),
          policy_data: asTraversal("data.google_iam_policy.noauth.policy_data")
        }),
        cloudResource("google_compute_global_address", "lb_ip", {
          project: asTraversal("google_cloud_run_service.cloudrun.project"),
          name: appendToTemplate(namePrefix, [`${bag.Name}-lb-ip`])
        }),
        cloudResource("google_compute_region_network_endpoint_group", "lb_epgroup", {
          project: asTraversal("google_cloud_run_service.cloudrun.project"),
          name: appendToTemplate(namePrefix, [`${bag.Name}-lb-neg`]),
          region: block.region || "us-central1",
          network_endpoint_type: "SERVERLESS",
          cloud_run: asBlock([{
            service: asTraversal("google_cloud_run_service.cloudrun.name")
          }])
        }),
        cloudResource("google_compute_backend_service", "lb_backend", {
          project: asTraversal("google_cloud_run_service.cloudrun.project"),
          name: appendToTemplate(namePrefix, [`${bag.Name}-lb-backend`]),
          load_balancing_scheme: "EXTERNAL_MANAGED",
          enable_cdn: true,
          backend: asBlock([{
            balancing_mode: "UTILIZATION",
            capacity_scaler: 0.85,
            group: asTraversal("google_compute_region_network_endpoint_group.lb_epgroup.id")
          }]),
          cdn_policy: asBlock([{
            cache_mode: "CACHE_ALL_STATIC",
            client_ttl: 3600,
            default_ttl: 3600,
            max_ttl: 86400,
            negative_caching: true,
            serve_while_stale: 86400,
            signed_url_cache_max_age_sec: 7200
          }])
        }),
        cloudResource("google_compute_url_map", "lb_urlmap", {
          project: asTraversal("google_cloud_run_service.cloudrun.project"),
          name: appendToTemplate(namePrefix, [`${bag.Name}-lb-urlmap`]),
          default_service: asTraversal("google_compute_backend_service.lb_backend.id"),
          path_matcher: asBlock([{
            name: "allpaths",
            default_service: asTraversal("google_compute_backend_service.lb_backend.id"),
            route_rules: asBlock([{
              priority: 1,
              url_redirect: asBlock([{
                https_redirect: true,
                redirect_response_code: "MOVED_PERMANENTLY_DEFAULT"
              }])
            }])
          }])
        }),
        cloudOutput("", "load_balancer_ip_addr", {
          value: asTraversal("google_compute_global_address.lb_ip.address")
        }),
        cloudOutput("", "load_balancer_url_map", {
          value: asTraversal("google_compute_url_map.lb_urlmap.name")
        }),
        cloudOutput("", "cloudrun_service_name", {
          value: asTraversal("google_cloud_run_service.cloudrun.name")
        })
      ];
      if (dotDomain.name) {
        localDatabags.push(
          cloudResource("google_compute_target_https_proxy", "lb_target_https", {
            project: asTraversal("google_cloud_run_service.cloudrun.project"),
            name: appendToTemplate(namePrefix, [`${bag.Name}-https-proxy`]),
            url_map: asTraversal("google_compute_url_map.lb_urlmap.id"),
            ssl_certificates: [asTraversal("google_compute_managed_ssl_certificate.lb_ssl_cert.name")]
          }),
          cloudResource("google_compute_global_forwarding_rule", "lb_forwarding", {
            project: asTraversal("google_cloud_run_service.cloudrun.project"),
            name: appendToTemplate(namePrefix, [`${bag.Name}-lb-forwarding`]),
            load_balancing_scheme: "EXTERNAL_MANAGED",
            target: asTraversal("google_compute_target_https_proxy.lb_target_https.id"),
            ip_address: asTraversal("google_compute_global_address.lb_ip.id"),
            port_range: "443"
          }),
          cloudResource("google_compute_url_map", "lb_redirect_to_https", {
            project: asTraversal("google_cloud_run_service.cloudrun.project"),
            name: appendToTemplate(namePrefix, [`${bag.Name}-lb-redirect-to-https-urlmap`]),
            default_url_redirect: asBlock([{
              redirect_response_code: "MOVED_PERMANENTLY_DEFAULT",
              https_redirect: true,
              strip_query: false
            }])
          }),
          cloudResource("google_compute_target_http_proxy", "lb_target_http", {
            project: asTraversal("google_cloud_run_service.cloudrun.project"),
            name: appendToTemplate(namePrefix, [`${bag.Name}-http-proxy`]),
            url_map: asTraversal("google_compute_url_map.lb_redirect_to_https.id")
          }),
          cloudResource("google_compute_global_forwarding_rule", "lb_http_forwarding", {
            project: asTraversal("google_cloud_run_service.cloudrun.project"),
            name: appendToTemplate(namePrefix, [`${bag.Name}-http-forwarding`]),
            target: asTraversal("google_compute_target_http_proxy.lb_target_http.id"),
            ip_address: asTraversal("google_compute_global_address.lb_ip.id"),
            port_range: "80"
          }),
          cloudResource("google_compute_managed_ssl_certificate", "lb_ssl_cert", {
            project: asTraversal("google_cloud_run_service.cloudrun.project"),
            name: appendToTemplate(namePrefix, [`${bag.Name}-lb-ssl-cert`]),
            managed: asBlock([{
              domains: [appendToTemplate(dotDomain.name, ["."])]
            }])
          }),
          cloudResource("google_dns_record_set", "lb_dns", {
            project: dotDomain.zone_project || asTraversal("google_cloud_run_service.cloudrun.project"),
            name: appendToTemplate(dotDomain.name, ["."]),
            type: "A",
            ttl: 300,
            managed_zone: dotDomain.zone,
            rrdatas: [asTraversal("google_compute_global_address.lb_ip.address")]
          })
        );
      } else {
        localDatabags.push(
          cloudResource("google_compute_target_http_proxy", "lb_target_http", {
            project: asTraversal("google_cloud_run_service.cloudrun.project"),
            name: appendToTemplate(namePrefix, [`${bag.Name}-http-proxy`]),
            url_map: asTraversal("google_compute_url_map.lb_urlmap.id")
          }),
          cloudResource("google_compute_global_forwarding_rule", "lb_http_forwarding", {
            project: asTraversal("google_cloud_run_service.cloudrun.project"),
            name: appendToTemplate(namePrefix, [`${bag.Name}-http-forwarding`]),
            load_balancing_scheme: "EXTERNAL_MANAGED",
            target: asTraversal("google_compute_target_http_proxy.lb_target_http.id"),
            ip_address: asTraversal("google_compute_global_address.lb_ip.id"),
            port_range: "80"
          })
        );
      }
      return localDatabags;
    };
    let databags = gcpNextJsResources();
    if (barbeCommand() !== "destroy" && !(dotBuild.disabled && asVal(dotBuild.disabled))) {
      databags.push(nextJsBuild());
    }
    if (container["cr_[terraform]"]) {
      databags.push(cloudTerraform("", "", prependTfStateFileName(container, `_gcp_next_js_${bag.Name}`)));
    }
    return [{
      databags,
      imports: [makeGcpProjectSetupImport(bag, block, namePrefix)]
    }];
  }
  function generate() {
    const dbOrImports = iterateBlocks(container, GCP_NEXT_JS, generateIterator1).flat();
    exportDatabags(dbOrImports.map((db) => db.databags).flat());
    exportDatabags(importComponents(container, dbOrImports.map((db) => db.imports).flat()));
  }
  function applyIteratorStep1(bag) {
    if (!bag.Value) {
      return [];
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value);
    return [
      makeGcpProjectSetupImport(bag, block, namePrefix)
    ];
  }
  var applyIteratorStep2 = (gcpProjectSetupResults) => (bag) => {
    if (!bag.Value) {
      return [];
    }
    if (!gcpProjectSetupResults.gcp_project_setup_output?.[bag.Name]) {
      return [];
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value);
    const dotBuild = compileBlockParam(block, "build");
    const gcpToken = getGcpToken(false);
    const gcpProjectName = asStr(asVal(gcpProjectSetupResults.gcp_project_setup_output[bag.Name][0].Value).project_name);
    const imageName = asStr(appendToTemplate(namePrefix, ["next-", bag.Name]));
    const dir = `${outputDir}/gcp_next_js_${bag.Name}`;
    const buildDir = `${dir}/build`;
    const nodeJsVersion = asStr(dotBuild.nodejs_version || block.nodejs_version || "16");
    const nodeJsVersionTag = asStr(dotBuild.nodejs_version_tag || block.nodejs_version_tag || "-alpine");
    const gcpNginxImageBuild = {
      Type: "buildkit_run_in_container",
      Name: `${bag.Name}_gcp_next_js`,
      Value: {
        display_name: `Image build - gcp_next_js.${bag.Name}`,
        no_cache: true,
        input_files: {
          "__barbe_Dockerfile": applyMixins(Dockerfile_default, {
            node_version: nodeJsVersion,
            node_version_tag: nodeJsVersionTag
          })
        },
        dockerfile: `
                FROM docker

                RUN echo "${gcpToken}" | docker login -u oauth2accesstoken --password-stdin https://gcr.io

                COPY --from=src ./${buildDir} /src
                WORKDIR /src

                RUN mkdir __barbe_tmp
                COPY --from=src __barbe_Dockerfile ./__barbe_tmp/Dockerfile

                RUN --mount=type=ssh,id=docker.sock,target=/var/run/docker.sock docker build -f __barbe_tmp/Dockerfile -t gcr.io/${gcpProjectName}/${imageName} .
                RUN --mount=type=ssh,id=docker.sock,target=/var/run/docker.sock docker push gcr.io/${gcpProjectName}/${imageName}`
      }
    };
    const tfExecute = {
      name: `gcp_cloudrun_static_hosting_apply_${bag.Name}`,
      url: TERRAFORM_EXECUTE_URL,
      input: [{
        Type: "terraform_execute",
        Name: `gcp_next_js_apply_${bag.Name}`,
        Value: {
          display_name: `Terraform apply - gcp_next_js.${bag.Name}`,
          mode: "apply",
          dir,
          variable_values: [{
            key: "gcp_project",
            value: gcpProjectName
          }]
        }
      }]
    };
    return [{
      databags: [gcpNginxImageBuild],
      imports: [tfExecute]
    }];
  };
  var applyIteratorStep3 = (gcpProjectSetupResults, terraformExecuteResults) => (bag) => {
    if (!bag.Value) {
      return [];
    }
    let databags = [];
    if (container["cr_[terraform]"]) {
      databags.push(
        BarbeState.putInObject(CREATED_TF_STATE_KEY, {
          [bag.Name]: prependTfStateFileName(container, `_gcp_next_js_${bag.Name}`)
        })
      );
    }
    if (!terraformExecuteResults.terraform_execute_output?.[`gcp_next_js_apply_${bag.Name}`]) {
      return databags;
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value);
    const tfOutput = asValArrayConst(terraformExecuteResults.terraform_execute_output[`gcp_next_js_apply_${bag.Name}`][0].Value);
    const cloudrunServiceName = asStr(tfOutput.find((pair) => asStr(pair.key) === "cloudrun_service_name").value);
    const urlMapName = asStr(tfOutput.find((pair) => asStr(pair.key) === "load_balancer_url_map").value);
    const imageName = asStr(appendToTemplate(namePrefix, ["next-", bag.Name]));
    const gcpProjectName = asStr(asVal(gcpProjectSetupResults.gcp_project_setup_output[bag.Name][0].Value).project_name);
    const gcpToken = getGcpToken(false);
    const region = asStr(block.region || "us-central1");
    databags.push({
      Type: "buildkit_run_in_container",
      Name: `gcp_next_js_invalidate_${bag.Name}`,
      Value: {
        display_name: `Invalidate CDN - gcp_next_js.${bag.Name}`,
        no_cache: true,
        dockerfile: `
            FROM google/cloud-sdk:slim

            ENV CLOUDSDK_AUTH_ACCESS_TOKEN="${gcpToken}"
            ENV CLOUDSDK_CORE_DISABLE_PROMPTS=1

            RUN gcloud run deploy ${cloudrunServiceName} --image gcr.io/${gcpProjectName}/${imageName} --project ${gcpProjectName} --region ${region} --quiet
            RUN gcloud beta compute url-maps invalidate-cdn-cache ${urlMapName} --path "/*" --project ${gcpProjectName} --async --quiet`
      }
    });
    return databags;
  };
  function apply() {
    let step0Import = iterateBlocks(container, GCP_NEXT_JS, applyIteratorStep1).flat();
    const emptyApplies = makeEmptyExecuteDatabags(container, state);
    if (emptyApplies.length !== 0) {
      step0Import.push({
        name: "gcp_next_js_empty_apply",
        url: TERRAFORM_EXECUTE_URL,
        input: emptyApplies
      });
    }
    const gcpProjectSetupResults = importComponents(container, step0Import);
    const step1 = iterateBlocks(container, GCP_NEXT_JS, applyIteratorStep2(gcpProjectSetupResults)).flat();
    exportDatabags(emptyExecutePostProcess(container, gcpProjectSetupResults, GCP_NEXT_JS, CREATED_TF_STATE_KEY));
    applyTransformers(step1.map((db) => db.databags).flat());
    const terraformExecuteResults = importComponents(container, step1.map((db) => db.imports).flat());
    applyTransformers(iterateBlocks(container, GCP_NEXT_JS, applyIteratorStep3(gcpProjectSetupResults, terraformExecuteResults)).flat());
  }
  function destroyIteratorGetGcpProjectInfo(bag) {
    if (!bag.Value) {
      return [];
    }
    return [{
      Type: GCP_PROJECT_SETUP_GET_INFO,
      Name: `gcp_next_js_get_info_${bag.Name}`,
      Value: {
        name: bag.Name
      }
    }];
  }
  function destroyIterator1(bag) {
    if (!bag.Value) {
      return [];
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value);
    return [
      makeGcpProjectSetupImport(bag, block, namePrefix)
    ];
  }
  var destroyIterator2 = (gcpProjectSetupResults) => (bag) => {
    if (!bag.Value) {
      return [];
    }
    if (!gcpProjectSetupResults.gcp_project_setup_output || !gcpProjectSetupResults.gcp_project_setup_output[`gcp_next_js_get_info_${bag.Name}`]) {
      return [];
    }
    const gcpProjectName = asStr(asVal(gcpProjectSetupResults.gcp_project_setup_output[`gcp_next_js_get_info_${bag.Name}`][0].Value).project_name);
    return [{
      name: `gcp_next_js_destroy_${bag.Name}`,
      url: TERRAFORM_EXECUTE_URL,
      input: [{
        Type: "terraform_execute",
        Name: `gcp_next_js_destroy_${bag.Name}`,
        Value: {
          display_name: `Terraform destroy - gcp_next_js.${bag.Name}`,
          mode: "destroy",
          dir: `${outputDir}/gcp_next_js_${bag.Name}`,
          variable_values: [{
            key: "gcp_project",
            value: gcpProjectName
          }]
        }
      }]
    }];
  };
  function destroyIterator3(bag) {
    if (!bag.Value) {
      return [];
    }
    return [
      BarbeState.deleteFromObject(CREATED_TF_STATE_KEY, bag.Name)
    ];
  }
  function destroy() {
    const gcpGetProjectInfoResults = importComponents(container, [{
      name: "gcp_next_js_get_project_info_destroy",
      url: GCP_PROJECT_SETUP_URL,
      input: iterateBlocks(container, GCP_NEXT_JS, destroyIteratorGetGcpProjectInfo).flat()
    }]);
    let step1 = iterateBlocks(container, GCP_NEXT_JS, destroyIterator2(gcpGetProjectInfoResults)).flat();
    const emptyApplies = makeEmptyExecuteDatabags(container, state);
    if (emptyApplies.length !== 0) {
      step1.push({
        name: "gcp_next_js_empty_apply_destroy",
        url: TERRAFORM_EXECUTE_URL,
        input: emptyApplies
      });
    }
    const emptyExecuteResults = importComponents(container, step1);
    importComponents(container, iterateBlocks(container, GCP_NEXT_JS, destroyIterator1).flat());
    exportDatabags(emptyExecutePostProcess(container, emptyExecuteResults, GCP_NEXT_JS, CREATED_TF_STATE_KEY));
    exportDatabags(iterateBlocks(container, GCP_NEXT_JS, destroyIterator3).flat());
  }
  switch (barbeLifecycleStep()) {
    case "pre_generate":
      preGenerate();
      break;
    case "generate":
      generate();
      break;
    case "apply":
      apply();
      break;
    case "destroy":
      destroy();
      break;
  }
})();
