const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const processName = '{{name}}'
const givenBuildDir = '{{build_dir}}'
const givenBuildOutputDir = '{{build_output_dir}}'
const givenInstallCmd = '{{install_cmd}}'
const givenBuildCmd = '{{build_cmd}}'
const originalWd = process.cwd();
const givenCmdEnv = {
    {{cmd_env}}
}
//TODO make this configurable
const ignoredDirs = {
    '.svelte-kit': true,
    'node_modules': true,
    '.docusaurus': true,
}
const packageJsonIncludeList = [
    'react',
    'svelte',
    'solid-js',
    '"vue"',
    'preact',
    '"lit"',
    '@angular',
]

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
    fs.mkdirSync(path.join(process.cwd(), 'exported_files'), {recursive: true});
    fs.writeFileSync('output.json', JSON.stringify(output));
}

function formatSuccess() {
    process.chdir(originalWd);
    const output = {
        frontend_build_output: {
            [processName]: {
                success: true
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
        const foundReacts = filter(find('.', 'package.json'), packageJsonIncludeList);
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

    console.log('app directory: ' + reactAppDir);
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
        //give time for the watcher to catch up
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
    formatSuccess()
    console.log('moving', path.join(originalWd, reactAppDir, buildOutputDir), 'to', process.cwd() + '/exported_files')
    const fullPathBuildOutputDir = path.join(originalWd, reactAppDir, buildOutputDir)
    try {
        fs.renameSync(fullPathBuildOutputDir, 'exported_files')
    }catch (err){
        if (err.code !== 'EXDEV') {
            throw err;
        }
        console.log('failed to rename, moving with mv')
        execSyncWrapper(`mv ${fullPathBuildOutputDir} exported_files`)
    }
    console.log('done moving')
}

main();