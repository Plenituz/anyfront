import { asStr, BarbeState, Databag, DatabagContainer, ImportComponentInput, isSimpleTemplate, SugarCoatedDatabag, SyntaxToken, visitTokens, statFile, iterateBlocks, throwStatement, asBlock, exportDatabags } from '../../../barbe-serverless/src/barbe-std/utils';
import * as _ from '../../../barbe-serverless/src/barbe-std/spidermonkey-globals';
import { isFailure } from '../../../barbe-serverless/src/barbe-std/rpc';
import { TERRAFORM_EXECUTE_URL } from './consts';
import { Pipeline, pipeline, step } from './pipeline';
import { applyDefaults, compileBlockParam } from '../../../barbe-serverless/src/barbe-sls-lib/lib';

export type DBAndImport = {
    databags: (Databag | SugarCoatedDatabag)[]
    imports: ImportComponentInput[]
}


export function emptyExecuteBagNamePrefix(stateKey: string) {
    return `${stateKey}_destroy_missing_`
}
export function emptyExecuteTemplate(container: DatabagContainer, state: any, blockType: string, stateKey: string): SugarCoatedDatabag[] {
    const stateObj = state[stateKey] || {}
    if(!stateObj) {
        return []
    }
    let output: SugarCoatedDatabag[] = []
    for(const [bagName, tfBlock] of Object.entries(stateObj)) {
        if(container[blockType][bagName]) {
            //if the bag is still in the container, it means it was not deleted
            continue
        }
        output.push({
            Type: 'terraform_empty_execute',
            Name: `${emptyExecuteBagNamePrefix(stateKey)}${bagName}`,
            Value: {
                display_name: `Destroy missing ${blockType}.${bagName}`,
                mode: 'apply',
                template_json: JSON.stringify({
                    terraform: (() => {
                        let tfObj = {}
                        for(const [key, value] of Object.entries(tfBlock as { [key: string]: any })) {
                            tfObj[key] = {
                                [value[0].Meta.Labels[0]]: (() => {
                                    let obj = {}
                                    for(const [innerKey, innerValue] of Object.entries(value[0])) {
                                        obj[innerKey] = innerValue
                                    }
                                    return obj
                                })()
                            }
                        }
                        return tfObj
                    })()
                })
            }
        })
    }

    return output
}

export function emptyExecutePostProcess(container: DatabagContainer, results: DatabagContainer, blockType: string, stateKey: string): SugarCoatedDatabag[] {
    if(!results.terraform_empty_execute_output) {
        return []
    }
    let output: SugarCoatedDatabag[] = []
    const prefix = emptyExecuteBagNamePrefix(stateKey)
    for(const prefixedName of Object.keys(results.terraform_empty_execute_output)) {
        if(!prefixedName.startsWith(prefix)) {
            continue
        }
        //this is the bag.Name of the gcp_cloudrun_static_hosting
        const nonPrefixedName = prefixedName.replace(prefix, '')
        if(container?.[blockType]?.[nonPrefixedName]) {
            //just making sure just in case something went wrong
            continue
        }
        output.push(BarbeState.deleteFromObject(stateKey, nonPrefixedName))
    }
    return output
}

export function prependTfStateFileName(container: DatabagContainer, prefix: string): SyntaxToken | undefined {
    const visitor = (token: SyntaxToken): SyntaxToken | null => {
        if(token.Type === 'literal_value' && typeof token.Value === 'string' && token.Value.includes('.tfstate')) {
            return {
                ...token,
                Type: 'literal_value',
                Value: token.Value.replace('.tfstate', `${prefix}.tfstate`)
            }
        }
        return null
    }
    if(!container['cr_[terraform]']) { 
        return 
    }
    return visitTokens(container['cr_[terraform]'][''][0].Value!, visitor)
}

