import { readDatabagContainer, barbeLifecycleStep, DatabagContainer, SyntaxToken, iterateBlocks, asStr, appendToTemplate, Databag, asBlock, SugarCoatedDatabag, exportDatabags, asSyntax, asVal, uniq, ImportComponentInput, importComponents, throwStatement, iterateAllBlocks, onlyRunForLifecycleSteps } from '../../barbe-serverless/src/barbe-std/utils';
import { applyDefaults, DatabagObjVal, compileBlockParam } from '../../barbe-serverless/src/barbe-sls-lib/lib';
import { STATIC_HOSTING, FRONTEND_BUILD_URL, GCP_CLOUDRUN_STATIC_HOSTING, AWS_CLOUDFRONT_STATIC_HOSTING, GCP_CLOUDRUN_STATIC_HOSTING_URL, AWS_CLOUDFRONT_STATIC_HOSTING_URL } from './anyfront-lib/consts';
import md5 from 'md5';
import { executePipelineGroup, pipeline, step, getHistoryItem, Pipeline } from './anyfront-lib/pipeline';

const container = readDatabagContainer()

type BlockIterator<T> = (bag: Databag, block: DatabagObjVal, namePrefix: SyntaxToken) => T
function iterateBlocksPerPlatform<T>(container: DatabagContainer, iteratorGcp: BlockIterator<T>, iteratorAws: BlockIterator<T>): T[] {
    return iterateBlocks(container, STATIC_HOSTING, (bag) => {
        const [block, namePrefix] = applyDefaults(container, bag.Value!)
        const platform = asStr(block.platform || 'aws')
        switch(platform) {
            case 'gcp':
                return iteratorGcp(bag, block, namePrefix)
            case 'aws':
                return iteratorAws(bag, block, namePrefix)
            default:
                throw new Error(`unknown platform for static_hosting.${bag.Name}: '${platform}'`)
        }
    })
}

function computeBagBuildHash(bag: Databag): string {
    const [block, _] = applyDefaults(container, bag.Value!)
    const dotBuild = compileBlockParam(block, 'build')
    const dotEnvironment = compileBlockParam(block, 'environment')
    return md5(`
        ${asVal(dotBuild.disabled || asSyntax(false))}
        ${asStr(dotBuild.nodejs_version || 'null')}
        ${asStr(dotBuild.build_dir || 'null')}
        ${asStr(dotBuild.build_output_dir || 'null')}
        ${asStr(dotBuild.install_cmd || 'null')}
        ${asStr(dotBuild.build_cmd || 'null')}
        ${Object.entries(dotEnvironment).map(([k, v]) => `${k}:${JSON.stringify(asStr(v!))}`).join(',')}
    `)
}

function autoCreateMultiplatformStateStore() {
    if(container.state_store) {
        return
    }

    let gcpCount = 0
    let awsCount = 0
    const gcpIterator = (bag: Databag, block: DatabagObjVal, namePrefix: SyntaxToken): SugarCoatedDatabag => {
        const dotGcpProject = compileBlockParam(block, 'google_cloud_project')
        gcpCount++
        return {
            Type: 'state_store',
            Name: '',
            Value: {
                name_prefix: [`${bag.Name}-`],
                gcs: asBlock([{
                    project_id: dotGcpProject.project_id || block.google_cloud_project_id || block.project_id
                }])
            }
        }
    }

    const awsIterator = (bag: Databag, block: DatabagObjVal, namePrefix: SyntaxToken): SugarCoatedDatabag => {
        awsCount++
        return {
            Type: 'state_store',
            Name: '',
            Value: {
                name_prefix: [`${bag.Name}-`],
                s3: asBlock([{}])
            }
        }
    }

    //if no state_store is declared, we'll create one based on which platform the user is using
    //this is to remove boilerplate code for people that use anyfront just to deploy their website
    const databags = iterateBlocksPerPlatform(container, gcpIterator, awsIterator)
    if(gcpCount > 1) {
        throw new Error('more than 1 static_hosting block with platform \'gcp\' detected without a state_store block declared, this would risk loosing your terraform/barbe state. To fix this you can explicitely declare a state_store block: `state_store { gcs { ... } }`. See https://github.com/Plenituz/barbe-serverless/blob/main/docs/references/state_store.md')
    }
    if(awsCount > 1) {
        throw new Error('more than 1 static_hosting block with platform \'aws\' detected without a state_store block declared, this would risk loosing your terraform/barbe state. To fix this you can explicitely declare a state_store block: `state_store { s3 { ... } }`. See https://github.com/Plenituz/barbe-serverless/blob/main/docs/references/state_store.md')
    }
    if(awsCount+gcpCount > 0) {
        throw new Error('more than 1 static_hosting block with platform \'aws\' and \'gcp\' detected without a state_store block declared, this would risk loosing your terraform/barbe state. To fix this you can explicitely declare a state_store block: `state_store { s3 { ... } }`. See https://github.com/Plenituz/barbe-serverless/blob/main/docs/references/state_store.md')
    }
    //exporting instead of using importComponents makes this an implicit dependency with the state_store component
    //meaning if the user doesnt have the state_store component in his manisfest, this will do nothing
    exportDatabags(databags)
}

