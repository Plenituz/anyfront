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

  // anyfront-lib/consts.ts
  var AWS_S3_SYNC_FILES = "aws_s3_sync_files";
  var AWS_NEXT_JS = "aws_next_js";
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

  // ../../barbe-serverless/src/barbe-sls-lib/consts.ts
  var AWS_FUNCTION = "aws_function";
  var AWS_IAM_LAMBDA_ROLE = "aws_iam_lambda_role";
  var BARBE_SLS_VERSION2 = "v0.2.1";
  var TERRAFORM_EXECUTE_URL2 = `https://hub.barbe.app/barbe-serverless/terraform_execute/${BARBE_SLS_VERSION2}/.js`;

  // aws_next_js.ts
  var container = readDatabagContainer();
  var outputDir = barbeOutputDir();
  var state = BarbeState.readState();
  var CREATED_TF_STATE_KEY = "created_tfstate";
  function makeEmptyExecuteDatabags(container2, state2) {
    if (!container2["cr_[terraform]"]) {
      return [];
    }
    return emptyExecuteTemplate(container2, state2, AWS_NEXT_JS, CREATED_TF_STATE_KEY);
  }
  function preGenerate() {
    if (container.state_store) {
      return;
    }
    const databags = iterateBlocks(container, AWS_NEXT_JS, (bag) => {
      const [block, namePrefix] = applyDefaults(container, bag.Value);
      return {
        Type: "state_store",
        Name: "",
        Value: {
          name_prefix: [`${bag.Name}-`],
          s3: asBlock([{}])
        }
      };
    });
    exportDatabags(databags);
  }
  function generateIterator1(bag) {
    if (!bag.Value) {
      return [];
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value);
    const dir = `aws_next_js_${bag.Name}`;
    const bagPreconf = {
      dir,
      id: dir
    };
    const dotDomain = compileBlockParam(block, "domain");
    const dotBuild = compileBlockParam(block, "build");
    const domainNames = dotDomain.name ? [dotDomain.name] : [];
    const nodeJsVersion = asStr(dotBuild.nodejs_version || block.nodejs_version || "16");
    const cloudResource = preConfCloudResourceFactory(block, "resource", void 0, bagPreconf);
    const cloudData = preConfCloudResourceFactory(block, "data", void 0, bagPreconf);
    const cloudOutput = preConfCloudResourceFactory(block, "output", void 0, bagPreconf);
    const cloudProvider = preConfCloudResourceFactory(block, "provider", void 0, bagPreconf);
    const cloudTerraform = preConfCloudResourceFactory(block, "terraform", void 0, bagPreconf);
    const nextJsBuild = () => {
      const nodeJsVersionTag = asStr(dotBuild.nodejs_version_tag || block.nodejs_version_tag || "-slim");
      const appDir = asStr(dotBuild.app_dir || block.app_dir || ".");
      const installCmd = asStr(dotBuild.install_cmd || "npm install");
      const buildCmd = asStr(dotBuild.build_cmd || "npm run build");
      return {
        Type: "buildkit_run_in_container",
        Name: `aws_next_js_${bag.Name}`,
        Value: {
          display_name: `Next.js build - ${bag.Name}`,
          excludes: [
            "node_modules",
            "**/node_modules",
            outputDir
          ],
          dockerfile: `
                    FROM node:${nodeJsVersion}${nodeJsVersionTag}

                    RUN apt-get update
                    RUN apt-get install -y zip git
                    RUN git clone https://github.com/jetbridge/cdk-nextjs.git
                    RUN cd /cdk-nextjs/assets/lambda && npm init -y && npm i serverless-http next

                    RUN mkdir /esbuild
                    RUN cd /esbuild && npm install --save-exact esbuild
                    RUN /esbuild/node_modules/.bin/esbuild --version

                    COPY --from=src ${appDir} /src
                    WORKDIR /src

                    RUN ${installCmd}
                    RUN ${buildCmd}

                    RUN /esbuild/node_modules/.bin/esbuild --bundle --minify --sourcemap --target=node16 --platform=node --external:next --external:serverless-http --external:aws-sdk --format=cjs --outfile=.next/standalone/nextapp/server.cjs /cdk-nextjs/assets/lambda/NextJsHandler.ts
                    RUN mv .next/standalone/.next/ .next/standalone/nextapp/
                    RUN mv /cdk-nextjs/assets/lambda/node_modules .next/standalone/nextapp/
                    # RUN ln -s /cdk-nextjs/assets/lambda/node_modules .next/standalone/nextapp/node_modules

                    RUN mkdir -p __barbe_next/standalone
                    RUN mkdir -p __barbe_next/static/_next
                    RUN mkdir -p __barbe_next/edge

                    RUN cd .next/standalone && zip -ryq1 /src/__barbe_next/standalone.zip nextapp package.json

                    RUN cp -r .next/static/ __barbe_next/static/_next/static/
                    RUN cp -r public/* __barbe_next/static/
                    # RUN cd __barbe_next/static/ && zip -ryq1 /src/__barbe_next/assets.zip ./*

                    RUN /esbuild/node_modules/.bin/esbuild --bundle --minify --sourcemap --target=node16 --platform=node --external:aws-sdk --external:url --outfile=__barbe_next/edge/origin_request.js /cdk-nextjs/assets/lambda@edge/LambdaOriginRequest
                    RUN cd __barbe_next/edge && zip -ryq1 /src/__barbe_next/edge.zip ./*
                `,
          exported_files: {
            "__barbe_next/edge.zip": `${dir}/edge.zip`,
            "__barbe_next/static": `${dir}/static`,
            "__barbe_next/standalone.zip": `${dir}/server.zip`
          }
        }
      };
    };
    const serverBehavior = (pattern) => ({
      path_pattern: pattern,
      allowed_methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS", "DELETE"],
      cached_methods: ["GET", "HEAD"],
      viewer_protocol_policy: "redirect-to-https",
      target_origin_id: "server",
      compress: true,
      cache_policy_id: asTraversal("data.aws_cloudfront_cache_policy.no_cache.id"),
      origin_request_policy_id: asTraversal("data.aws_cloudfront_origin_request_policy.all_viewer.id"),
      lambda_function_association: asBlock([{
        event_type: "origin-request",
        lambda_arn: asTraversal("aws_function.origin-request.qualified_arn"),
        include_body: false
      }])
    });
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
      cloudResource("aws_cloudfront_origin_access_identity", "assets_access_id", {
        comment: asTemplate([
          "origin access identity for ",
          appendToTemplate(namePrefix, [`${bag.Name}-assets`])
        ])
      }),
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
              type: "AWS",
              identifiers: [asTraversal("aws_cloudfront_origin_access_identity.assets_access_id.iam_arn")]
            }])
          },
          {
            actions: ["s3:ListBucket"],
            resources: [asTraversal("aws_s3_bucket.assets.arn")],
            principals: asBlock([{
              type: "AWS",
              identifiers: [asTraversal("aws_cloudfront_origin_access_identity.assets_access_id.iam_arn")]
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
      cloudResource("aws_cloudfront_cache_policy", "next_js_default", {
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
      cloudResource("aws_cloudfront_cache_policy", "next_js_s3", {
        name: appendToTemplate(namePrefix, [`${bag.Name}-s3-cache-policy`]),
        default_ttl: 2592e3,
        max_ttl: 5184e3,
        min_ttl: 2592e3,
        parameters_in_cache_key_and_forwarded_to_origin: asBlock([{
          enable_accept_encoding_brotli: true,
          enable_accept_encoding_gzip: true,
          cookies_config: asBlock([{
            cookie_behavior: "none"
          }]),
          headers_config: asBlock([{
            header_behavior: "none"
          }]),
          query_strings_config: asBlock([{
            query_string_behavior: "none"
          }])
        }])
      }),
      cloudResource("aws_cloudfront_response_headers_policy", "next_js_s3", {
        name: appendToTemplate(namePrefix, [`${bag.Name}-s3-response-headers-policy`]),
        custom_headers_config: asBlock([{
          items: asBlock([{
            header: "cache-control",
            override: false,
            value: "public,max-age=2592000,immutable"
          }])
        }])
      }),
      cloudData("aws_cloudfront_origin_request_policy", "all_viewer", {
        name: "Managed-AllViewer"
      }),
      cloudData("aws_cloudfront_cache_policy", "no_cache", {
        name: "Managed-CachingDisabled"
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
          {
            domain_name: asTraversal("aws_s3_bucket.assets.bucket_regional_domain_name"),
            origin_id: "assets",
            s3_origin_config: asBlock([{
              origin_access_identity: asTraversal("aws_cloudfront_origin_access_identity.assets_access_id.cloudfront_access_identity_path")
            }])
          },
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
              origin_ssl_protocols: ["TLSv1.2"]
            }]),
            custom_header: asBlock([{
              name: "x-origin-url",
              value: asTraversal("aws_function.origin-server.function_url")
            }])
          }
        ]),
        origin_group: asBlock([{
          origin_id: "all",
          member: asBlock([
            { origin_id: "server" },
            { origin_id: "assets" }
          ]),
          failover_criteria: asBlock([{
            status_codes: [403, 404]
          }])
        }]),
        default_cache_behavior: asBlock([{
          allowed_methods: ["GET", "HEAD", "OPTIONS"],
          cached_methods: ["GET", "HEAD"],
          viewer_protocol_policy: "redirect-to-https",
          target_origin_id: "all",
          compress: true,
          cache_policy_id: asTraversal("aws_cloudfront_cache_policy.next_js_default.id"),
          origin_request_policy_id: asTraversal("data.aws_cloudfront_origin_request_policy.all_viewer.id"),
          lambda_function_association: asBlock([{
            event_type: "origin-request",
            lambda_arn: asTraversal("aws_function.origin-request.qualified_arn"),
            include_body: false
          }])
        }]),
        ordered_cache_behavior: asBlock([
          // serverBehavior("/"),
          serverBehavior("api/*"),
          serverBehavior("_next/data/*"),
          {
            path_pattern: "_next/*",
            allowed_methods: ["GET", "HEAD", "OPTIONS"],
            cached_methods: ["GET", "HEAD", "OPTIONS"],
            viewer_protocol_policy: "redirect-to-https",
            target_origin_id: "assets",
            compress: true,
            cache_policy_id: asTraversal("aws_cloudfront_cache_policy.next_js_s3.id"),
            response_headers_policy_id: asTraversal("aws_cloudfront_response_headers_policy.next_js_s3.id")
          }
        ]),
        aliases: domainNames,
        viewer_certificate: asBlock([
          (() => {
            const minimumProtocolVersion = "TLSv1.2_2021";
            if (domainNames.length === 0) {
              return {
                cloudfront_default_certificate: true
              };
            }
            if (dotDomain.certificate_arn) {
              return {
                acm_certificate_arn: dotDomain.certificate_arn,
                ssl_support_method: "sni-only",
                minimum_protocol_version: minimumProtocolVersion
              };
            }
            if (dotDomain.existing_certificate_domain) {
              return {
                acm_certificate_arn: asTraversal(`data.aws_acm_certificate.imported_certificate.arn`),
                ssl_support_method: "sni-only",
                minimum_protocol_version: minimumProtocolVersion
              };
            }
            if (dotDomain.certificate_domain_to_create) {
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
              acm_certificate_arn: asTraversal(`aws_acm_certificate_validation.validation.certificate_arn`),
              ssl_support_method: "sni-only",
              minimum_protocol_version: minimumProtocolVersion
            };
          })()
        ])
      })
    ];
    if (domainNames.length > 0) {
      databags.push(
        cloudData("aws_route53_zone", "zone", {
          name: dotDomain.zone
        }),
        ...domainNames.map((domainName, i) => cloudResource("aws_route53_record", `cf_distrib_domain_record_${i}`, {
          zone_id: asTraversal("data.aws_route53_zone.zone.zone_id"),
          name: domainName,
          type: "CNAME",
          ttl: 300,
          records: [
            asTraversal("aws_cloudfront_distribution.distribution.domain_name")
          ]
        }))
      );
      if (!dotDomain.certificate_arn) {
        if (dotDomain.existing_certificate_domain) {
          databags.push(
            cloudData("aws_acm_certificate", "imported_certificate", {
              domain: dotDomain.existing_certificate_domain,
              types: ["AMAZON_ISSUED"],
              most_recent: true
            })
          );
        } else if (dotDomain.certificate_domain_to_create) {
          databags.push(...acmCertificateResources(dotDomain.certificate_domain_to_create));
        } else if (domainNames.length === 1) {
          databags.push(...acmCertificateResources(domainNames[0]));
        }
      }
    }
    let imports = [
      {
        name: `aws_next_js_aws_iam_lambda_role_${bag.Name}`,
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
        name: `aws_next_js_aws_lambda_${bag.Name}`,
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
              handler: "origin_request.handler",
              runtime: `nodejs${nodeJsVersion}.x`,
              timeout: 3,
              name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])]
            }
          },
          {
            Type: "aws_function",
            Name: "origin-server",
            Value: {
              cloudresource_dir: "aws_next_js_" + bag.Name,
              cloudresource_id: "aws_next_js_" + bag.Name,
              package: [{
                packaged_file: "server.zip"
              }],
              handler: "nextapp/server.handler",
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
      databags.push(nextJsBuild());
    }
    if (container["cr_[terraform]"]) {
      databags.push(cloudTerraform("", "", prependTfStateFileName(container, `_aws_next_js_${bag.Name}`)));
    }
    return [{ databags, imports }];
  }
  function generate() {
    const dbOrImports = iterateBlocks(container, AWS_NEXT_JS, generateIterator1).flat();
    exportDatabags(dbOrImports.map((db) => db.databags).flat());
    exportDatabags(importComponents(container, dbOrImports.map((db) => db.imports).flat()));
  }
  function applyIterator1(bag) {
    if (!bag.Value) {
      return [];
    }
    return [{
      Type: "terraform_execute",
      Name: `aws_next_js_${bag.Name}`,
      Value: {
        display_name: `Terraform apply - aws_next_js.${bag.Name}`,
        mode: "apply",
        dir: `${outputDir}/aws_next_js_${bag.Name}`
      }
    }];
  }
  var applyIterator2 = (terraformExecuteResults) => (bag) => {
    if (!bag.Value) {
      return [];
    }
    let databags = [];
    if (container["cr_[terraform]"]) {
      databags.push(
        BarbeState.putInObject(CREATED_TF_STATE_KEY, {
          [bag.Name]: prependTfStateFileName(container, `_aws_next_js_${bag.Name}`)
        })
      );
    }
    let imports = [];
    if (terraformExecuteResults.terraform_execute_output?.[`aws_next_js_${bag.Name}`]) {
      const outputs = asValArrayConst(terraformExecuteResults.terraform_execute_output[`aws_next_js_${bag.Name}`][0].Value);
      const bucketName = asStr(outputs.find((pair) => asStr(pair.key) === "assets_s3_bucket").value);
      imports.push({
        name: `aws_next_js_${bag.Name}`,
        url: AWS_S3_SYNC_URL,
        input: [{
          Type: AWS_S3_SYNC_FILES,
          Name: `aws_next_js_${bag.Name}`,
          Value: {
            display_name: `Uploading Next.js files - ${bag.Name}`,
            bucket_name: bucketName,
            delete: true,
            dir: `${outputDir}/aws_next_js_${bag.Name}/static`,
            blob: "."
          }
        }]
      });
    }
    return [{ databags, imports }];
  };
  function apply() {
    const step0Import = {
      name: "aws_cloudfront_static_hosting_apply",
      url: TERRAFORM_EXECUTE_URL,
      input: [
        ...iterateBlocks(container, AWS_NEXT_JS, applyIterator1).flat(),
        ...makeEmptyExecuteDatabags(container, state)
      ]
    };
    const terraformExecuteResults = importComponents(container, [step0Import]);
    exportDatabags(emptyExecutePostProcess(container, terraformExecuteResults, AWS_NEXT_JS, CREATED_TF_STATE_KEY));
    const step2Result = iterateBlocks(container, AWS_NEXT_JS, applyIterator2(terraformExecuteResults)).flat();
    exportDatabags(step2Result.map((db) => db.databags).flat());
    importComponents(container, step2Result.map((db) => db.imports).flat());
  }
  function destroyIterator1(bag) {
    if (!bag.Value) {
      return [];
    }
    return [{
      Type: "terraform_execute",
      Name: `aws_next_js_destroy_${bag.Name}`,
      Value: {
        display_name: `Terraform destroy - aws_next_js.${bag.Name}`,
        mode: "destroy",
        dir: `${outputDir}/aws_next_js_${bag.Name}`
      }
    }];
  }
  function destroyIterator2(bag) {
    if (!bag.Value) {
      return [];
    }
    return [
      BarbeState.deleteFromObject(CREATED_TF_STATE_KEY, bag.Name)
    ];
  }
  function destroy() {
    let step0Import = {
      name: "aws_next_js_destroy",
      url: TERRAFORM_EXECUTE_URL,
      input: [
        ...iterateBlocks(container, AWS_NEXT_JS, destroyIterator1).flat(),
        ...makeEmptyExecuteDatabags(container, state)
      ]
    };
    const results = importComponents(container, [step0Import]);
    exportDatabags(emptyExecutePostProcess(container, results, AWS_NEXT_JS, CREATED_TF_STATE_KEY));
    exportDatabags(iterateBlocks(container, AWS_NEXT_JS, destroyIterator2).flat());
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
