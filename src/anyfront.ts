import { readDatabagContainer, statFile, barbeOutputDir, iterateBlocks, asStr, Databag, SyntaxToken, exportDatabags, isSimpleTemplate, throwStatement, IS_VERBOSE } from '../../barbe-serverless/src/barbe-std/utils';
import * as _ from '../../barbe-serverless/src/barbe-std/spidermonkey-globals';
import { isFailure } from '../../barbe-serverless/src/barbe-std/rpc';
import { ANYFRONT, STATIC_HOSTING, STATIC_HOSTING_URL, AWS_NEXT_JS, AWS_NEXT_JS_URL, GCP_NEXT_JS_URL, GCP_NEXT_JS, AWS_SVELTEKIT, AWS_SVELTEKIT_URL } from './anyfront-lib/consts';
import { applyDefaults, DatabagObjVal, compileBlockParam } from '../../barbe-serverless/src/barbe-sls-lib/lib';
import { Pipeline, executePipelineGroup, Step, step, pipeline } from './anyfront-lib/pipeline';

const container = readDatabagContainer()

type SupportedPlatform = 'aws' | 'gcp'
const SupportedPlatforms: SupportedPlatform[] = ['aws', 'gcp']

type SupportedFramework = 'react-spa' | 
'next' |
'next-export' |
'vue-spa' |
'solidjs-spa' |
'solidstart' |
'svelte-spa' |
'sveltekit'
const SupportedFrameworks: SupportedFramework[] = [
    'react-spa',
    'next',
    'next-export',
    'vue-spa',
    'solidjs-spa',
    'solidstart',
    'svelte-spa',
    'sveltekit'
]

type CrawlResult = {
    location: string
    framework: SupportedFramework
}

function getPackageJsonAppType(packageJson: string): SupportedFramework | null {
    let packageJsonObj: any
    try {
        packageJsonObj = JSON.parse(packageJson)
    }catch(e) {
        console.log('error parsing package.json: ' + e)
        return null
    }
    if(packageJsonObj.dependencies?.['next'] || packageJsonObj.devDependencies?.['next']) {
        //this is voluntarily a very strict check which might lead to 
        //some static website being hosted as fully on ssr next.js, 
        //but that's better than the other way around
        if(packageJsonObj.scripts?.build?.includes('next export')) {
            return 'next-export'
        }
        return 'next'
    }
    //make sure 'react' is after 'next' because next has react as a dependency
    if(packageJsonObj.dependencies?.['react'] || packageJsonObj.devDependencies?.['react']) {
        return 'react-spa'
    }
    if(packageJsonObj.dependencies?.['vue'] || packageJsonObj.devDependencies?.['vue']) {
        return 'vue-spa'
    }
    if(packageJsonObj.dependencies?.['solid-start'] || packageJsonObj.devDependencies?.['solid-start']) {
        return 'solidstart'
    }
    //make sure 'solid-js' is after 'solid-start' because solid-start has solid-js as a dependency
    if(packageJsonObj.dependencies?.['solid-js'] || packageJsonObj.devDependencies?.['solid-js']) {
        return 'solidjs-spa'
    }
    if(packageJsonObj.dependencies?.['@sveltejs/kit'] || packageJsonObj.devDependencies?.['@sveltejs/kit']) {
        return 'sveltekit'
    }
    //make sure 'svelte' is after 'sveltekit' because sveltekit has svelte as a dependency
    if(packageJsonObj.dependencies?.['svelte'] || packageJsonObj.devDependencies?.['svelte']) {
        return 'svelte-spa'
    }
    return null
}

function getDirAppType(dir: string): SupportedFramework | null {
    //looks like there is no "stat" function in spidermonkey? if you find it please open an issue!
    const packageJsonStat = statFile(os.path.join(dir, 'package.json'))
    if(isFailure(packageJsonStat)) {
        return null
    }
    if(packageJsonStat.result.isDir) {
        return null
    }
    const packageJson = os.file.readFile(os.path.join(dir, 'package.json')) as string
    return getPackageJsonAppType(packageJson)
}