function retrieveBuildOuputDirMap(): { [hash: string]: string } | undefined {
    if(barbeLifecycleStep() === 'generate') {
        const buildOutputDirs = getHistoryItem(buildPipeline.mostRecentInput?.history || [], 'builds_output')?.databags
        if(!buildOutputDirs?.static_hosting_build_dir_map?.['']?.[0]?.Value) {
            return undefined
        }
        return buildOutputDirs?.static_hosting_build_dir_map?.['']?.[0]?.Value as any as { [hash: string]: string }
    }

    const tmp = container.static_hosting_build_dir_map?.['']?.[0]?.Value
    if(!tmp) {
        return undefined
    }
    let buildOutputDirs = asVal(tmp)
    Object.keys(buildOutputDirs).forEach(key => buildOutputDirs[key] = asStr(buildOutputDirs[key]));
    return buildOutputDirs
}

function buildFrontendPipeline(): Pipeline {
    const uniqueBagAndHashes = uniq(
        iterateBlocks(container, STATIC_HOSTING, (bag) => ({ hash: computeBagBuildHash(bag), bag })),
        x => x.hash
    )
    let frontEndBuildReqs: SugarCoatedDatabag[] = []
    let buildOutputDirs: { [hash: string]: string } = {}

    for(const { hash, bag } of uniqueBagAndHashes) {
        const [block, namePrefix] = applyDefaults(container, bag.Value!)
        const dotBuild = compileBlockParam(block, 'build')
        if(dotBuild.disabled && asVal(dotBuild.disabled)) {
            if(!dotBuild.build_output_dir) {
                throw new Error(`static_hosting.${bag.Name}.build.build_output_dir is required when static_hosting.${bag.Name}.build.disabled is true. The files in that directory will be uploaded to the static hosting provider`)
            }
            buildOutputDirs[hash] = asStr(dotBuild.build_output_dir)
            continue
        }
        frontEndBuildReqs.push({
            Type: 'frontend_build',
            Name: hash,
            Value: {
                nodejs_version: dotBuild.nodejs_version || '18',
                build_dir: dotBuild.build_dir,
                build_output_dir: dotBuild.build_output_dir,
                install_cmd: dotBuild.install_cmd,
                build_cmd: dotBuild.build_cmd,
                environment: dotBuild.environment,
            }
        })
    }
    if(frontEndBuildReqs.length === 0) {
        return pipeline([])
    }
    return pipeline([
        step(() => {
            return {
                imports: [{
                    url: FRONTEND_BUILD_URL,
                    input: frontEndBuildReqs
                }]
            }
        }, { name: 'builds', lifecycleSteps: ['generate'] }),
        step((input) => {
            const frontendBuildResults = input.previousStepResult
            iterateBlocks(frontendBuildResults, 'frontend_build_output', (bag) => buildOutputDirs[bag.Name] = asStr(bag.Value!))
            const databags = [{
                Type: 'static_hosting_build_dir_map',
                Name: '',
                Value: buildOutputDirs
            }]
            return { databags }
        }, { name: 'builds_output', lifecycleSteps: ['generate'] })
    ], { name: 'static_hosting_frontend_builds' })
}