export function guessAwsDnsZoneBasedOnDomainName(domainName: SyntaxToken | string | undefined): string | null {
    if(!domainName) {
        return null
    }
    if(!isSimpleTemplate(domainName)) {
        return null
    }
    const parts = asStr(domainName).split('.')
    if(parts.length === 2) {
        return `${parts[0]}.${parts[1]}`
    }
    if (parts.length < 3) {
        return null
    }
    return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`
}

export function findFilesInSubdirs(dir: string, fileName: string, ignoreDirs?: { [key:string]: unknown }): string[] {
    if(!ignoreDirs) {
        ignoreDirs = {}
    }

    const files = os.file.listDir(dir);
    let found: string[] = [];
    files.forEach(file => {
        const filePath = os.path.join(dir, file);
        const statRes = statFile(filePath)
        if(isFailure(statRes)) {
            return
        }
        if (statRes.result.isDir) {
            if (file in ignoreDirs!) {
                return;
            }
            found = found.concat(findFilesInSubdirs(filePath, fileName));
        } else if (file === fileName) {
            found.push(filePath);
        }
    });
    return found;
}

export function autoDeleteMissing(container: DatabagContainer, blockName: string): Pipeline[] {
    const state = BarbeState.readState()
    const STATE_KEY_NAME = 'created_tfstate'
    const emptyExecuteBagNamePrefix = `${STATE_KEY_NAME}_destroy_missing_`

    const makeEmptyExecuteDatabags = (container: DatabagContainer, state: any): SugarCoatedDatabag[] => {
        if(!container['cr_[terraform]']) {
            return []
        }
        //only add empty execute if we have a terraform block
        //because this component gets called multiple times with no real input
        //and we dont want to delete the block everytime that happens
        return emptyExecuteTemplate(container, state)
    }

    const emptyExecuteTemplate = (container: DatabagContainer, state: any): SugarCoatedDatabag[] => {
        const stateObj = state[STATE_KEY_NAME]
        if(!stateObj) {
            return []
        }
        let output: SugarCoatedDatabag[] = []
        for(const [bagName, tfBlock] of Object.entries(stateObj)) {
            if(!tfBlock || bagName === 'Meta') {
                continue
            }
            if(container?.[blockName]?.[bagName]) {
                //if the bag is still in the container, it means it was not deleted
                continue
            }
            output.push({
                Type: 'terraform_empty_execute',
                Name: `${emptyExecuteBagNamePrefix}${bagName}`,
                Value: {
                    mode: 'apply',
                    template_json: JSON.stringify({
                        // :)
                        terraform: (() => {
                            let tfObj = {}
                            for(const [key, value] of Object.entries(tfBlock as { [key: string]: any })) {
                                if(!value || key === 'Meta') {
                                    continue
                                }
                                tfObj[key] = {
                                    [value[0].Meta?.Labels[0]]: (() => {
                                        let obj = {}
                                        for(const [innerKey, innerValue] of Object.entries(value[0])) {
                                            if(!innerValue || innerKey === 'Meta') {
                                                continue
                                            }
                                            obj[innerKey] = innerValue
                                        }
                                        return obj
                                    })()
                                }
                            }
                            return tfObj
                        })()
                    })
                }
            })
        }
        return output
    }

    const emptyExecutePostProcess = (container: DatabagContainer, results: DatabagContainer): SugarCoatedDatabag[] => {
        if(!results.terraform_empty_execute_output) {
            return []
        }
        let output: SugarCoatedDatabag[] = []
        for(const prefixedName of Object.keys(results.terraform_empty_execute_output)) {
            if(!prefixedName.startsWith(emptyExecuteBagNamePrefix)) {
                continue
            }
            //this is the bag.Name of the gcp_cloudrun_static_hosting
            const nonPrefixedName = prefixedName.replace(emptyExecuteBagNamePrefix, '')
            if(container?.[blockName]?.[nonPrefixedName]) {
                //just making sure just in case something went wrong
                continue
            }
            output.push(BarbeState.deleteFromObject(STATE_KEY_NAME, nonPrefixedName))
        }
        return output
    }
    const applyPipe = pipeline([], { name: `auto_delete_${blockName}_apply` })
    applyPipe.pushWithParams({ lifecycleSteps: ['apply'] }, () => {
        let databags: SugarCoatedDatabag[] = []
        if(container['cr_[terraform]']){
            databags.push(
                ...Object.keys(container?.[blockName] || {}).map(bagName => BarbeState.putInObject(STATE_KEY_NAME, {
                    [bagName]: prependTfStateFileName(container, `_${blockName}_${bagName}`)
                }))
            )
        }
        let imports = [{
            url: TERRAFORM_EXECUTE_URL,
            input: makeEmptyExecuteDatabags(container, state)
        }]
        return { databags, imports }
    })
    applyPipe.pushWithParams({ lifecycleSteps: ['apply'] }, (input) => {
        let databags = emptyExecutePostProcess(container, input.previousStepResult)
        return { databags }
    })

    const destroyPipe = pipeline([], { name: `auto_delete_${blockName}_destroy` })
    destroyPipe.pushWithParams({ lifecycleSteps: ['destroy'] }, () => {
        let databags = Object.keys(container?.[blockName] || {}).map(bagName => BarbeState.deleteFromObject(STATE_KEY_NAME, bagName))
        let imports = [{
            url: TERRAFORM_EXECUTE_URL,
            input: makeEmptyExecuteDatabags(container, state)
        }]
        return { imports, databags }
    })
    destroyPipe.pushWithParams({ lifecycleSteps: ['destroy'] }, (input) => {
        let databags = emptyExecutePostProcess(container, input.previousStepResult)
        return { databags }
    })
    return [applyPipe, destroyPipe]
}

export function autoCreateStateStore(container: DatabagContainer, blockName: string, kind: 's3' | 'gcs'): Pipeline {
    if(container.state_store) {
        return pipeline([])
    }
    return pipeline([
        step(() => {
            const databags = iterateBlocks(container, blockName, (bag) => {
                const [block, namePrefix] = applyDefaults(container, bag.Value!)
                if(!isSimpleTemplate(namePrefix)) {
                    return []
                }
                let value = {
                    name_prefix: [`${bag.Name}-`],
                }
                switch(kind) {
                    case 's3':
                        value['s3'] = asBlock([{}])
                        break
                    case 'gcs':
                        const dotGcpProject = compileBlockParam(block, 'google_cloud_project')
                        value['gcs'] = asBlock([{
                            project_id: block.google_cloud_project_id || block.project_id || dotGcpProject.project_id,
                        }])
                        break
                    default:
                        throwStatement(`Unknown state_store kind '${kind}'`)
                }
                return [{
                    Type: 'state_store',
                    Name: '',
                    Value: value
                }]
            }).flat()
            return { databags }
        }, { lifecycleSteps: ['pre_generate'] })
    ])
}