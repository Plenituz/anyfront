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
  function asFuncCall(funcName, args) {
    return {
      Type: "function_call",
      FunctionName: funcName,
      FunctionArgs: args.map(asSyntax)
    };
  }
  function asTemplate(arr) {
    return {
      Type: "template",
      Parts: arr.map(asSyntax)
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
      const id = `${component.name || ""}_${component.url}`;
      barbeImportComponent.push({
        Type: "barbe_import_component",
        Name: id,
        Value: importComponentInput
      });
    }
    if (barbeImportComponent.length === 0) {
      return {};
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
  function throwStatement(message) {
    throw new Error(message);
  }
  function readDatabagContainer() {
    return JSON.parse(os.file.readFile("__barbe_input.json"));
  }
  var IS_VERBOSE = os.getenv("BARBE_VERBOSE") === "1";
  function barbeLifecycleStep() {
    return os.getenv("BARBE_LIFECYCLE_STEP");
  }
  var allGenerateSteps = ["pre_generate", "generate", "post_generate"];
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
    getObjectValue: (state, key, valueKey) => state && state[key] && state[key][valueKey],
    deleteFromObject: (key, valueKey) => ({
      Type: "barbe_state(delete_from_object)",
      Name: key,
      Value: valueKey
    })
  };

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
  var __awsCredsCached = void 0;
  function getAwsCreds() {
    if (__awsCredsCached) {
      return __awsCredsCached;
    }
    const transformed = applyTransformers([{
      Name: "state_store_credentials",
      Type: "aws_credentials_request",
      Value: {}
    }]);
    const creds = transformed.aws_credentials?.state_store_credentials[0]?.Value;
    if (!creds) {
      return void 0;
    }
    const credsObj = asVal(creds);
    __awsCredsCached = {
      access_key_id: asStr(credsObj.access_key_id),
      secret_access_key: asStr(credsObj.secret_access_key),
      session_token: asStr(credsObj.session_token)
    };
    return __awsCredsCached;
  }

  // anyfront-lib/consts.ts
  var AWS_S3_SYNC_FILES = "aws_s3_sync_files";
  var AWS_SVELTEKIT = "aws_sveltekit";
  var BARBE_SLS_VERSION = "v0.2.2";
  var ANYFRONT_VERSION = "v0.2.2";
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
              console.log(`skipping step ${i}${stepMeta.name ? ` (${stepMeta.name})` : ""} of pipeline ${pipeline2.name} because lifecycle step is ${lifecycleStep} and step is only for ${stepMeta.lifecycleSteps.join(", ")}`);
            }
            continue;
          }
        }
        if (IS_VERBOSE) {
          console.log(`running step ${i}${stepMeta.name ? ` (${stepMeta.name})` : ""} of pipeline ${pipeline2.name}`);
          console.log(`step ${i} input:`, JSON.stringify(previousStepResult));
        }
        let stepRequests = stepMeta.f({
          previousStepResult,
          history
        });
        if (IS_VERBOSE) {
          console.log(`step ${i} requests:`, JSON.stringify(stepRequests));
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
      }
      if (IS_VERBOSE) {
        console.log(`step ${i} output:`, JSON.stringify(stepResults));
      }
      history.push({
        databags: stepResults,
        stepNames
      });
      previousStepResult = stepResults;
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
      }
    };
  }

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
    if (!container2["cr_[terraform]"]) {
      return;
    }
    return visitTokens(container2["cr_[terraform]"][""][0].Value, visitor);
  }
  function guessAwsDnsZoneBasedOnDomainName(domainName) {
    if (!domainName) {
      return null;
    }
    if (!isSimpleTemplate(domainName)) {
      return null;
    }
    const parts = asStr(domainName).split(".");
    if (parts.length === 2) {
      return `${parts[0]}.${parts[1]}`;
    }
    if (parts.length < 3) {
      return null;
    }
    return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  }
  function isDomainNameApex(domainName, zoneName) {
    if (!domainName) {
      return null;
    }
    if (!isSimpleTemplate(domainName)) {
      return null;
    }
    const domainNameStr = asStr(domainName);
    if (zoneName && isSimpleTemplate(zoneName) && domainNameStr === asStr(zoneName)) {
      return true;
    }
    const parts = domainNameStr.split(".");
    if (parts.length === 2) {
      return true;
    }
    return false;
  }
  function autoDeleteMissing(container2, blockName) {
    const state = BarbeState.readState();
    const STATE_KEY_NAME = "created_tfstate";
    const emptyExecuteBagNamePrefix = `${STATE_KEY_NAME}_destroy_missing_`;
    const makeEmptyExecuteDatabags = (container3, state2) => {
      if (!container3["cr_[terraform]"]) {
        return [];
      }
      return emptyExecuteTemplate(container3, state2);
    };
    const emptyExecuteTemplate = (container3, state2) => {
      const stateObj = state2[STATE_KEY_NAME];
      if (!stateObj) {
        return [];
      }
      let output = [];
      for (const [bagName, tfBlock] of Object.entries(stateObj)) {
        if (!tfBlock || bagName === "Meta") {
          continue;
        }
        if (container3?.[blockName]?.[bagName]) {
          continue;
        }
        output.push({
          Type: "terraform_empty_execute",
          Name: `${emptyExecuteBagNamePrefix}${bagName}`,
          Value: {
            mode: "apply",
            template_json: JSON.stringify({
              // :)
              terraform: (() => {
                let tfObj = {};
                for (const [key, value] of Object.entries(tfBlock)) {
                  if (!value || key === "Meta") {
                    continue;
                  }
                  tfObj[key] = {
                    [value[0].Meta?.Labels[0]]: (() => {
                      let obj = {};
                      for (const [innerKey, innerValue] of Object.entries(value[0])) {
                        if (!innerValue || innerKey === "Meta") {
                          continue;
                        }
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
    };
    const emptyExecutePostProcess = (container3, results) => {
      if (!results.terraform_empty_execute_output) {
        return [];
      }
      let output = [];
      for (const prefixedName of Object.keys(results.terraform_empty_execute_output)) {
        if (!prefixedName.startsWith(emptyExecuteBagNamePrefix)) {
          continue;
        }
        const nonPrefixedName = prefixedName.replace(emptyExecuteBagNamePrefix, "");
        if (container3?.[blockName]?.[nonPrefixedName]) {
          continue;
        }
        output.push(BarbeState.deleteFromObject(STATE_KEY_NAME, nonPrefixedName));
      }
      return output;
    };
    const applyPipe = pipeline([], { name: `auto_delete_${blockName}_apply` });
    applyPipe.pushWithParams({ lifecycleSteps: ["apply"] }, () => {
      let databags = [];
      if (container2["cr_[terraform]"]) {
        databags.push(
          ...Object.keys(container2?.[blockName] || {}).map((bagName) => BarbeState.putInObject(STATE_KEY_NAME, {
            [bagName]: prependTfStateFileName(container2, `_${blockName}_${bagName}`)
          }))
        );
      }
      let imports = [{
        url: TERRAFORM_EXECUTE_URL,
        input: makeEmptyExecuteDatabags(container2, state)
      }];
      return { databags, imports };
    });
    applyPipe.pushWithParams({ lifecycleSteps: ["apply"] }, (input) => {
      let databags = emptyExecutePostProcess(container2, input.previousStepResult);
      return { databags };
    });
    const destroyPipe = pipeline([], { name: `auto_delete_${blockName}_destroy` });
    destroyPipe.pushWithParams({ lifecycleSteps: ["destroy"] }, () => {
      let databags = Object.keys(container2?.[blockName] || {}).map((bagName) => BarbeState.deleteFromObject(STATE_KEY_NAME, bagName));
      let imports = [{
        url: TERRAFORM_EXECUTE_URL,
        input: makeEmptyExecuteDatabags(container2, state)
      }];
      return { imports, databags };
    });
    destroyPipe.pushWithParams({ lifecycleSteps: ["destroy"] }, (input) => {
      let databags = emptyExecutePostProcess(container2, input.previousStepResult);
      return { databags };
    });
    return [applyPipe, destroyPipe];
  }
  function autoCreateStateStore(container2, blockName, kind) {
    if (container2.state_store) {
      return pipeline([]);
    }
    return pipeline([
      step(() => {
        const databags = iterateBlocks(container2, blockName, (bag) => {
          const [block, namePrefix] = applyDefaults(container2, bag.Value);
          if (!isSimpleTemplate(namePrefix)) {
            return [];
          }
          let value = {
            name_prefix: [`${bag.Name}-`]
          };
          switch (kind) {
            case "s3":
              value["s3"] = asBlock([{}]);
              break;
            case "gcs":
              const dotGcpProject = compileBlockParam(block, "google_cloud_project");
              value["gcs"] = asBlock([{
                project_id: block.google_cloud_project_id || block.project_id || dotGcpProject.project_id
              }]);
              break;
            default:
              throwStatement(`Unknown state_store kind '${kind}'`);
          }
          return [{
            Type: "state_store",
            Name: "",
            Value: value
          }];
        }).flat();
        return { databags };
      }, { lifecycleSteps: ["pre_generate"] })
    ]);
  }

  // ../../barbe-serverless/src/barbe-sls-lib/consts.ts
  var AWS_FUNCTION = "aws_function";
  var AWS_IAM_LAMBDA_ROLE = "aws_iam_lambda_role";
  var BARBE_SLS_VERSION2 = "v0.2.2";
  var TERRAFORM_EXECUTE_URL2 = `barbe-serverless/terraform_execute.js:${BARBE_SLS_VERSION2}`;
  var AWS_NETWORK_URL = `barbe-serverless/aws_network.js:${BARBE_SLS_VERSION2}`;

  // aws_sveltekit/svelte.config.template.js
  var svelte_config_template_default = `import customer_svelteConfig from "./customer_svelte.config.js";
import adapter from '@yarbsemaj/adapter-lambda'

if(!customer_svelteConfig.kit) customer_svelteConfig.kit = {}
customer_svelteConfig.kit.adapter = adapter()
if(!customer_svelteConfig.kit.csrf) customer_svelteConfig.kit.csrf = {}
customer_svelteConfig.kit.csrf.checkOrigin = false

export default customer_svelteConfig`;

  // ../../barbe-serverless/src/barbe-sls-lib/helpers.ts
  function awsDomainBlockResources({ dotDomain, domainValue, resourcePrefix, apexHostedZoneId, cloudData, cloudResource }) {
    const nameToken = dotDomain.name || dotDomain.names;
    if (!nameToken) {
      return null;
    }
    let domainNames = [];
    if (nameToken.Type === "array_const") {
      domainNames = nameToken.ArrayConst || [];
    } else {
      domainNames = [nameToken];
    }
    let certArn;
    let certRef;
    const acmCertificateResources = (domains) => {
      return [
        cloudResource("aws_acm_certificate", `${resourcePrefix}_cert`, {
          domain_name: domains[0],
          subject_alternative_names: domains.slice(1),
          validation_method: "DNS"
        }),
        cloudResource("aws_route53_record", `${resourcePrefix}_validation_record`, {
          for_each: {
            Type: "for",
            ForKeyVar: "dvo",
            ForCollExpr: asTraversal(`aws_acm_certificate.${resourcePrefix}_cert.domain_validation_options`),
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
          zone_id: asTraversal(`data.aws_route53_zone.${resourcePrefix}_zone.zone_id`)
        }),
        cloudResource("aws_acm_certificate_validation", `${resourcePrefix}_validation`, {
          certificate_arn: asTraversal(`aws_acm_certificate.${resourcePrefix}_cert.arn`),
          validation_record_fqdns: {
            Type: "for",
            ForValVar: "record",
            ForCollExpr: asTraversal(`aws_route53_record.${resourcePrefix}_validation_record`),
            ForValExpr: asTraversal("record.fqdn")
          }
        })
      ];
    };
    let zoneName = dotDomain.zone;
    if (!zoneName) {
      for (const domain of domainNames) {
        const guessedZone = guessAwsDnsZoneBasedOnDomainName(domain);
        if (guessedZone) {
          zoneName = asSyntax(guessedZone);
          break;
        }
      }
    }
    if (!zoneName) {
      throwStatement("no 'zone' given and could not guess based on domain name");
    }
    let databags = [];
    databags.push(
      cloudData("aws_route53_zone", `${resourcePrefix}_zone`, {
        name: zoneName
      })
    );
    const forceAlias = asVal(dotDomain.use_alias || asSyntax(false));
    for (let i = 0; i < domainNames.length; i++) {
      const domain = domainNames[i];
      const isApex = isDomainNameApex(domain, zoneName);
      if (forceAlias || isApex) {
        databags.push(
          cloudResource("aws_route53_record", `${resourcePrefix}_${i}_alias_record`, {
            zone_id: asTraversal(`data.aws_route53_zone.${resourcePrefix}_zone.zone_id`),
            name: domain,
            type: "A",
            alias: asBlock([{
              name: domainValue,
              zone_id: apexHostedZoneId,
              evaluate_target_health: false
            }])
          }),
          //when a cloudfront distribution has ipv6 enabled we need 2 alias records, one A for ipv4 and one AAAA for ipv6
          cloudResource("aws_route53_record", `${resourcePrefix}_${i}_alias_record_ipv6`, {
            zone_id: asTraversal(`data.aws_route53_zone.${resourcePrefix}_zone.zone_id`),
            name: domain,
            type: "AAAA",
            alias: asBlock([{
              name: domainValue,
              zone_id: apexHostedZoneId,
              evaluate_target_health: false
            }])
          })
        );
      } else {
        databags.push(
          cloudResource("aws_route53_record", `${resourcePrefix}_${i}_domain_record`, {
            zone_id: asTraversal(`data.aws_route53_zone.${resourcePrefix}_zone.zone_id`),
            name: domain,
            type: "CNAME",
            ttl: 300,
            records: [domainValue]
          })
        );
      }
    }
    if (!dotDomain.certificate_arn) {
      if (dotDomain.existing_certificate_domain) {
        certArn = asTraversal(`data.aws_acm_certificate.${resourcePrefix}_imported_certificate.arn`);
        databags.push(
          cloudData("aws_acm_certificate", `${resourcePrefix}_imported_certificate`, {
            domain: dotDomain.existing_certificate_domain,
            types: ["AMAZON_ISSUED"],
            most_recent: true
          })
        );
      } else if (dotDomain.certificate_domain_to_create) {
        certArn = asTraversal(`aws_acm_certificate.${resourcePrefix}_cert.arn`);
        certRef = asTraversal(`aws_acm_certificate.${resourcePrefix}_cert`);
        let certsToCreate = [];
        if (dotDomain.certificate_domain_to_create.Type === "array_const") {
          certsToCreate = dotDomain.certificate_domain_to_create.ArrayConst || [];
        } else {
          certsToCreate = [dotDomain.certificate_domain_to_create];
        }
        databags.push(...acmCertificateResources(certsToCreate));
      } else {
        certArn = asTraversal(`aws_acm_certificate.${resourcePrefix}_cert.arn`);
        certRef = asTraversal(`aws_acm_certificate.${resourcePrefix}_cert`);
        databags.push(...acmCertificateResources(domainNames));
      }
    } else {
      certArn = dotDomain.certificate_arn;
    }
    return { certArn, certRef, databags, domainNames };
  }

  // aws_sveltekit/aws_sveltekit.ts
  var container = readDatabagContainer();
  var outputDir = barbeOutputDir();
  function awsSveltekit(bag) {
    if (!bag.Value) {
      return [];
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value);
    const pipe = pipeline([], { name: `aws_sveltekit.${bag.Name}` });
    const dotBuild = compileBlockParam(block, "build");
    const dotDomain = compileBlockParam(block, "domain");
    const nodeJsVersion = asStr(dotBuild.nodejs_version || block.nodejs_version || "16");
    const dir = `aws_sveltekit_${bag.Name}`;
    const bagPreconf = {
      dir,
      id: dir
    };
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
    const sveltekitBuild = () => {
      const nodeJsVersionTag = asStr(dotBuild.nodejs_version_tag || block.nodejs_version_tag || "-slim");
      const appDir = asStr(dotBuild.app_dir || block.app_dir || ".");
      const installCmd = asStr(dotBuild.install_cmd || "npm install");
      const buildCmd = asStr(dotBuild.build_cmd || "npm run build");
      return {
        Type: "buildkit_run_in_container",
        Name: `aws_sveltekit_${bag.Name}`,
        Value: {
          display_name: `SvelteKit build - ${bag.Name}`,
          no_cache: true,
          excludes: [
            "node_modules",
            "**/node_modules",
            ".svelte-kit",
            outputDir
          ],
          input_files: {
            "svelte.config.js": svelte_config_template_default
          },
          dockerfile: `
                    FROM node:${nodeJsVersion}${nodeJsVersionTag}

                    RUN apt-get update
                    RUN apt-get install -y zip

                    COPY --from=src ${appDir} /src
                    WORKDIR /src

                    RUN ${installCmd}
                    RUN npm install -D @yarbsemaj/adapter-lambda
                    RUN mv svelte.config.js customer_svelte.config.js
                    COPY --from=src svelte.config.js svelte.config.js
                    RUN ${buildCmd}

                    RUN mkdir -p __barbe_next/static
                    RUN cd build/server && zip -ryq1 /src/__barbe_next/server.zip .
                    # static.js is already baked into router.js
                    RUN rm build/edge/static.js
                    RUN cd build/edge && zip -ryq1 /src/__barbe_next/edge.zip .

                    # these might fail if the directories are empty, hence the "|| true"
                    RUN mv build/assets/* __barbe_next/static/. || true
                    RUN mv build/prerendered/* __barbe_next/static/. || true
                `,
          exported_files: {
            "__barbe_next/edge.zip": `${dir}/edge.zip`,
            "__barbe_next/static": `${dir}/static`,
            "__barbe_next/server.zip": `${dir}/server.zip`
          }
        }
      };
    };
    const makeResources = () => {
      const domainBlock = awsDomainBlockResources({
        dotDomain,
        domainValue: asTraversal("aws_cloudfront_distribution.distribution.domain_name"),
        resourcePrefix: "",
        apexHostedZoneId: asTraversal("aws_cloudfront_distribution.distribution.hosted_zone_id"),
        cloudData,
        cloudResource
      });
      let databags = [
        cloudProvider("", "aws", {
          region: block.region || os.getenv("AWS_REGION") || "us-east-1"
        }),
        cloudResource("aws_s3_bucket", "assets", {
          bucket: appendToTemplate(namePrefix, [`${bag.Name}-assets`]),
          force_destroy: true
        }),
        cloudOutput("", "assets_s3_bucket", {
          value: asTraversal("aws_s3_bucket.assets.id")
        }),
        cloudResource("aws_s3_bucket_acl", "assets_acl", {
          bucket: asTraversal("aws_s3_bucket.assets.id"),
          acl: "private"
        }),
        cloudResource("aws_s3_bucket_cors_configuration", "assets_cors", {
          bucket: asTraversal("aws_s3_bucket.assets.id"),
          cors_rule: asBlock([{
            allowed_headers: ["*"],
            allowed_methods: ["GET"],
            allowed_origins: ["*"],
            max_age_seconds: 3e3
          }])
        }),
        // cloudResource('aws_cloudfront_origin_access_control', 'assets_access', {
        //     name: appendToTemplate(namePrefix, [`${bag.Name}-oac`]),
        //     description: asTemplate([
        //         "origin access control for ",
        //         appendToTemplate(namePrefix, [`${bag.Name}-assets`])
        //     ]),
        //     origin_access_control_origin_type: 's3',
        //     signing_behavior: 'always',
        //     signing_protocol: 'sigv4'
        // }),
        //bucket has to be public, until this changes: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-event-structure.html
        //"You can't use an OAI when you change the request from a custom origin to an Amazon S3 origin."
        //and "This field does not support origin access control (OAC)."
        cloudData("aws_iam_policy_document", "assets_policy", {
          statement: asBlock([
            {
              actions: ["s3:GetObject"],
              resources: [
                asTemplate([
                  asTraversal("aws_s3_bucket.assets.arn"),
                  "/*"
                ])
              ],
              principals: asBlock([{
                type: "*",
                identifiers: ["*"]
              }])
            }
          ])
        }),
        cloudResource("aws_s3_bucket_policy", "assets_policy", {
          bucket: asTraversal("aws_s3_bucket.assets.id"),
          policy: asTraversal("data.aws_iam_policy_document.assets_policy.json")
        }),
        cloudOutput("", "cf_distrib", {
          value: asTraversal("aws_cloudfront_distribution.distribution.id")
        }),
        cloudResource("aws_cloudfront_cache_policy", "default_cache_policy", {
          name: appendToTemplate(namePrefix, [`${bag.Name}-default-cache-policy`]),
          default_ttl: 0,
          max_ttl: 31536e3,
          // that's 365 days
          min_ttl: 0,
          parameters_in_cache_key_and_forwarded_to_origin: asBlock([{
            enable_accept_encoding_brotli: true,
            enable_accept_encoding_gzip: true,
            cookies_config: asBlock([{
              cookie_behavior: "all"
            }]),
            headers_config: asBlock([{
              header_behavior: "none"
            }]),
            query_strings_config: asBlock([{
              query_string_behavior: "all"
            }])
          }])
        }),
        cloudData("aws_cloudfront_origin_request_policy", "s3_cors", {
          name: "Managed-CORS-S3Origin"
        }),
        cloudData("aws_cloudfront_cache_policy", "caching_optimized", {
          name: "Managed-CachingOptimized"
        }),
        cloudResource("aws_cloudfront_distribution", "distribution", {
          enabled: true,
          is_ipv6_enabled: true,
          price_class: "PriceClass_All",
          restrictions: asBlock([{
            geo_restriction: asBlock([{
              restriction_type: "none"
            }])
          }]),
          origin: asBlock([
            //this isnt needed until OAC are supported
            //also we cant use an origin group because they dont supports POST/PUT/DELETE
            // {
            //     domain_name: asTraversal("aws_s3_bucket.assets.bucket_regional_domain_name"),
            //     origin_id: "assets",
            //     origin_access_control_id: asTraversal("aws_cloudfront_origin_access_control.assets_access.id"),
            // },
            {
              domain_name: asFuncCall(
                "replace",
                [
                  asFuncCall("replace", [
                    asTraversal("aws_function.origin-server.function_url"),
                    "https://",
                    ""
                  ]),
                  "/",
                  ""
                ]
              ),
              origin_id: "server",
              custom_origin_config: asBlock([{
                http_port: 80,
                https_port: 443,
                origin_protocol_policy: "https-only",
                origin_ssl_protocols: ["SSLv3"]
              }]),
              custom_header: asBlock([
                {
                  name: "s3-host",
                  value: asTraversal("aws_s3_bucket.assets.bucket_regional_domain_name")
                }
              ])
            }
          ]),
          default_cache_behavior: asBlock([{
            allowed_methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS", "DELETE"],
            cached_methods: ["GET", "HEAD", "OPTIONS"],
            viewer_protocol_policy: "redirect-to-https",
            target_origin_id: "server",
            compress: true,
            cache_policy_id: asTraversal("data.aws_cloudfront_cache_policy.caching_optimized.id"),
            origin_request_policy_id: asTraversal("data.aws_cloudfront_origin_request_policy.s3_cors.id"),
            lambda_function_association: asBlock([{
              event_type: "origin-request",
              lambda_arn: asTraversal("aws_function.origin-request.qualified_arn"),
              include_body: false
            }])
          }]),
          aliases: domainBlock?.domainNames || [],
          viewer_certificate: asBlock([
            (() => {
              const minimumProtocolVersion = "TLSv1.2_2021";
              if (!domainBlock) {
                return {
                  cloudfront_default_certificate: true
                };
              }
              return {
                acm_certificate_arn: domainBlock.certArn,
                ssl_support_method: "sni-only",
                minimum_protocol_version: minimumProtocolVersion
              };
            })()
          ])
        })
      ];
      if (domainBlock) {
        databags.push(...domainBlock.databags);
      }
      return databags;
    };
    pipe.pushWithParams({ name: "resources", lifecycleSteps: allGenerateSteps }, () => {
      let databags = makeResources();
      if (container["cr_[terraform]"]) {
        databags.push(cloudTerraform("", "", prependTfStateFileName(container, `_${AWS_SVELTEKIT}_${bag.Name}`)));
      }
      let transforms = [];
      const imports = [
        {
          name: `aws_sveltekit_aws_iam_lambda_role_${bag.Name}`,
          url: AWS_IAM_URL,
          input: [{
            Type: AWS_IAM_LAMBDA_ROLE,
            Name: "default",
            Value: {
              name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])],
              cloudresource_dir: dir,
              cloudresource_id: dir,
              assumable_by: ["edgelambda.amazonaws.com", "lambda.amazonaws.com"]
            }
          }]
        },
        {
          name: `aws_sveltekit_aws_lambda_${bag.Name}`,
          url: AWS_LAMBDA_URL,
          input: [
            {
              Type: AWS_FUNCTION,
              Name: "origin-request",
              Value: {
                cloudresource_dir: dir,
                cloudresource_id: dir,
                //these paths are scoped to the directory in which the tf template is executed, hence no ${dir} prefix
                package: [{
                  packaged_file: "edge.zip"
                }],
                handler: "router.handler",
                runtime: `nodejs${nodeJsVersion}.x`,
                timeout: 3,
                name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])]
              }
            },
            {
              Type: "aws_function",
              Name: "origin-server",
              Value: {
                cloudresource_dir: dir,
                cloudresource_id: dir,
                package: [{
                  packaged_file: "server.zip"
                }],
                handler: "serverless.handler",
                runtime: `nodejs${nodeJsVersion}.x`,
                timeout: 10,
                memory_size: 1024,
                function_url_enabled: true,
                name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])]
              }
            }
          ]
        }
      ];
      if (!(dotBuild.disabled && asVal(dotBuild.disabled))) {
        transforms.push(sveltekitBuild());
      }
      return { databags, imports, transforms };
    });
    pipe.pushWithParams({ name: "export", lifecycleSteps: allGenerateSteps }, (input) => exportDatabags(input.previousStepResult));
    pipe.pushWithParams({ name: "destroy_tf", lifecycleSteps: ["destroy"] }, () => {
      let imports = [{
        url: TERRAFORM_EXECUTE_URL,
        input: [{
          Type: "terraform_execute",
          Name: `aws_sveltekit_${bag.Name}_destroy`,
          Value: {
            display_name: `Terraform destroy - aws_sveltekit.${bag.Name}`,
            mode: "destroy",
            dir: `${outputDir}/${dir}`
          }
        }]
      }];
      return { imports };
    });
    pipe.pushWithParams({ name: "apply_tf", lifecycleSteps: ["apply"] }, () => {
      let imports = [{
        url: TERRAFORM_EXECUTE_URL,
        input: [{
          Type: "terraform_execute",
          Name: `aws_sveltekit_${bag.Name}_apply`,
          Value: {
            display_name: `Terraform apply - aws_sveltekit.${bag.Name}`,
            mode: "apply",
            dir: `${outputDir}/${dir}`
          }
        }]
      }];
      return { imports };
    });
    pipe.pushWithParams({ name: "upload", lifecycleSteps: ["apply"] }, (input) => {
      if (!input.previousStepResult.terraform_execute_output?.[`aws_sveltekit_${bag.Name}_apply`]) {
        return;
      }
      const outputs = asValArrayConst(input.previousStepResult.terraform_execute_output[`aws_sveltekit_${bag.Name}_apply`][0].Value);
      const bucketName = asStr(outputs.find((pair) => asStr(pair.key) === "assets_s3_bucket").value);
      let imports = [{
        name: `aws_sveltekit_${bag.Name}`,
        url: AWS_S3_SYNC_URL,
        input: [{
          Type: AWS_S3_SYNC_FILES,
          Name: `aws_sveltekit_${bag.Name}`,
          Value: {
            display_name: `Uploading SvelteKit files - ${bag.Name}`,
            bucket_name: bucketName,
            delete: true,
            dir: `${outputDir}/${dir}/static`,
            blob: "."
            //TODO cache control headers
          }
        }]
      }];
      return { imports };
    });
    pipe.pushWithParams({ name: "invalidate", lifecycleSteps: ["apply"] }, (input) => {
      const prev = getHistoryItem(input.history, "apply_tf")?.databags;
      if (!prev?.terraform_execute_output?.[`aws_sveltekit_${bag.Name}_apply`]) {
        return;
      }
      const awsCreds = getAwsCreds();
      if (!awsCreds) {
        throw new Error("couldn't find AWS credentials");
      }
      const outputs = asValArrayConst(prev.terraform_execute_output[`aws_sveltekit_${bag.Name}_apply`][0].Value);
      const cfDistribId = asStr(outputs.find((pair) => asStr(pair.key) === "cf_distrib").value);
      let transforms = [{
        Type: "buildkit_run_in_container",
        Name: `aws_sveltekit_invalidate_${bag.Name}`,
        Value: {
          no_cache: true,
          display_name: `Invalidate CloudFront distribution - aws_sveltekit.${bag.Name}`,
          dockerfile: `
                    FROM amazon/aws-cli:latest

                    ENV AWS_ACCESS_KEY_ID="${awsCreds.access_key_id}"
                    ENV AWS_SECRET_ACCESS_KEY="${awsCreds.secret_access_key}"
                    ENV AWS_SESSION_TOKEN="${awsCreds.session_token}"
                    ENV AWS_REGION="${asStr(block.region || os.getenv("AWS_REGION") || "us-east-1")}"
                    ENV AWS_PAGER=""

                    RUN aws cloudfront create-invalidation --distribution-id ${cfDistribId} --paths "/*"`
        }
      }];
      return { transforms };
    });
    return [pipe];
  }
  executePipelineGroup(container, [
    ...iterateBlocks(container, AWS_SVELTEKIT, awsSveltekit).flat(),
    ...autoDeleteMissing(container, AWS_SVELTEKIT),
    autoCreateStateStore(container, AWS_SVELTEKIT, "s3")
  ]);
})();