function staticHostingGcp(bag: Databag, block: DatabagObjVal, namePrefix: SyntaxToken): Pipeline {
    let pipe = pipeline([], { name: `static_hosting[gcp].${bag.Name}` })
    pipe.runAfter(buildPipeline)

    pipe.pushWithParams({ name: 'import_gcp' }, () => {
        const buildOutputDirs = retrieveBuildOuputDirMap()
        if(!buildOutputDirs) {
            return
        }
    
        const hash = computeBagBuildHash(bag)
        const buildOutputDir = buildOutputDirs[hash]
        if(!buildOutputDir) {
            return
        }
        const dotGcpProject = compileBlockParam(block, 'google_cloud_project')
        const dotDomain = compileBlockParam(block, 'domain')
    
        const gcpStaticHosting = {
            Type: GCP_CLOUDRUN_STATIC_HOSTING,
            Name: bag.Name,
            Value: {
                name_prefix: [`${bag.Name}-`],
                root_object: block.root_object,
                region: block.region || 'us-central1',
                project_id: dotGcpProject.project_id || block.google_cloud_project_id || block.project_id,
                project_name: dotGcpProject.project_name || bag.Name,
                organization_id: dotGcpProject.organization_id,
                organization_domain: dotGcpProject.organization_domain,
                billing_account_name: dotGcpProject.billing_account_name,
                billing_account_id: dotGcpProject.billing_account_id,
                //gcp requires the end dot
                domain: dotDomain.name ? appendToTemplate(dotDomain.name, ['.']) : undefined,
                dns_zone: dotDomain.zone,
                dns_zone_project: dotDomain.zone_project,
                build_dir: buildOutputDir,
            }
        }
        const imports = [{
            url: GCP_CLOUDRUN_STATIC_HOSTING_URL,
            copyFromContainer: ["default", "global_default", "cr_[terraform]"],
            input: [gcpStaticHosting]
        }]
        return { imports }
    })
    pipe.pushWithParams({ name: 'export_results' }, (input) => {
        return {
            databags: iterateAllBlocks(input.previousStepResult, d => d)
        }
    })
    return pipe
}

function staticHostingAws(bag: Databag, block: DatabagObjVal, namePrefix: SyntaxToken): Pipeline {
    let pipe = pipeline([], { name: `static_hosting[aws].${bag.Name}` })
    pipe.runAfter(buildPipeline)

    pipe.pushWithParams({ name: 'import_aws' }, () => {
        const buildOutputDirs = retrieveBuildOuputDirMap()
        if(!buildOutputDirs) {
            return
        }
    
        const hash = computeBagBuildHash(bag)
        const buildOutputDir = buildOutputDirs[hash]
        if(!buildOutputDir) {
            return
        }
        const dotDomain = compileBlockParam(block, 'domain')
    
        const awsStaticHosting = {
            Type: AWS_CLOUDFRONT_STATIC_HOSTING,
            Name: bag.Name,
            Value: {
                name_prefix: [`${bag.Name}-`],
                root_object: block.root_object,
                region: block.region || os.getenv('AWS_REGION') || 'us-east-1',
                build_dir: buildOutputDir,
                domain: asBlock([{
                    certificate_domain_to_create: dotDomain.name,
                    ...dotDomain
                }]),
            }
        }
        const imports = [{
            url: AWS_CLOUDFRONT_STATIC_HOSTING_URL,
            copyFromContainer: ["default", "global_default", "cr_[terraform]"],
            input: [awsStaticHosting]
        }]
        return { imports }
    })
    pipe.pushWithParams({ name: 'export_results' }, (input) => {
        return {
            databags: iterateAllBlocks(input.previousStepResult, d => d)
        }
    })
    return pipe
}

if(barbeLifecycleStep() === 'pre_generate') {
    autoCreateMultiplatformStateStore()
}

const buildPipeline = buildFrontendPipeline()
let pipes: Pipeline[] = [
    buildPipeline,
    ...iterateBlocksPerPlatform(container, staticHostingGcp, staticHostingAws)
]

let awsCount = 0
let gcpCount = 0
iterateBlocksPerPlatform(container, () => gcpCount++, () => awsCount++)
//if container['cr_[terraform]'] but not static_hosting aws or no static_hosting gcp 
//run the component empty to trigger the destroy missing mecanism
if(container['cr_[terraform]'] && gcpCount === 0) {
    pipes.push(pipeline([
        step(() => ({
            imports: [{
                url: GCP_CLOUDRUN_STATIC_HOSTING_URL,
                copyFromContainer: ["default", "global_default", "cr_[terraform]"],
                input: []
            }]
        }))
    ]))
}
if(container['cr_[terraform]'] && awsCount === 0) {
    pipes.push(pipeline([
        step(() => ({
            imports: [{
                url: AWS_CLOUDFRONT_STATIC_HOSTING_URL,
                copyFromContainer: ["default", "global_default", "cr_[terraform]"],
                input: []
            }]
        }))
    ]))
}
executePipelineGroup(container, pipes)