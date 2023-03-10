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
  function statFile(fileName) {
    return barbeRpcCall({
      method: "statFile",
      params: [fileName]
    });
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

  // anyfront-lib/consts.ts
  var STATIC_HOSTING = "static_hosting";
  var AWS_NEXT_JS = "aws_next_js";
  var GCP_NEXT_JS = "gcp_next_js";
  var AWS_SVELTEKIT = "aws_sveltekit";
  var ANYFRONT = "anyfront";
  var BARBE_SLS_VERSION = "v0.2.3";
  var ANYFRONT_VERSION = "v0.2.5";
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

  // anyfront.ts
  var container = readDatabagContainer();
  var SupportedPlatforms = ["aws", "gcp"];
  var SupportedFrameworks = [
    "react-spa",
    "next",
    "next-export",
    "vue-spa",
    "solidjs-spa",
    "solidstart",
    "svelte-spa",
    "sveltekit"
  ];
  function getPackageJsonAppType(packageJson) {
    let packageJsonObj;
    try {
      packageJsonObj = JSON.parse(packageJson);
    } catch (e) {
      console.log("error parsing package.json: " + e);
      return null;
    }
    if (packageJsonObj.dependencies?.["next"] || packageJsonObj.devDependencies?.["next"]) {
      if (packageJsonObj.scripts?.build?.includes("next export")) {
        return "next-export";
      }
      return "next";
    }
    if (packageJsonObj.dependencies?.["react"] || packageJsonObj.devDependencies?.["react"]) {
      return "react-spa";
    }
    if (packageJsonObj.dependencies?.["vue"] || packageJsonObj.devDependencies?.["vue"]) {
      return "vue-spa";
    }
    if (packageJsonObj.dependencies?.["solid-start"] || packageJsonObj.devDependencies?.["solid-start"]) {
      return "solidstart";
    }
    if (packageJsonObj.dependencies?.["solid-js"] || packageJsonObj.devDependencies?.["solid-js"]) {
      return "solidjs-spa";
    }
    if (packageJsonObj.dependencies?.["@sveltejs/kit"] || packageJsonObj.devDependencies?.["@sveltejs/kit"]) {
      return "sveltekit";
    }
    if (packageJsonObj.dependencies?.["svelte"] || packageJsonObj.devDependencies?.["svelte"]) {
      return "svelte-spa";
    }
    return null;
  }
  function getDirAppType(dir) {
    const packageJsonStat = statFile(os.path.join(dir, "package.json"));
    if (isFailure(packageJsonStat)) {
      return null;
    }
    if (packageJsonStat.result.isDir) {
      return null;
    }
    const packageJson = os.file.readFile(os.path.join(dir, "package.json"));
    return getPackageJsonAppType(packageJson);
  }
  function findAppDirs(dir) {
    const appType = getDirAppType(dir);
    if (appType) {
      return [{
        location: dir,
        framework: appType
      }];
    }
    const files = os.file.listDir(dir);
    const results = [];
    for (const file of files) {
      if (file === "." || file === "..") {
        continue;
      }
      if (file === "node_modules" || file === barbeOutputDir()) {
        continue;
      }
      const path = os.path.join(dir, file);
      const fileStat = statFile(path);
      if (isFailure(fileStat)) {
        continue;
      }
      if (!fileStat.result.isDir) {
        continue;
      }
      results.push(...findAppDirs(path));
    }
    return results;
  }
  function staticHostingPipeline(apps) {
    return [
      step(() => ({
        imports: [{
          url: STATIC_HOSTING_URL,
          copyFromContainer: [
            "cr_[terraform]",
            "default",
            "global_default",
            "state_store",
            "static_hosting_build_dir_map"
          ],
          input: apps.map((app) => ({
            Type: STATIC_HOSTING,
            Name: app.bag.Name,
            Value: {
              ...app.block,
              build: [{
                ...compileBlockParam(app.block, "build"),
                build_dir: app.appInfo.location,
                ...app.extraSettings
              }]
            }
          }))
        }]
      })),
      step(({ previousStepResult }) => exportDatabags(previousStepResult))
    ];
  }
  function sveltekitAwsPipeline(apps) {
    return [
      step(() => ({
        imports: [{
          url: AWS_SVELTEKIT_URL,
          copyFromContainer: ["cr_[terraform]", "default", "global_default", "state_store"],
          input: apps.map((app) => ({
            Type: AWS_SVELTEKIT,
            Name: app.bag.Name,
            Value: {
              ...app.block,
              app_dir: app.appInfo.location,
              ...app.extraSettings
            }
          }))
        }]
      })),
      step(({ previousStepResult }) => exportDatabags(previousStepResult))
    ];
  }
  function nextAwsPipeline(apps) {
    return [
      step(() => ({
        imports: [{
          url: AWS_NEXT_JS_URL,
          copyFromContainer: ["cr_[terraform]", "default", "global_default", "state_store"],
          input: apps.map((app) => ({
            Type: AWS_NEXT_JS,
            Name: app.bag.Name,
            Value: {
              ...app.block,
              app_dir: app.appInfo.location,
              ...app.extraSettings
            }
          }))
        }]
      })),
      step(({ previousStepResult }) => exportDatabags(previousStepResult))
    ];
  }
  function nextGcpPipeline(apps) {
    return [
      step(() => ({
        imports: [{
          url: GCP_NEXT_JS_URL,
          copyFromContainer: ["cr_[terraform]", "default", "global_default", "state_store"],
          input: apps.map((app) => ({
            Type: GCP_NEXT_JS,
            Name: app.bag.Name,
            Value: {
              ...app.block,
              app_dir: app.appInfo.location,
              ...app.extraSettings
            }
          }))
        }]
      })),
      step(({ previousStepResult }) => exportDatabags(previousStepResult))
    ];
  }
  function makePipeline(framework, platform, apps) {
    let steps = [];
    switch (framework) {
      case "next-export":
        apps.forEach((app) => {
          app.extraSettings = {
            build_output_dir: "out"
          };
          return app;
        });
      case "react-spa":
      case "vue-spa":
      case "solidjs-spa":
      case "svelte-spa":
      default:
        steps = staticHostingPipeline(apps);
        break;
      case "next":
        switch (platform) {
          case "aws":
            steps = nextAwsPipeline(apps);
            break;
          case "gcp":
            steps = nextGcpPipeline(apps);
            break;
          default:
            throw new Error(`next.js not supported on platform '${platform}'`);
        }
        break;
      case "sveltekit":
        switch (platform) {
          case "aws":
            steps = sveltekitAwsPipeline(apps);
            break;
          default:
            throw new Error(`sveltekit not supported on platform '${platform}' yet`);
        }
        break;
    }
    return pipeline(steps, { name: `anyfront-${framework}-${platform}` });
  }
  function makeAppPipelines(apps) {
    let appPerType = {};
    for (const app of apps) {
      if (!app.block.platform) {
        throw new Error(`'platform' is required for 'anyfront' block`);
      }
      const platform = asStr(app.block.platform);
      if (!appPerType[app.appInfo.framework]) {
        appPerType[app.appInfo.framework] = {};
      }
      if (!appPerType[app.appInfo.framework][platform]) {
        appPerType[app.appInfo.framework][platform] = [];
      }
      appPerType[app.appInfo.framework][platform].push(app);
    }
    let pipelines = [];
    for (const [framework, platforms] of Object.entries(appPerType)) {
      for (const [platform, apps2] of Object.entries(platforms)) {
        pipelines.push(makePipeline(framework, platform, apps2));
      }
    }
    for (const framework of SupportedFrameworks) {
      for (const platform of SupportedPlatforms) {
        if (!appPerType[framework] || !appPerType[framework][platform]) {
          try {
            pipelines.push(makePipeline(framework, platform, []));
          } catch (e) {
          }
        }
      }
    }
    return pipelines;
  }
  function main() {
    const foundApps = iterateBlocks(container, ANYFRONT, (bag) => {
      if (!bag.Value) {
        return null;
      }
      const [block, namePrefix] = applyDefaults(container, bag.Value);
      let appInfo;
      let givenAppDir = ".";
      if (block.app_dir) {
        if (!isSimpleTemplate(block.app_dir)) {
          if (IS_VERBOSE) {
            console.log("anyfront: app_dir not ready yet", JSON.stringify(block.app_dir));
          }
          return null;
        }
        givenAppDir = asStr(block.app_dir);
      }
      const appDirs = findAppDirs(givenAppDir);
      if (appDirs.length === 0) {
        throwStatement('anyfront: couldnt find a sub directory with a package.json that has a supported framework, please provide the path to it in the "app_dir" field');
      }
      if (appDirs.length > 1) {
        throwStatement('anyfront: found multiple sub directories with a package.json that has a supported framework, please provide the path to the app you want deployed in the "app_dir" field: ' + appDirs.map((a) => a.location).join(","));
      }
      appInfo = appDirs[0];
      return {
        bag,
        block,
        namePrefix,
        appInfo
      };
    }).flat().filter((t) => t);
    executePipelineGroup(container, makeAppPipelines(foundApps));
  }
  main();
})();