function findAppDirs(dir: string): CrawlResult[] {
    const appType = getDirAppType(dir)
    if(appType) {
        return [{
            location: dir,
            framework: appType
        }]
    }
    const files = os.file.listDir(dir)
    const results: CrawlResult[] = []
    for(const file of files) {
        if(file === '.' || file === '..') {
            continue
        }
        if(file === 'node_modules' || file === barbeOutputDir()) {
            continue
        }
        const path = os.path.join(dir, file)
        const fileStat = statFile(path)
        if(isFailure(fileStat)) {
            continue
        }
        if(!fileStat.result.isDir) {
            continue
        }
        results.push(...findAppDirs(path))
    }
    return results
}

function staticHostingPipeline(apps: AppBundle[]): Step[] {
    return [
        step(() => ({
            imports: [{
                url: STATIC_HOSTING_URL,
                copyFromContainer: [
                    'cr_[terraform]',
                    'default',
                    'global_default',
                    'state_store',
                    'static_hosting_build_dir_map'
                ],
                input: apps.map(app => ({
                    Type: STATIC_HOSTING,
                    Name: app.bag.Name,
                    Value: {
                        ...app.block,
                        build: [{
                            ...compileBlockParam(app.block, 'build'),
                            build_dir: app.appInfo.location,
                            ...app.extraSettings,
                        }]
                    }
                }))
            }]
        })),
        step(({previousStepResult}) => exportDatabags(previousStepResult))
    ]
}

function sveltekitAwsPipeline(apps: AppBundle[]): Step[] {
    return [
        step(() => ({
            imports: [{
                url: AWS_SVELTEKIT_URL,
                copyFromContainer: ['cr_[terraform]', 'default', 'global_default', 'state_store'],
                input: apps.map(app => ({
                    Type: AWS_SVELTEKIT,
                    Name: app.bag.Name,
                    Value: {
                        ...app.block,
                        app_dir: app.appInfo.location,
                        ...app.extraSettings,
                    }
                }))
            }]
        })),
        step(({previousStepResult}) => exportDatabags(previousStepResult))
    ]
}

function nextAwsPipeline(apps: AppBundle[]): Step[] {
    return [
        step(() => ({
            imports: [{
                url: AWS_NEXT_JS_URL,
                copyFromContainer: ['cr_[terraform]', 'default', 'global_default', 'state_store'],
                input: apps.map((app) => ({
                    Type: AWS_NEXT_JS,
                    Name: app.bag.Name,
                    Value: {
                        ...app.block,
                        app_dir: app.appInfo.location,
                        ...app.extraSettings,
                    }
                }))
            }]
        })),
        step(({previousStepResult}) => exportDatabags(previousStepResult))
    ]
}

function nextGcpPipeline(apps: AppBundle[]): Step[] {
    return [
        step(() => ({
            imports: [{
                url: GCP_NEXT_JS_URL,
                copyFromContainer: ['cr_[terraform]', 'default', 'global_default', 'state_store'],
                input: apps.map(app => ({
                    Type: GCP_NEXT_JS,
                    Name: app.bag.Name,
                    Value: {
                        ...app.block,
                        app_dir: app.appInfo.location,
                        ...app.extraSettings,
                    }
                }))
            }]
        })),
        step(({previousStepResult}) => exportDatabags(previousStepResult))
    ]
}

