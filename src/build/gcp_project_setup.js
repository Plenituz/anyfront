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

  // anyfront-lib/consts.ts
  var GCP_PROJECT_SETUP = "gcp_project_setup";
  var GCP_PROJECT_SETUP_GET_INFO = "gcp_project_setup_get_info";
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
  function addToStepOutput(original, ...outputs) {
    for (const output of outputs) {
      if (output.imports) {
        if (!original.imports) {
          original.imports = [];
        }
        original.imports.push(...output.imports);
      }
      if (output.databags) {
        if (!original.databags) {
          original.databags = [];
        }
        original.databags.push(...output.databags);
      }
      if (output.transforms) {
        if (!original.transforms) {
          original.transforms = [];
        }
        original.transforms.push(...output.transforms);
      }
    }
    return original;
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
  function prependTfStateFileName(tfBlock, prefix) {
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
    return visitTokens(tfBlock, visitor);
  }
  function autoDeleteMissingTfState(container2, bagType, onDelete) {
    return autoDeleteMissing2(container2, {
      bagType,
      createSavable: (bagType2, bagName) => {
        return prependTfStateFileName(container2["cr_[terraform]"][""][0].Value, `_${bagType2}_${bagName}`);
      },
      deleteMissing: (bagType2, bagName, savedValue) => {
        const imports = [{
          url: TERRAFORM_EXECUTE_URL,
          input: [{
            Type: "terraform_empty_execute",
            Name: `auto_delete_${bagType2}_${bagName}`,
            Value: {
              display_name: `Destroy missing ${bagType2}.${bagName}`,
              mode: "apply",
              template_json: JSON.stringify({
                // :)
                //turn the saved json objects back into a `terraform {}` block
                terraform: (() => {
                  let tfObj = {};
                  for (const [key, value] of Object.entries(savedValue)) {
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
          }]
        }];
        let output = { imports };
        if (onDelete) {
          addToStepOutput(output, onDelete(bagType2, bagName, savedValue));
        }
        return output;
      }
    });
  }
  function autoDeleteMissing2(container2, input) {
    const state2 = BarbeState.readState();
    const STATE_KEY_NAME = "auto_delete_missing_tracker";
    const applyPipe = pipeline([], { name: `auto_delete_${input.bagType}` });
    applyPipe.pushWithParams({ name: "delete_missing", lifecycleSteps: ["apply", "destroy"] }, () => {
      if (!container2["cr_[terraform]"]) {
        return;
      }
      const stateObj = state2[STATE_KEY_NAME];
      if (!stateObj) {
        return;
      }
      let output = {
        databags: [],
        imports: [],
        transforms: []
      };
      for (const [bagName, savedValue] of Object.entries(stateObj)) {
        if (!savedValue || bagName === "Meta") {
          continue;
        }
        if (container2?.[input.bagType]?.[bagName]) {
          continue;
        }
        const deleteMissing = input.deleteMissing(input.bagType, bagName, savedValue);
        output.databags.push(...deleteMissing.databags || []);
        output.imports.push(...deleteMissing.imports || []);
        output.transforms.push(...deleteMissing.transforms || []);
      }
      return output;
    });
    applyPipe.pushWithParams({ name: "cleanup_state", lifecycleSteps: ["post_apply"] }, () => {
      if (!container2["cr_[terraform]"]) {
        return;
      }
      const databags = Object.keys(container2?.[input.bagType] || {}).map((bagName) => BarbeState.putInObject(STATE_KEY_NAME, {
        [bagName]: input.createSavable(input.bagType, bagName)
      }));
      for (const [bagName, savedValue] of Object.entries(state2[STATE_KEY_NAME] || {})) {
        if (!savedValue || bagName === "Meta") {
          continue;
        }
        if (container2?.[input.bagType]?.[bagName]) {
          continue;
        }
        databags.push(BarbeState.deleteFromObject(STATE_KEY_NAME, bagName));
      }
      return { databags };
    });
    applyPipe.pushWithParams({ name: "cleanup_state_destroy", lifecycleSteps: ["post_destroy"] }, () => {
      const databags = [];
      for (const [bagName, savedValue] of Object.entries(state2[STATE_KEY_NAME] || {})) {
        if (bagName === "Meta") {
          continue;
        }
        databags.push(BarbeState.deleteFromObject(STATE_KEY_NAME, bagName));
      }
    });
    return applyPipe;
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
  var TERRAFORM_EXECUTE_GET_OUTPUT = "terraform_execute_get_output";
  var BARBE_SLS_VERSION2 = "v0.2.2";
  var TERRAFORM_EXECUTE_URL2 = `barbe-serverless/terraform_execute.js:${BARBE_SLS_VERSION2}`;
  var AWS_NETWORK_URL = `barbe-serverless/aws_network.js:${BARBE_SLS_VERSION2}`;

  // gcp_project_setup.ts
  var container = readDatabagContainer();
  var state = BarbeState.readState();
  var outputDir = barbeOutputDir();
  var CREATED_PROJECT_NAME_KEY = "created_project_name";
  var alreadyDeployedProjectOutput = Object.entries(state[CREATED_PROJECT_NAME_KEY] || {}).map(([bagName, projectName]) => ({
    Type: "gcp_project_setup_output",
    Name: bagName,
    Value: {
      project_name: projectName
    }
  }));
  exportDatabags(alreadyDeployedProjectOutput);
  function gcpProjectSetup(bag) {
    let pipe = pipeline([], { name: `gcp_project_setup.${bag.Name}` });
    if (!bag.Value) {
      return pipe;
    }
    const [block, _] = applyDefaults(container, bag.Value);
    const dir = `gcp_project_setup_${bag.Name}`;
    const bagPreconf = {
      dir,
      id: dir
    };
    const cloudResource = preConfCloudResourceFactory(block, "resource", void 0, bagPreconf);
    const cloudData = preConfCloudResourceFactory(block, "data", void 0, bagPreconf);
    const cloudOutput = preConfCloudResourceFactory(block, "output", void 0, bagPreconf);
    const cloudProvider = preConfCloudResourceFactory(block, "provider", void 0, bagPreconf);
    const cloudTerraform = preConfCloudResourceFactory(block, "terraform", void 0, bagPreconf);
    const projectSetupResource = () => {
      let localDatabags = [
        cloudProvider("", "google", {
          region: block.gcp_region || "us-central1"
        })
      ];
      if (!block.project_id) {
        localDatabags.push(
          cloudData("google_billing_account", "billing_account", {
            open: true,
            display_name: (() => {
              if (block.billing_account_id) {
                return void 0;
              }
              if (block.billing_account_name) {
                return block.billing_account_name;
              }
              return "My Billing Account";
            })(),
            billing_account: block.billing_account_id ? block.billing_account_id : void 0
          }),
          cloudResource("google_project", "project", {
            name: block.project_name,
            project_id: block.project_name,
            billing_account: asTraversal("data.google_billing_account.billing_account.id"),
            org_id: block.organization_id || block.organization_domain ? asTraversal("data.google_organization.google_org.org_id") : void 0
          }),
          cloudOutput("", "project_name", {
            value: asFuncCall("replace", [
              asTraversal("google_project.project.id"),
              "projects/",
              ""
            ])
          })
        );
        if (block.organization_id) {
          localDatabags.push(
            cloudData("google_organization", "google_org", {
              organization: block.organization_id
            })
          );
        } else if (block.organization_domain) {
          localDatabags.push(
            cloudData("google_organization", "google_org", {
              domain: block.organization_domain
            })
          );
        }
      } else {
        localDatabags.push(
          cloudData("google_project", "project", {
            project_id: block.project_id
          }),
          cloudOutput("", "project_name", {
            value: asFuncCall("replace", [
              asTraversal("data.google_project.project.project_id"),
              "projects/",
              ""
            ])
          })
        );
      }
      if (block.services_to_activate) {
        localDatabags.push(
          ...asValArrayConst(block.services_to_activate).map((serviceName) => cloudResource("google_project_service", `api_${serviceName.replace(/\./g, "_")}`, {
            project: block.project_id ? asTraversal("data.google_project.project.project_id") : asTraversal("google_project.project.project_id"),
            service: serviceName,
            disable_dependent_services: false,
            disable_on_destroy: false,
            timeouts: asBlock([{
              create: "30m",
              update: "40m"
            }])
          }))
        );
      }
      if (container["cr_[terraform]"]) {
        localDatabags.push(cloudTerraform("", "", prependTfStateFileName(container["cr_[terraform]"][""][0].Value, `_gcp_project_setup_${bag.Name}`)));
      }
      return localDatabags;
    };
    pipe.pushWithParams({ name: "resources", lifecycleSteps: ["generate"] }, () => {
      return {
        databags: projectSetupResource()
      };
    });
    pipe.pushWithParams({ name: "tf_apply", lifecycleSteps: ["apply"] }, () => {
      if (BarbeState.getObjectValue(state, CREATED_PROJECT_NAME_KEY, bag.Name)) {
        return;
      }
      const imports = [{
        url: TERRAFORM_EXECUTE_URL,
        input: [{
          Type: "terraform_execute",
          Name: `gcp_setup_${bag.Name}`,
          Value: {
            display_name: `Terraform apply - gcp_project_setup.${bag.Name}`,
            mode: "apply",
            dir: `${outputDir}/gcp_project_setup_${bag.Name}`
          }
        }]
      }];
      return { imports };
    });
    pipe.pushWithParams({ name: "save_state", lifecycleSteps: ["apply"] }, (input) => {
      let databags = [];
      const tfExecuteOutput = getHistoryItem(input.history, "tf_apply")?.databags;
      if (tfExecuteOutput?.terraform_execute_output?.[`gcp_setup_${bag.Name}`]) {
        const projectName = asStr(asVal(asVal(tfExecuteOutput.terraform_execute_output[`gcp_setup_${bag.Name}`][0].Value)[0]).value);
        databags.push({
          Type: "gcp_project_setup_output",
          Name: bag.Name,
          Value: {
            project_name: projectName
          }
        });
        if (container["cr_[terraform]"]) {
          databags.push(
            BarbeState.putInObject(CREATED_PROJECT_NAME_KEY, {
              [bag.Name]: projectName
            })
          );
        }
      }
      return { databags };
    });
    pipe.pushWithParams({ name: "tf_destroy", lifecycleSteps: ["destroy"] }, () => {
      const imports = [{
        name: "gcp_project_setup_destroy",
        url: TERRAFORM_EXECUTE_URL,
        input: [{
          Type: "terraform_execute",
          Name: `gcp_destroy_${bag.Name}`,
          Value: {
            display_name: `Terraform destroy - gcp_project_setup.${bag.Name}`,
            mode: "destroy",
            dir: `${outputDir}/gcp_project_setup_${bag.Name}`
          }
        }]
      }];
      return { imports };
    });
    pipe.pushWithParams({ name: "delete_state", lifecycleSteps: ["destroy"] }, () => {
      const databags = [BarbeState.deleteFromObject(CREATED_PROJECT_NAME_KEY, bag.Name)];
      return { databags };
    });
    return pipe;
  }
  function gcpProjectSetupGetInfo(bag) {
    let pipe = pipeline([], { name: `gcp_project_setup_get_info.${bag.Name}` });
    if (!bag.Value) {
      return pipe;
    }
    const [block, _] = applyDefaults(container, bag.Value);
    if (!block.name) {
      throw new Error(`gcp_project_setup_get_info block ${bag.Name} is missing a 'name' parameter`);
    }
    const name = asStr(block.name);
    pipe.pushWithParams({ name: "get_info" }, () => {
      const imports = [{
        name: `gcp_project_setup_get_info_${barbeLifecycleStep()}`,
        url: TERRAFORM_EXECUTE_URL,
        input: [{
          Type: TERRAFORM_EXECUTE_GET_OUTPUT,
          Name: `gcp_setup_get_output_${bag.Name}`,
          Value: {
            display_name: `Terraform output - gcp_project_setup.${name}`,
            dir: `${outputDir}/gcp_project_setup_${name}`
          }
        }]
      }];
      return { imports };
    });
    pipe.pushWithParams({ name: "export_info" }, (input) => {
      const tfOutput = getHistoryItem(input.history, "get_info")?.databags;
      if (!tfOutput?.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`] || !tfOutput?.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0] || !tfOutput?.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0].Value || !asVal(tfOutput?.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0].Value)[0]) {
        return;
      }
      const projectName = asStr(asVal(asVal(tfOutput?.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0].Value)[0]).value);
      let databags = [{
        Type: "gcp_project_setup_output",
        Name: bag.Name,
        Value: {
          project_name: projectName
        }
      }];
      return { databags };
    });
    return pipe;
  }
  var pipes = [
    ...iterateBlocks(container, GCP_PROJECT_SETUP, gcpProjectSetup),
    ...iterateBlocks(container, GCP_PROJECT_SETUP_GET_INFO, gcpProjectSetupGetInfo),
    autoDeleteMissingTfState(container, GCP_PROJECT_SETUP, (_, bagName) => ({ databags: [BarbeState.deleteFromObject(CREATED_PROJECT_NAME_KEY, bagName)] })),
    autoCreateStateStore(container, GCP_PROJECT_SETUP, "gcs")
  ];
  executePipelineGroup(container, pipes);
})();
