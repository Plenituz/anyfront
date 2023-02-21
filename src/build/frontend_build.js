(() => {
  // ../../barbe-serverless/src/barbe-std/rpc.ts
  function isSuccess(resp) {
    return resp.result !== void 0;
  }
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
  function statFile(fileName) {
    return barbeRpcCall({
      method: "statFile",
      params: [fileName]
    });
  }
  function dirname(path) {
    const parts = path.split("/");
    if (parts.length === 1) {
      return ".";
    } else if (parts.length === 2 && parts[0] === "") {
      return "/";
    } else {
      parts.pop();
      return parts.join("/");
    }
  }
  function throwStatement(message) {
    throw new Error(message);
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
  function applyMixins(str, mixins) {
    for (const mixinName in mixins) {
      str = str.replace(new RegExp(`{{${mixinName}}}`, "g"), mixins[mixinName]);
    }
    return str;
  }

  // anyfront-lib/consts.ts
  var FRONTEND_BUILD = "frontend_build";
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
  var AWS_CLOUDFRONT_STATIC_HOSTING_URL = `https://hub.barbe.app/anyfront/aws_cloudfront_static_hosting.js:${ANYFRONT_VERSION}`;
  var STATIC_HOSTING_URL = `https://hub.barbe.app/anyfront/static_hosting.js:${ANYFRONT_VERSION}`;

  // frontend_build/build_script.template.js
  var build_script_template_default = "const fs = require('fs');\nconst path = require('path');\nconst { execSync } = require('child_process');\nconst processName = '{{name}}'\nconst givenBuildDir = '{{build_dir}}'\nconst givenBuildOutputDir = '{{build_output_dir}}'\nconst givenBuildCmd = '{{build_cmd}}'\nconst originalWd = process.cwd();\nconst givenCmdEnv = {{cmd_env}}\nconst ignoredDirs = {{ignored_dirs}}\n\nfunction formatError(err) {\n    process.chdir(originalWd);\n    const output = {\n        frontend_build_output: {\n            [processName]: {\n                error: err\n            }\n        }\n    }\n    fs.mkdirSync(path.join(process.cwd(), 'exported_files'), {recursive: true});\n    fs.writeFileSync('output.json', JSON.stringify(output));\n}\n\nfunction formatSuccess() {\n    process.chdir(originalWd);\n    const output = {\n        frontend_build_output: {\n            [processName]: {\n                success: true\n            }\n        }\n    }\n    fs.writeFileSync('output.json', JSON.stringify(output));\n}\n\nfunction execSyncWrapper(cmd) {\n    const execOpt = {\n        stdio: 'inherit',\n        env: {\n            ...process.env,\n            ...givenCmdEnv,\n        },\n    };\n    console.log('[', cmd, ']');\n    return execSync(cmd, execOpt);\n}\n\nasync function wait(t) {\n    return new Promise(resolve => setTimeout(resolve, t))\n}\n\nasync function main() {\n    console.log('app directory: ' + givenBuildDir);\n    process.chdir(givenBuildDir);\n\n    let dirsPreBuild = fs.readdirSync('.').filter(f => fs.statSync(f).isDirectory())\n    let changedFiles = {}\n    if(!givenBuildOutputDir) {\n        let watchingDirs = {}\n        const watchHandler = (baseDir) => (eventType, filename) => {\n            filename = path.join(baseDir, filename)\n            let dir;\n            try {\n                if(fs.statSync(filename).isDirectory()) {\n                    dir = filename;\n                } else {\n                    dir = path.dirname(filename);\n                }\n            }catch (e){\n                return;\n            }\n            \n            if (dir in ignoredDirs || Object.keys(ignoredDirs).some(d => dir.startsWith(d))) {\n                return;\n            }\n            if(!(dir in watchingDirs)) {\n                watchingDirs[dir] = true;\n                fs.watch(dir, {persistent: false}, watchHandler(dir));\n            }\n\n            dir = dir.split(path.sep)[0];\n            if(dir === '.') {\n                return;\n            }\n            if (!(dir in changedFiles)) {\n                changedFiles[dir] = 1\n            }\n            changedFiles[dir] += 1;\n        }\n        fs.watch('.', {persistent: false}, watchHandler('.'));\n        dirsPreBuild.forEach(d => fs.watch(d, {persistent: false}, watchHandler(d)));\n    }\n\n    execSyncWrapper(givenBuildCmd);\n\n    let buildOutputDir = givenBuildOutputDir;\n    if(!givenBuildOutputDir) {\n        //give time for the watcher to catch up\n        await wait(5000)\n        if (Object.keys(changedFiles).length === 0) {\n            let dirsPostBuild = fs.readdirSync('.').filter(f => fs.statSync(f).isDirectory())\n            let hash = {}\n            dirsPreBuild.forEach(d => hash[d] = true)\n            let dirs = dirsPostBuild.filter(d => !hash[d])\n            if (dirs.length === 0) {\n                formatError('no_build_output_dir')\n                return\n            }\n            buildOutputDir = dirs[0]\n        } else {\n            let dirs = Object.keys(changedFiles)\n                .sort((a, b) => changedFiles[b] - changedFiles[a])\n            buildOutputDir = dirs[0]\n        }\n    }\n\n    console.log('Build finished in', buildOutputDir);\n    formatSuccess()\n    console.log('moving', path.join(originalWd, givenBuildDir, buildOutputDir), 'to', process.cwd() + '/exported_files')\n    const fullPathBuildOutputDir = path.join(originalWd, givenBuildDir, buildOutputDir)\n    try {\n        fs.renameSync(fullPathBuildOutputDir, 'exported_files')\n    }catch (err){\n        //this error is when you try to move a file across file systems\n        //sometimes you get this because of how builkit mounts file systems\n        if (err.code !== 'EXDEV') {\n            throw err;\n        }\n        console.log('failed to rename, moving with mv')\n        execSyncWrapper(`mv ${fullPathBuildOutputDir} exported_files`)\n    }\n    console.log('done moving')\n}\n\nmain();";

  // anyfront-lib/lib.ts
  function findFilesInSubdirs(dir, fileName, ignoreDirs) {
    if (!ignoreDirs) {
      ignoreDirs = {};
    }
    const files = os.file.listDir(dir);
    let found = [];
    files.forEach((file) => {
      const filePath = os.path.join(dir, file);
      const statRes = statFile(filePath);
      if (isFailure(statRes)) {
        return;
      }
      if (statRes.result.isDir) {
        if (file in ignoreDirs) {
          return;
        }
        found = found.concat(findFilesInSubdirs(filePath, fileName));
      } else if (file === fileName) {
        found.push(filePath);
      }
    });
    return found;
  }

  // frontend_build/frontend_build.ts
  var container = readDatabagContainer();
  var outputDir = barbeOutputDir();
  onlyRunForLifecycleSteps(["generate"]);
  var ignoredDirs = {
    ".svelte-kit": true,
    "node_modules": true,
    ".docusaurus": true
  };
  var packageJsonIncludeList = [
    "react",
    "svelte",
    "solid-js",
    '"vue"',
    "preact",
    '"lit"',
    "@angular"
  ];
  function filterFilesContaining(files, substrs) {
    return files.filter((file) => {
      const content = os.file.readFile(file);
      return substrs.some((s) => content.includes(s));
    });
  }
  function frontendBuildIterator(bag) {
    if (!bag.Value) {
      return [];
    }
    const [block, _] = applyDefaults(container, bag.Value);
    const dotEnvironment = compileBlockParam(block, "environment");
    const envObj = Object.entries(dotEnvironment).map(([k, v]) => ({ [k]: asStr(v) })).reduce((acc, next) => Object.assign(acc, next), {});
    const fileOverrides = asVal(block.file_overrides || asSyntax({}));
    let buildDir = asStr(block.build_dir || "");
    if (!buildDir) {
      const foundApps = filterFilesContaining(findFilesInSubdirs(".", "package.json", ignoredDirs), packageJsonIncludeList);
      if (foundApps.length === 0) {
        throwStatement(`no package.json found in current or sub directories, please provide a 'build_dir' on frontend_build.${bag.Name}`);
      }
      if (foundApps.length > 1) {
        throwStatement(`multiple package.json found in current or sub directories, please provide a 'build_dir' on frontend_build.${bag.Name}`);
      }
      buildDir = dirname(foundApps[0]);
    }
    const yarnLockStat = statFile(`${buildDir}/yarn.lock`);
    const usingYarn = isSuccess(yarnLockStat) && !yarnLockStat.result.isDir;
    let installCmd = asStr(block.install_cmd || "");
    if (!installCmd) {
      installCmd = usingYarn ? "yarn install" : "npm install";
    }
    let buildCmd = asStr(block.build_cmd || "");
    if (!buildCmd) {
      buildCmd = usingYarn ? "yarn build" : "npm run build";
    }
    const buildScript = applyMixins(build_script_template_default, {
      name: bag.Name,
      build_dir: buildDir,
      build_output_dir: asStr(block.build_output_dir || ""),
      build_cmd: buildCmd,
      cmd_env: JSON.stringify(envObj),
      ignoredDirs: JSON.stringify(ignoredDirs)
    });
    return [{
      Type: "buildkit_run_in_container",
      Name: `frontend_build_${bag.Name}`,
      Value: {
        no_cache: true,
        display_name: `Frontend build - ${bag.Name}`,
        excludes: Object.keys(ignoredDirs).concat(outputDir),
        exported_files: {
          "exported_files": `frontend_build_${bag.Name}`,
          "output.json": `frontend_build_${bag.Name}_output.json`
        },
        read_back: `frontend_build_${bag.Name}_output.json`,
        input_files: {
          "__barbe_build_script.cjs": buildScript,
          ...fileOverrides
        },
        dockerfile: `
                FROM node:${asStr(block.nodejs_version || "18")}${asStr(block.nodejs_version_tag || "-slim")}

                COPY --from=src . /src
                WORKDIR /src

                ${Object.keys(fileOverrides).map((k) => `COPY --from=src ${k} ${k}`).join("\n")}
                RUN ${installCmd}
                RUN node __barbe_build_script.cjs`
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
        case "no_build_output_dir":
          throwStatement(`couldn't figure out where the build files were generated, please provide a 'build_output_dir' on frontend_build block '${bag.Name}' or delete any existing build output directory`);
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
