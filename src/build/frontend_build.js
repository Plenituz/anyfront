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
  function readDatabagContainer() {
    return JSON.parse(os.file.readFile("__barbe_input.json"));
  }
  function onlyRunForLifecycleSteps(steps) {
    const step = barbeLifecycleStep();
    if (!steps.includes(step)) {
      quit();
    }
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
  function compileBlockParam(blockVal, blockName) {
    return asVal(mergeTokens((blockVal[blockName] || asSyntax([])).ArrayConst || []));
  }
  function applyMixins(str, mixins) {
    for (const mixinName in mixins) {
      str = str.replace(new RegExp(`{{${mixinName}}}`, "g"), mixins[mixinName]);
    }
    return str;
  }

  // anyfront-lib/consts.ts
  var FRONTEND_BUILD = "frontend_build";
  var BARBE_SLS_VERSION = "v0.1.1";
  var ANYFRONT_VERSION = "v0.1.2";
  var TERRAFORM_EXECUTE_URL = `https://hub.barbe.app/barbe-serverless/terraform_execute/${BARBE_SLS_VERSION}/.js`;
  var AWS_IAM_URL = `https://hub.barbe.app/barbe-serverless/aws_iam/${BARBE_SLS_VERSION}/.js`;
  var AWS_LAMBDA_URL = `https://hub.barbe.app/barbe-serverless/aws_function/${BARBE_SLS_VERSION}/.js`;
  var GCP_PROJECT_SETUP_URL = `https://hub.barbe.app/anyfront/gcp_project_setup/${ANYFRONT_VERSION}/.js`;
  var AWS_S3_SYNC_URL = `https://hub.barbe.app/anyfront/aws_s3_sync_files/${ANYFRONT_VERSION}/.js`;
  var FRONTEND_BUILD_URL = `https://hub.barbe.app/anyfront/frontend_build/${ANYFRONT_VERSION}/.js`;
  var GCP_CLOUDRUN_STATIC_HOSTING_URL = `https://hub.barbe.app/anyfront/gcp_cloudrun_static_hosting/${ANYFRONT_VERSION}/.js`;
  var AWS_CLOUDFRONT_STATIC_HOSTING_URL = `https://hub.barbe.app/anyfront/aws_cloudfront_static_hosting/${ANYFRONT_VERSION}/.js`;

  // frontend_build/build_script.template.js
  var build_script_template_default = "const fs = require('fs');\nconst path = require('path');\nconst { execSync } = require('child_process');\nconst processName = '{{name}}'\nconst givenBuildDir = '{{build_dir}}'\nconst givenBuildOutputDir = '{{build_output_dir}}'\nconst givenInstallCmd = '{{install_cmd}}'\nconst givenBuildCmd = '{{build_cmd}}'\nconst originalWd = process.cwd();\nconst givenCmdEnv = {\n    {{cmd_env}}\n}\n//TODO make this configurable\nconst ignoredDirs = {\n    '.svelte-kit': true,\n    'node_modules': true,\n}\n\nfunction find(dir, fileName) {\n    const files = fs.readdirSync(dir);\n    let found = [];\n    files.forEach(file => {\n        const filePath = path.join(dir, file);\n        if (fs.statSync(filePath).isDirectory()) {\n            if (file === 'node_modules') {\n                return;\n            }\n            found = found.concat(find(filePath, fileName));\n        } else if (file === fileName) {\n            found.push(filePath);\n        }\n    });\n    return found;\n}\n\nfunction filter(files, strings) {\n    return files.filter(file => {\n        const content = fs.readFileSync(file, 'utf-8');\n        return strings.some(s => content.includes(s));\n    })\n}\n\nfunction formatError(err) {\n    process.chdir(originalWd);\n    const output = {\n        frontend_build_output: {\n            [processName]: {\n                error: err\n            }\n        }\n    }\n    fs.writeFileSync('output.json', JSON.stringify(output));\n    fs.writeFileSync('exported_files.json', JSON.stringify({\n        [path.join(originalWd, 'output.json')]: 'frontend_build_' + processName + '_output.json',\n    }));\n}\n\nfunction formatSuccess(obj) {\n    process.chdir(originalWd);\n    const output = {\n        frontend_build_output: {\n            [processName]: {\n                success: obj\n            }\n        }\n    }\n    fs.writeFileSync('output.json', JSON.stringify(output));\n}\n\nfunction execSyncWrapper(cmd) {\n    const execOpt = {\n        stdio: 'inherit',\n        env: {\n            ...process.env,\n            ...givenCmdEnv,\n        },\n    };\n    console.log('[', cmd, ']');\n    return execSync(cmd, execOpt);\n}\n\nasync function wait(t) {\n    return new Promise(resolve => setTimeout(resolve, t))\n}\n\nasync function main() {\n    let reactAppDir = givenBuildDir;\n    if(!reactAppDir) {\n        const foundReacts = filter(find('.', 'package.json'), ['react', 'svelte']);\n        if (foundReacts.length === 0) {\n            formatError('no_package_json_found')\n            return\n        }\n        if (foundReacts.length > 1) {\n            formatError('multiple_package_json_found')\n            return\n        }\n        reactAppDir = path.dirname(foundReacts[0]);\n    }\n\n    console.log('React app directory: ' + reactAppDir);\n    process.chdir(reactAppDir);\n\n    const usingYarn = fs.existsSync('yarn.lock')\n    if (givenInstallCmd) {\n        execSyncWrapper(givenInstallCmd);\n    } else if (usingYarn) {\n        execSyncWrapper('yarn install');\n    } else {\n        execSyncWrapper('npm install');\n    }\n\n\n    let dirsPreBuild = fs.readdirSync('.').filter(f => fs.statSync(f).isDirectory())\n    let changedFiles = {}\n    if(!givenBuildOutputDir) {\n        let watchingDirs = {}\n        const watchHandler = (baseDir) => (eventType, filename) => {\n            filename = path.join(baseDir, filename)\n            let dir;\n            try {\n                if(fs.statSync(filename).isDirectory()) {\n                    dir = filename;\n                } else {\n                    dir = path.dirname(filename);\n                }\n            }catch (e){\n                return;\n            }\n            \n            if (dir in ignoredDirs || Object.keys(ignoredDirs).some(d => dir.startsWith(d))) {\n                return;\n            }\n            if(!(dir in watchingDirs)) {\n                watchingDirs[dir] = true;\n                fs.watch(dir, {persistent: false}, watchHandler(dir));\n            }\n\n            dir = dir.split(path.sep)[0];\n            if(dir === '.') {\n                return;\n            }\n            if (!(dir in changedFiles)) {\n                changedFiles[dir] = 1\n            }\n            changedFiles[dir] += 1;\n        }\n        fs.watch('.', {persistent: false}, watchHandler('.'));\n        dirsPreBuild.forEach(d => fs.watch(d, {persistent: false}, watchHandler(d)));\n    }\n    \n    if (givenBuildCmd) {\n        execSyncWrapper(givenBuildCmd);\n    } else if (usingYarn) {\n        execSyncWrapper('yarn build');\n    } else {\n        execSyncWrapper('npm run build');\n    }\n\n    let buildOutputDir = givenBuildOutputDir;\n    if(!givenBuildOutputDir) {\n        //give time for the watcher to catch up\n        await wait(5000)\n        if (Object.keys(changedFiles).length === 0) {\n            let dirsPostBuild = fs.readdirSync('.').filter(f => fs.statSync(f).isDirectory())\n            let hash = {}\n            dirsPreBuild.forEach(d => hash[d] = true)\n            let dirs = dirsPostBuild.filter(d => !hash[d])\n            if (dirs.length === 0) {\n                formatError('no_build_output_dir')\n                return\n            }\n            buildOutputDir = dirs[0]\n        } else {\n            let dirs = Object.keys(changedFiles)\n                .sort((a, b) => changedFiles[b] - changedFiles[a])\n            buildOutputDir = dirs[0]\n        }\n    }\n\n    console.log('Build finished in', buildOutputDir);\n    formatSuccess({\n        build_output_dir: path.join(reactAppDir, buildOutputDir)\n    })\n    console.log('writing', process.cwd() + '/exported_files.json')\n    fs.writeFileSync('exported_files.json', JSON.stringify({\n        [path.join(originalWd, 'output.json')]: 'frontend_build_' + processName + '_output.json',\n        [path.join(originalWd, reactAppDir, buildOutputDir)]: 'frontend_build_' + processName + '/'\n    }));\n}\n\nmain();";

  // frontend_build/frontend_build.ts
  var container = readDatabagContainer();
  var outputDir = barbeOutputDir();
  onlyRunForLifecycleSteps(["generate"]);
  function frontendBuildIterator(bag) {
    if (!bag.Value) {
      return [];
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value);
    const dotEnvironment = compileBlockParam(block, "environment");
    const buildScript = applyMixins(build_script_template_default, {
      name: bag.Name,
      build_dir: asStr(block.build_dir || ""),
      build_output_dir: asStr(block.build_output_dir || ""),
      install_cmd: asStr(block.install_cmd || ""),
      build_cmd: asStr(block.build_cmd || ""),
      cmd_env: Object.entries(dotEnvironment).map(([k, v]) => `"${k}": ${JSON.stringify(asStr(v))}`).join("\n")
    });
    return [{
      Type: "buildkit_run_in_container",
      Name: `frontend_build_${bag.Name}`,
      Value: {
        no_cache: true,
        display_name: `Frontend build - ${bag.Name}`,
        excludes: [
          "**/node_modules",
          "node_modules"
        ],
        exported_files_location: "src/exported_files.json",
        read_back: `frontend_build_${bag.Name}_output.json`,
        input_files: {
          "__barbe_build_script.cjs": buildScript
        },
        dockerfile: `
                FROM node:${asStr(block.nodejs_version || "18")}${asStr(block.nodejs_version_tag || "-slim")}

                COPY --from=src . /src
                WORKDIR /src

                RUN node __barbe_build_script.cjs
                `
      }
    }];
  }
  var results = applyTransformers(iterateBlocks(container, FRONTEND_BUILD, frontendBuildIterator).flat());
  var frontendBuildResultIterator = (bag) => {
    if (!bag.Value) {
      return [];
    }
    const outputResult = results?.frontend_build_output?.[bag.Name]?.[0]?.Value;
    if (!outputResult) {
      return [];
    }
    const output = asVal(outputResult);
    if (output.error) {
      const errStr = asStr(output.error);
      switch (errStr) {
        case "no_package_json_found":
          throw new Error(`no package.json found in current or sub directories, please provide a 'build_dir' on frontend_build block '${bag.Name}'`);
        case "multiple_package_json_found":
          throw new Error(`multiple package.json found in current or sub directories, please provide a 'build_dir' on frontend_build block '${bag.Name}'`);
        case "no_build_changed_files":
          throw new Error(`couldn't figure out where the build files were generated, please provide a 'build_output_dir' on frontend_build block '${bag.Name}' or delete any existing build output directory`);
        default:
          throw new Error(`unknown error: ${errStr}`);
      }
    }
    return [{
      Type: "frontend_build_output",
      Name: bag.Name,
      Value: `${outputDir}/frontend_build_${bag.Name}`
    }];
  };
  exportDatabags(iterateBlocks(container, FRONTEND_BUILD, frontendBuildResultIterator).flat());
})();
