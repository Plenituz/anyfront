import { applyDefaults, compileBlockParam, applyMixins } from '../../../barbe-serverless/src/barbe-sls-lib/lib';
import { readDatabagContainer, Databag, SugarCoatedDatabag, asVal, asStr, exportDatabags, iterateBlocks, onlyRunForLifecycleSteps, applyTransformers, DatabagContainer, barbeOutputDir } from '../../../barbe-serverless/src/barbe-std/utils';
import { FRONTEND_BUILD } from "../anyfront-lib/consts";
import build_script from "./build_script.template.js";

const container = readDatabagContainer()
const outputDir = barbeOutputDir()
onlyRunForLifecycleSteps(['generate'])

function frontendBuildIterator(bag: Databag): (Databag | SugarCoatedDatabag)[] {
    if(!bag.Value) {
        return []
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value)
    const dotEnvironment = compileBlockParam(block, 'environment')
    const buildScript = applyMixins(build_script, {
        name: bag.Name,
        build_dir: asStr(block.build_dir || ''),
        build_output_dir: asStr(block.build_output_dir || ''),
        install_cmd: asStr(block.install_cmd || ''),
        build_cmd: asStr(block.build_cmd || ''),
        cmd_env: Object.entries(dotEnvironment).map(([k, v]) => `"${k}": ${JSON.stringify(asStr(v!))}`).join('\n'),
    })
    
    return [{
        Type: 'buildkit_run_in_container',
        Name: `frontend_build_${bag.Name}`,
        Value: {
            no_cache: true,
            display_name: `Frontend build - ${bag.Name}`,
            excludes: [
                '**/node_modules',
                'node_modules',
            ],
            exported_files_location: 'src/exported_files.json',
            read_back: `frontend_build_${bag.Name}_output.json`,
            input_files: {
                '__barbe_build_script.cjs': buildScript
            },
            dockerfile: `
                FROM node:${asStr(block.nodejs_version || '18')}${asStr(block.nodejs_version_tag || '-slim')}

                COPY --from=src . /src
                WORKDIR /src

                RUN node __barbe_build_script.cjs
                `
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
        throw new Error(`No output found for frontend build '${bag.Name}'`)
    }
    const output = asVal(outputResult)
    if(output.error) {
        const errStr = asStr(output.error)
        switch(errStr) {
            case 'no_package_json_found':
                throw new Error(`no package.json found in current or sub directories, please provide a 'build_dir' on frontend_build block '${bag.Name}'`)
            case 'multiple_package_json_found':
                throw new Error(`multiple package.json found in current or sub directories, please provide a 'build_dir' on frontend_build block '${bag.Name}'`)
            case 'no_build_changed_files':
                throw new Error(`couldn't figure out where the build files were generated, please provide a 'build_output_dir' on frontend_build block '${bag.Name}' or delete any existing build output directory`)
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

