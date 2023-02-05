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
  var TERRAFORM_EXECUTE_GET_OUTPUT = "terraform_execute_get_output";
  var BARBE_SLS_VERSION2 = "v0.2.1";
  var TERRAFORM_EXECUTE_URL2 = `https://hub.barbe.app/barbe-serverless/terraform_execute/${BARBE_SLS_VERSION2}/.js`;

  // gcp_project_setup.ts
  var container = readDatabagContainer();
  var state = BarbeState.readState();
  var outputDir = barbeOutputDir();
  var CREATED_TF_STATE_KEY = "created_tfstate";
  var CREATED_PROJECT_NAME_KEY = "created_project_name";
  var alreadyDeployedProjectOutput = Object.entries(state[CREATED_PROJECT_NAME_KEY] || {}).map(([bagName, projectName]) => ({
    Type: "gcp_project_setup_output",
    Name: bagName,
    Value: {
      project_name: projectName
    }
  }));
  function gcpProjectSetupGenerateIterator(bag) {
    if (!bag.Value) {
      return [];
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
      return localDatabags;
    };
    let databags = projectSetupResource();
    if (container["cr_[terraform]"]) {
      databags.push(cloudTerraform("", "", prependTfStateFileName(container, `_gcp_project_setup_${bag.Name}`)));
    }
    return databags;
  }
  function gcpProjectSetupApplyIterator(bag) {
    if (!bag.Value) {
      return [];
    }
    if (BarbeState.getObjectValue(state, CREATED_TF_STATE_KEY, bag.Name)) {
      return [];
    }
    return [{
      Type: "terraform_execute",
      Name: `gcp_setup_${bag.Name}`,
      Value: {
        display_name: `Terraform apply - gcp_project_setup.${bag.Name}`,
        mode: "apply",
        dir: `${outputDir}/gcp_project_setup_${bag.Name}`
      }
    }];
  }
  function makeEmptyExecuteDatabags() {
    if (!container["cr_[terraform]"]) {
      return [];
    }
    return emptyExecuteTemplate(container, state, GCP_PROJECT_SETUP, CREATED_TF_STATE_KEY);
  }
  function gcpProjectSetupApply() {
    const results = importComponents(container, [{
      name: "gcp_project_setup_apply",
      url: TERRAFORM_EXECUTE_URL,
      input: [
        ...iterateBlocks(container, GCP_PROJECT_SETUP, gcpProjectSetupApplyIterator).flat(),
        ...makeEmptyExecuteDatabags()
      ]
    }]);
    const applyProcessResultsIterator = (bag) => {
      if (!bag.Value) {
        return [];
      }
      if (!results.terraform_execute_output[`gcp_setup_${bag.Name}`]) {
        return [];
      }
      const projectName = asStr(asVal(asVal(results.terraform_execute_output[`gcp_setup_${bag.Name}`][0].Value)[0]).value);
      let databags2 = [{
        Type: "gcp_project_setup_output",
        Name: bag.Name,
        Value: {
          project_name: projectName
        }
      }];
      if (container["cr_[terraform]"]) {
        databags2.push(
          BarbeState.putInObject(CREATED_TF_STATE_KEY, {
            [bag.Name]: prependTfStateFileName(container, `_gcp_project_setup_${bag.Name}`)
          }),
          BarbeState.putInObject(CREATED_PROJECT_NAME_KEY, {
            [bag.Name]: projectName
          })
        );
      }
      return databags2;
    };
    let databags = [
      ...emptyExecutePostProcess(container, results, GCP_PROJECT_SETUP, CREATED_TF_STATE_KEY),
      ...emptyExecutePostProcess(container, results, GCP_PROJECT_SETUP, CREATED_PROJECT_NAME_KEY),
      ...alreadyDeployedProjectOutput
    ];
    if (results.terraform_execute_output) {
      databags.push(
        ...iterateBlocks(container, GCP_PROJECT_SETUP, applyProcessResultsIterator).flat()
      );
    }
    exportDatabags(databags);
  }
  function gcpProjectSetupDestroyIterator(bag) {
    if (!bag.Value) {
      return [];
    }
    return [{
      Type: "terraform_execute",
      Name: `gcp_destroy_${bag.Name}`,
      Value: {
        display_name: `Terraform destroy - gcp_project_setup.${bag.Name}`,
        mode: "destroy",
        dir: `${outputDir}/gcp_project_setup_${bag.Name}`
      }
    }];
  }
  function gcpProjectSetupDestroy() {
    const results = importComponents(container, [{
      name: "gcp_project_setup_destroy",
      url: TERRAFORM_EXECUTE_URL,
      input: [
        ...iterateBlocks(container, GCP_PROJECT_SETUP, gcpProjectSetupDestroyIterator).flat(),
        ...makeEmptyExecuteDatabags()
      ]
    }]);
    const destroyProcessResultsIterator = (bag) => {
      if (!bag.Value) {
        return [];
      }
      return [
        BarbeState.deleteFromObject(CREATED_TF_STATE_KEY, bag.Name),
        BarbeState.deleteFromObject(CREATED_PROJECT_NAME_KEY, bag.Name)
      ];
    };
    let databags = [
      ...emptyExecutePostProcess(container, results, GCP_PROJECT_SETUP, CREATED_TF_STATE_KEY),
      ...emptyExecutePostProcess(container, results, GCP_PROJECT_SETUP, CREATED_PROJECT_NAME_KEY),
      //we keep that in case the calling template uses it, even tho it just got destroyed
      ...alreadyDeployedProjectOutput,
      ...iterateBlocks(container, GCP_PROJECT_SETUP, destroyProcessResultsIterator).flat()
    ];
    exportDatabags(databags);
  }
  function gcpProjectSetupGetInfoIterator(bag) {
    if (!bag.Value) {
      return [];
    }
    const [block, _] = applyDefaults(container, bag.Value);
    if (!block.name) {
      throw new Error(`gcp_project_setup_get_info block ${bag.Name} is missing a 'name' parameter`);
    }
    const name = asStr(block.name);
    return [{
      Type: TERRAFORM_EXECUTE_GET_OUTPUT,
      Name: `gcp_setup_get_output_${bag.Name}`,
      Value: {
        display_name: `Terraform output - gcp_project_setup.${name}`,
        dir: `${outputDir}/gcp_project_setup_${name}`
      }
    }];
  }
  function getInfo() {
    const results = importComponents(container, [{
      name: `gcp_project_setup_get_info_${barbeLifecycleStep()}`,
      url: TERRAFORM_EXECUTE_URL,
      input: iterateBlocks(container, GCP_PROJECT_SETUP_GET_INFO, gcpProjectSetupGetInfoIterator).flat()
    }]);
    const resultsIterator = (bag) => {
      if (!bag.Value) {
        return [];
      }
      if (!results.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`] || !results.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0] || !results.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0].Value || !asVal(results.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0].Value)[0]) {
        return [];
      }
      const projectName = asStr(asVal(asVal(results.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0].Value)[0]).value);
      let databags = [{
        Type: "gcp_project_setup_output",
        Name: bag.Name,
        Value: {
          project_name: projectName
        }
      }];
      return databags;
    };
    if (results.terraform_execute_output) {
      exportDatabags(iterateBlocks(container, GCP_PROJECT_SETUP_GET_INFO, resultsIterator).flat());
    }
  }
  getInfo();
  switch (barbeLifecycleStep()) {
    case "generate":
      exportDatabags(iterateBlocks(container, GCP_PROJECT_SETUP, gcpProjectSetupGenerateIterator).flat());
      break;
    case "apply":
      gcpProjectSetupApply();
      break;
    case "destroy":
      gcpProjectSetupDestroy();
      break;
  }
})();
