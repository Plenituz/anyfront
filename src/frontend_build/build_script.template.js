const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const processName = '{{name}}'
const givenBuildOutputDir = '{{build_output_dir}}'
const givenBuildCmd = '{{build_cmd}}'
const givenCmdEnv = {{cmd_env}}
const ignoredDirs = {{ignored_dirs}}

function formatError(err) {
    const output = {
        frontend_build_output: {
            [processName]: {
                error: err
            }
        }
    }
    fs.mkdirSync('exported_files', {recursive: true});
    fs.writeFileSync('output.json', JSON.stringify(output));
}

function formatSuccess() {
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

    execSyncWrapper(givenBuildCmd);

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
    console.log('moving', buildOutputDir, 'to', 'exported_files')
    try {
        fs.renameSync(buildOutputDir, 'exported_files')
    }catch (err){
        //this error is when you try to move a file across file systems
        //sometimes you get this because of how builkit mounts file systems
        if (err.code !== 'EXDEV') {
            throw err;
        }
        console.log('failed to rename, moving with mv')
        execSyncWrapper(`mv ${buildOutputDir} exported_files`)
    }
    console.log('done moving')
}

main();