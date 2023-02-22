import { readDatabagContainer, barbeLifecycleStep, DatabagContainer, SyntaxToken, iterateBlocks, asStr, appendToTemplate, Databag, asBlock, SugarCoatedDatabag, exportDatabags, asSyntax, asVal, uniq, ImportComponentInput, importComponents } from '../../barbe-serverless/src/barbe-std/utils';
import { applyDefaults, DatabagObjVal, compileBlockParam } from '../../barbe-serverless/src/barbe-sls-lib/lib';
import { STATIC_HOSTING, FRONTEND_BUILD_URL, GCP_CLOUDRUN_STATIC_HOSTING, AWS_CLOUDFRONT_STATIC_HOSTING, GCP_CLOUDRUN_STATIC_HOSTING_URL, AWS_CLOUDFRONT_STATIC_HOSTING_URL } from './anyfront-lib/consts';
import md5 from 'md5';

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

function makeSubDatabags(container: DatabagContainer, buildOutputDirs: {[hash: string]: string}): {awsStaticHostings: SugarCoatedDatabag[], gcpStaticHostings: SugarCoatedDatabag[]} {
    let gcpStaticHostings: SugarCoatedDatabag[] = []
    let awsStaticHostings: SugarCoatedDatabag[] = []
    const gcpIterator = (bag: Databag, block: DatabagObjVal, namePrefix: SyntaxToken): void => {
        const hash = computeBagBuildHash(bag)
        const buildOutputDir = buildOutputDirs[hash]
        if(!buildOutputDir && barbeLifecycleStep() !== 'destroy') {
            throw new Error(`static_hosting.${bag.Name} has no build output dir, this is a bug, please report it`)
        }
        const dotGcpProject = compileBlockParam(block, 'google_cloud_project')
        const dotDomain = compileBlockParam(block, 'domain')

        gcpStaticHostings.push({
            Type: GCP_CLOUDRUN_STATIC_HOSTING,
            Name: bag.Name,
            Value: {
                name_prefix: [`${bag.Name}-`],
                root_object: block.root_object,
                region: block.region || 'us-central1',
                project_id: dotGcpProject.project_id || block.google_cloud_project_id,
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
        })
    }
    const awsIterator = (bag: Databag, block: DatabagObjVal, namePrefix: SyntaxToken): void => {
        const hash = computeBagBuildHash(bag)
        const buildOutputDir = buildOutputDirs[hash]
        if(!buildOutputDir && barbeLifecycleStep() !== 'destroy') {
            throw new Error(`static_hosting.${bag.Name} has no build output dir, this is a bug, please report it`)
        }
        const dotDomain = compileBlockParam(block, 'domain')

        awsStaticHostings.push({
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
        })
    }
    iterateBlocksPerPlatform(container, gcpIterator, awsIterator)
    return {gcpStaticHostings, awsStaticHostings}
}

function makeSubImports(container: DatabagContainer, buildOutputDirs: {[hash: string]: string}): ImportComponentInput[] {
    const { gcpStaticHostings, awsStaticHostings } = makeSubDatabags(container, buildOutputDirs)
    let imports: ImportComponentInput[] = []
    if(gcpStaticHostings.length > 0) {
        imports.push({
            name: `static_hosting_gcp_${barbeLifecycleStep()}`,
            url: GCP_CLOUDRUN_STATIC_HOSTING_URL,
            copyFromContainer: ["default", "global_default", "cr_[terraform]"],
            input: gcpStaticHostings
        })
    }
    if(awsStaticHostings.length > 0) {
        imports.push({
            name: `static_hosting_aws_${barbeLifecycleStep()}`,
            url: AWS_CLOUDFRONT_STATIC_HOSTING_URL,
            copyFromContainer: ["default", "global_default", "cr_[terraform]"],
            input: awsStaticHostings
        })
    }
    return imports
}

function preGenerate() {
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
                    project_id: dotGcpProject.project_id || block.google_cloud_project_id
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
    //exporting instead of using importComponents makes this an implicit dependency with the state_store component
    //meaning if the user doesnt have the state_store component in his manisfest, this will do nothing
    exportDatabags(databags)
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

function generate() {
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
        return
    }
    const frontendBuildResults = importComponents(container, [{
        name: 'static_hosting_generate',
        url: FRONTEND_BUILD_URL,
        input: frontEndBuildReqs
    }])
    iterateBlocks(frontendBuildResults, 'frontend_build_output', (bag) => buildOutputDirs[bag.Name] = asStr(bag.Value!))
    if(Object.keys(buildOutputDirs).length === 0) {
        return
    }

    const imports = makeSubImports(container, buildOutputDirs)
    if(imports.length > 0) {
        exportDatabags(importComponents(container, imports))
    }
    exportDatabags([{
        Type: 'static_hosting_build_dir_map',
        Name: '',
        Value: buildOutputDirs
    }])
}

function relayToSubComponents() {
    const tmp = container.static_hosting_build_dir_map?.['']?.[0]?.Value
    if(!tmp) {
        return
    }
    let buildOutputDirs = asVal(tmp)
    Object.keys(buildOutputDirs).forEach(key => buildOutputDirs[key] = asStr(buildOutputDirs[key]));

    const imports = makeSubImports(container, buildOutputDirs)
    if(imports.length > 0) {
        importComponents(container, imports)
    }
}

switch(barbeLifecycleStep()) {
    case 'pre_generate':
        preGenerate()
        break
    case 'generate':
    case 'post_generate':
        generate()
        break
    case 'apply':
    case 'destroy':
        relayToSubComponents()
        break
}