function makePipeline(framework: SupportedFramework, platform: SupportedPlatform, apps: AppBundle[]): Pipeline {
    let steps: Step[] = []
    switch(framework) {
        case 'next-export':
            // since `next build && next export` generates both a `.next` folder an a `out` folder
            // we help anyfront know that the `out` folder is the one that should be deployed
            apps.forEach(app => {
                app.extraSettings = {
                    build_output_dir: 'out'
                }
                return app
            })
        case 'react-spa':
        case 'vue-spa':
        case 'solidjs-spa':
        case 'svelte-spa':
        default:
            steps = staticHostingPipeline(apps)
            break
        case 'next':
            switch(platform) {
                case 'aws':
                    steps = nextAwsPipeline(apps)
                    break
                case 'gcp':
                    steps = nextGcpPipeline(apps)
                    break
                default:
                    throw new Error(`next.js not supported on platform '${platform}'`)
            }
            break
        case 'sveltekit':
            switch(platform) {
                case 'aws':
                    steps = sveltekitAwsPipeline(apps)
                    break
                default:
                    throw new Error(`sveltekit not supported on platform '${platform}' yet`)
            }
            break
        // case 'solidstart':
        //     throw new Error(`framework '${appInfo.framework}' not supported yet`)
    }
    return pipeline(steps, { name: `anyfront-${framework}-${platform}` })
}

function makeAppPipelines(apps: AppBundle[]): Pipeline[] {
    //we need to group them by type otherwise the auto delete detection will delete each other
    let appPerType: { [key in SupportedFramework]?: { [key in SupportedPlatform]?: AppBundle[] } } = {}
    for(const app of apps) {
        if(!app.block.platform) {
            throw new Error(`'platform' is required for 'anyfront' block`)
        }
        const platform = asStr(app.block.platform)
        if(!appPerType[app.appInfo.framework]) {
            appPerType[app.appInfo.framework] = {}
        }
        if(!appPerType[app.appInfo.framework]![platform]) {
            appPerType[app.appInfo.framework]![platform] = []
        }
        appPerType[app.appInfo.framework]![platform]!.push(app)
    }
    let pipelines: Pipeline[] = []
    for(const [framework, platforms] of Object.entries(appPerType)) {
        for (const [platform, apps] of Object.entries(platforms)) {
            pipelines.push(makePipeline(framework as SupportedFramework, platform as SupportedPlatform, apps))
        }
    }

    //if there is no anyfront block, or if there is no app of a given framework+plaform, we run an empty import on that component
    for(const framework of SupportedFrameworks) {
        for(const platform of SupportedPlatforms) {
            if(!appPerType[framework] || !appPerType[framework]![platform]) {
                try{
                    //this will throw an error if the framework+platform is not supported
                    pipelines.push(makePipeline(framework as SupportedFramework, platform as SupportedPlatform, []))
                }catch(e){}
            }
        }
    }
    return pipelines
}


type AppBundle = {
    bag: Databag
    block: DatabagObjVal
    namePrefix: SyntaxToken
    appInfo: CrawlResult
    extraSettings?: any
}

function main() {
    const foundApps = iterateBlocks(container, ANYFRONT, (bag): AppBundle | null => {
        if(!bag.Value) {
            return null
        }
        const [block, namePrefix] = applyDefaults(container, bag.Value)

        let appInfo: CrawlResult | null
        let givenAppDir = '.'
        if(block.app_dir) {
            if (!isSimpleTemplate(block.app_dir)) {
                if(IS_VERBOSE){
                    console.log('anyfront: app_dir not ready yet', JSON.stringify(block.app_dir))
                }
                return null
            }
            givenAppDir = asStr(block.app_dir)
        }
        const appDirs = findAppDirs(givenAppDir)
        if (appDirs.length === 0) {
            throwStatement('anyfront: couldnt find a sub directory with a package.json that has a supported framework, please provide the path to it in the "app_dir" field')
        }
        if (appDirs.length > 1) {
            throwStatement('anyfront: found multiple sub directories with a package.json that has a supported framework, please provide the path to the app you want deployed in the "app_dir" field: ' + appDirs.map(a => a.location).join(','))
        }
        appInfo = appDirs[0]
        return {
            bag,
            block,
            namePrefix,
            appInfo
        }
    }).flat().filter(t => t) as AppBundle[]
    executePipelineGroup(container, makeAppPipelines(foundApps))
}

main()