local barbe = std.extVar("barbe");
local state = std.extVar("state");
local container = std.extVar("container");
local globalDefaults = barbe.compileDefaults(container, "");

barbe.pipelines([{
    generate: [
        function(container) barbe.databags([
            barbe.iterateBlocks(container, "frontend_build", function(bag)
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                local dotEnvironment = barbe.asVal(barbe.mergeTokens(std.get(fullBlock, "environment", barbe.asSyntax([])).ArrayConst));
                local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                local buildScript = |||
                    const fs = require('fs');
                    const path = require('path');
                    const { execSync } = require('child_process');
                    const processName = '%(name)s'
                    const givenBuildDir = '%(build_dir)s'
                    const givenBuildOutputDir = '%(build_output_dir)s'
                    const givenInstallCmd = '%(install_cmd)s'
                    const givenBuildCmd = '%(build_cmd)s'
                    const originalWd = process.cwd();
                    const givenCmdEnv = {
                        %(cmd_env)s
                    }
                    //TODO make this configurable
                    const ignoredDirs = {
                        '.svelte-kit': true,
                        'node_modules': true,
                    }

                    function find(dir, fileName) {
                        const files = fs.readdirSync(dir);
                        let found = [];
                        files.forEach(file => {
                            const filePath = path.join(dir, file);
                            if (fs.statSync(filePath).isDirectory()) {
                                if (file === 'node_modules') {
                                    return;
                                }
                                found = found.concat(find(filePath, fileName));
                            } else if (file === fileName) {
                                found.push(filePath);
                            }
                        });
                        return found;
                    }

                    function filter(files, strings) {
                        return files.filter(file => {
                            const content = fs.readFileSync(file, 'utf-8');
                            return strings.some(s => content.includes(s));
                        })
                    }

                    function formatError(err) {
                        process.chdir(originalWd);
                        const output = {
                            frontend_build_output: {
                                [processName]: {
                                    error: err
                                }
                            }
                        }
                        fs.writeFileSync('output.json', JSON.stringify(output));
                        fs.writeFileSync('exported_files.json', JSON.stringify({
                            [path.join(originalWd, 'output.json')]: 'frontend_build_' + processName + '_output.json',
                        }));
                    }

                    function formatSuccess(obj) {
                        process.chdir(originalWd);
                        const output = {
                            frontend_build_output: {
                                [processName]: {
                                    success: obj
                                }
                            }
                        }
                        fs.writeFileSync('output.json', JSON.stringify(output));
                    }

                    function execSyncWrapper(cmd) {
                        const execOpt = {
                            stdio: 'inherit',
                            env: {
                                ...process.env,
                                ...givenCmdEnv,
                            },
                        };
                        console.log('[', cmd, ']');
                        return execSync(cmd, execOpt);
                    }

                    async function wait(t) {
                        return new Promise(resolve => setTimeout(resolve, t))
                    }

                    async function main() {
                        let reactAppDir = givenBuildDir;
                        if(!reactAppDir) {
                            const foundReacts = filter(find('.', 'package.json'), ['react', 'svelte']);
                            if (foundReacts.length === 0) {
                                formatError('no_package_json_found')
                                return
                            }
                            if (foundReacts.length > 1) {
                                formatError('multiple_package_json_found')
                                return
                            }
                            reactAppDir = path.dirname(foundReacts[0]);
                        }

                        console.log('React app directory: ' + reactAppDir);
                        process.chdir(reactAppDir);

                        const usingYarn = fs.existsSync('yarn.lock')
                        if (givenInstallCmd) {
                            execSyncWrapper(givenInstallCmd);
                        } else if (usingYarn) {
                            execSyncWrapper('yarn install');
                        } else {
                            execSyncWrapper('npm install');
                        }


                        let dirsPreBuild = fs.readdirSync('.').filter(f => fs.statSync(f).isDirectory())
                        let changedFiles = {}
                        if(!givenBuildOutputDir) {
                            let watchingDirs = {}
                            const watchHandler = (baseDir) => (eventType, filename) => {
                                filename = path.join(baseDir, filename)
                                let dir;
                                try {
                                    if(fs.statSync(filename).isDirectory()) {
                                        dir = filename;
                                    } else {
                                        dir = path.dirname(filename);
                                    }
                                }catch (e){
                                    return;
                                }
                                
                                if (dir in ignoredDirs || Object.keys(ignoredDirs).some(d => dir.startsWith(d))) {
                                    return;
                                }
                                if(!(dir in watchingDirs)) {
                                    watchingDirs[dir] = true;
                                    fs.watch(dir, {persistent: false}, watchHandler(dir));
                                }

                                dir = dir.split(path.sep)[0];
                                if(dir === '.') {
                                    return;
                                }
                                if (!(dir in changedFiles)) {
                                    changedFiles[dir] = 1
                                }
                                changedFiles[dir] += 1;
                            }
                            fs.watch('.', {persistent: false}, watchHandler('.'));
                            dirsPreBuild.forEach(d => fs.watch(d, {persistent: false}, watchHandler(d)));
                        }
                        
                        if (givenBuildCmd) {
                            execSyncWrapper(givenBuildCmd);
                        } else if (usingYarn) {
                            execSyncWrapper('yarn build');
                        } else {
                            execSyncWrapper('npm run build');
                        }

                        let buildOutputDir = givenBuildOutputDir;
                        if(!givenBuildOutputDir) {
                            await wait(5000)
                            if (Object.keys(changedFiles).length === 0) {
                                let dirsPostBuild = fs.readdirSync('.').filter(f => fs.statSync(f).isDirectory())
                                let hash = {}
                                dirsPreBuild.forEach(d => hash[d] = true)
                                let dirs = dirsPostBuild.filter(d => !hash[d])
                                if (dirs.length === 0) {
                                    formatError('no_build_output_dir')
                                    return
                                }
                                buildOutputDir = dirs[0]
                            } else {
                                let dirs = Object.keys(changedFiles)
                                    .sort((a, b) => changedFiles[b] - changedFiles[a])
                                buildOutputDir = dirs[0]
                            }
                        }

                        console.log('Build finished in', buildOutputDir);
                        formatSuccess({
                            build_output_dir: path.join(reactAppDir, buildOutputDir)
                        })
                        console.log('writing', process.cwd() + '/exported_files.json')
                        fs.writeFileSync('exported_files.json', JSON.stringify({
                            [path.join(originalWd, 'output.json')]: 'frontend_build_' + processName + '_output.json',
                            [path.join(originalWd, reactAppDir, buildOutputDir)]: 'frontend_build_' + processName + '/'
                        }));
                    }

                    main();
                ||| % {
                    name: bag.Name,
                    build_dir: barbe.asStr(std.get(fullBlock, "build_dir", "")),
                    build_output_dir: barbe.asStr(std.get(fullBlock, "build_output_dir", "")),
                    install_cmd: barbe.asStr(std.get(fullBlock, "install_cmd", "")),
                    build_cmd: barbe.asStr(std.get(fullBlock, "build_cmd", "")),
                    cmd_env: std.join("\n", [
                        "\"%(key)s\": %(value)s," % {
                            key: key,
                            value: std.escapeStringJson(barbe.asStr(dotEnvironment[key]))
                        }
                        for key in std.objectFields(dotEnvironment)
                    ])
                };
                [
                    {
                        Type: "buildkit_run_in_container",
                        Name: "frontend_build_" + bag.Name,
                        Value: {
                            no_cache: true,
                            display_name: "Frontend build - " + bag.Name,
                            excludes: [
                                "**/node_modules",
                                "node_modules",
                            ],
                            exported_files_location: "src/exported_files.json",
                            read_back: "frontend_build_" + bag.Name + "_output.json",
                            dockerfile: |||
                                FROM node:%(node_version)s

                                COPY --from=src . /src
                                WORKDIR /src

                                RUN printf %(build_script)s > __barbe_build_script.cjs
                                RUN node __barbe_build_script.cjs
                            ||| % {
                                node_version: barbe.asStr(std.get(fullBlock, "nodejs_version", "18")) + "-slim",
                                build_script: std.escapeStringJson(buildScript),
                            },
                        }
                    }
                ]
            )
        ]),
        function(container) barbe.databags([
            barbe.iterateBlocks(container, "frontend_build", function(bag)
                local result = barbe.asVal(container.frontend_build_output[bag.Name][0].Value);
                if std.objectHas(result, "error") then
                    local errStr = barbe.asStr(result["error"]);
                    if errStr == "no_package_json_found" then
                        error "<showuser>no package.json found in current or sub directories, please provide a 'build_dir'</showuser>"
                    else if errStr == "multiple_package_json_found" then
                        error "<showuser>multiple package.json found in current or sub directories, please provide a 'build_dir'</showuser>"
                    else if errStr == "no_build_changed_files" then
                        error "<showuser>couldn't figure out where the build files were generated, please provide a 'build_output_dir' or delete any existing build output directory</showuser>"
                    else
                        error "<showuser>unknown error: '" + errStr + "'</showuser>"
                else
                    {
                        Type: "frontend_build_output",
                        Name: bag.Name,
                        Value: std.extVar("barbe_output_dir") + "/frontend_build_" + bag.Name,
                    }
            )
        ])
    ]
}])