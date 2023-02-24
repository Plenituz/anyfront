import { applyDefaults, compileBlockParam, applyMixins } from '../../../barbe-serverless/src/barbe-sls-lib/lib';
import { readDatabagContainer, Databag, SugarCoatedDatabag, asVal, asStr, exportDatabags, iterateBlocks, onlyRunForLifecycleSteps, applyTransformers, barbeOutputDir, throwStatement, dirname, statFile, asSyntax } from '../../../barbe-serverless/src/barbe-std/utils';
import { FRONTEND_BUILD } from "../anyfront-lib/consts";
import build_script from "./build_script.template.js";
import { findFilesInSubdirs } from '../anyfront-lib/lib';
import { isSuccess } from '../../../barbe-serverless/src/barbe-std/rpc';

const container = readDatabagContainer()
const outputDir = barbeOutputDir()
onlyRunForLifecycleSteps(['generate'])

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

function filterFilesContaining(files: string[], substrs: string[]) {
    return files.filter(file => {
        const content = os.file.readFile(file);
        return substrs.some(s => content.includes(s));
    })
}

function frontendBuildIterator(bag: Databag): (Databag | SugarCoatedDatabag)[] {
    if(!bag.Value) {
        return []
    }
    const [block, _] = applyDefaults(container, bag.Value)
    const dotEnvironment = compileBlockParam(block, 'environment')
    const envObj = Object.entries(dotEnvironment)
        .map(([k, v]) => ({[k]: asStr(v!)}))
        .reduce((acc, next) => Object.assign(acc, next), {})
    const fileOverrides = asVal(block.file_overrides || asSyntax({}))

    //TODO deduplicate builds with same build_dir instead of letting the caller do it

    let buildDir = asStr(block.build_dir || '')
    if(!buildDir) {
        const foundApps = filterFilesContaining(findFilesInSubdirs('.', 'package.json', ignoredDirs), packageJsonIncludeList)
        if(foundApps.length === 0) {
            throwStatement(`no package.json found in current or sub directories, please provide a 'build_dir' on frontend_build.${bag.Name}`)
        }
        if(foundApps.length > 1) {
            throwStatement(`multiple package.json found in current or sub directories, please provide a 'build_dir' on frontend_build.${bag.Name}`)
        }
        buildDir = dirname(foundApps[0])
    }
    
    //TODO support for other package managers (pnpm, bun, etc)
    const yarnLockStat = statFile(`${buildDir}/yarn.lock`)
    const usingYarn = isSuccess(yarnLockStat) && !yarnLockStat.result.isDir

    let installCmd = asStr(block.install_cmd || '')
    if(!installCmd) {
        installCmd = usingYarn ? 'yarn install' : 'npm install'
    }
    let buildCmd = asStr(block.build_cmd || '')
    if(!buildCmd) {
        buildCmd = usingYarn ? 'yarn build' : 'npm run build'
    }

    const buildScript = applyMixins(build_script, {
        name: bag.Name,
        build_output_dir: asStr(block.build_output_dir || ''),
        build_cmd: buildCmd,
        cmd_env: JSON.stringify(envObj),
        ignored_dirs: JSON.stringify(ignoredDirs),
    })
    
    return [{
        Type: 'buildkit_run_in_container',
        Name: `frontend_build_${bag.Name}`,
        Value: {
            no_cache: true,
            display_name: `Frontend build - ${bag.Name}`,
            excludes: Object.keys(ignoredDirs).concat(outputDir),
            exported_files: {
                'exported_files': `frontend_build_${bag.Name}`,
                'output.json': `frontend_build_${bag.Name}_output.json`
            },
            read_back: `frontend_build_${bag.Name}_output.json`,
            input_files: {
                '__barbe_build_script.cjs': buildScript,
                ...fileOverrides
            },
            dockerfile: `
                FROM node:${asStr(block.nodejs_version || '18')}${asStr(block.nodejs_version_tag || '-slim')}

                COPY --from=src ./${buildDir} /src
                WORKDIR /src

                ${Object.keys(fileOverrides).map((k) => `COPY --from=src ${k} ${k}`).join('\n')}
                COPY --from=src __barbe_build_script.cjs __barbe_build_script.cjs
                RUN ${installCmd}
                RUN node __barbe_build_script.cjs`
        }
    }]
}

const results = applyTransformers(iterateBlocks(container, FRONTEND_BUILD, frontendBuildIterator).flat())
const frontendBuildResultIterator = (bag: Databag): (Databag | SugarCoatedDatabag)[] => {
    if(!bag.Value) {
        return []
    }
    const outputResult = results?.frontend_build_output?.[bag.Name]?.[0]?.Value
    if(!outputResult) {
        return []
    }
    const output = asVal(outputResult!)
    if(output.error) {
        const errStr = asStr(output.error)
        switch(errStr) {
            case 'no_build_output_dir':
                throwStatement(`couldn't figure out where the build files were generated, please provide a 'build_output_dir' on frontend_build block '${bag.Name}' or delete any existing build output directory`)
            default:
                throw new Error(`unknown error: ${errStr}`)
        }
    }
    return [{
        Type: 'frontend_build_output',
        Name: bag.Name,
        Value: `${outputDir}/frontend_build_${bag.Name}`
    }]
}

exportDatabags(iterateBlocks(container, FRONTEND_BUILD, frontendBuildResultIterator).flat())

