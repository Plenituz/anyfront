import { asStr, BarbeState, Databag, DatabagContainer, ImportComponentInput, isSimpleTemplate, SugarCoatedDatabag, SyntaxToken, visitTokens, statFile, iterateBlocks, throwStatement, asBlock, exportDatabags } from '../../../barbe-serverless/src/barbe-std/utils';
import * as _ from '../../../barbe-serverless/src/barbe-std/spidermonkey-globals';
import { isFailure } from '../../../barbe-serverless/src/barbe-std/rpc';
import { TERRAFORM_EXECUTE_URL } from './consts';
import { addToStepOutput, Pipeline, pipeline, step, StepOutput } from './pipeline';
import { applyDefaults, compileBlockParam } from '../../../barbe-serverless/src/barbe-sls-lib/lib';

/**
 * @deprecated: use pipeline instead
 */
export type DBAndImport = {
    databags: (Databag | SugarCoatedDatabag)[]
    imports: ImportComponentInput[]
}

/**
 * @deprecated: use autoDeleteMissing2 pipeline instead
 */
export function emptyExecuteBagNamePrefix(stateKey: string) {
    return `${stateKey}_destroy_missing_`
}
/**
 * @deprecated: use autoDeleteMissing2 pipeline instead
 */
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

/**
 * @deprecated: use autoDeleteMissing2 pipeline instead
 */
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

//TODO port the updated usage of this
export function prependTfStateFileName(tfBlock: SyntaxToken, prefix: string): SyntaxToken {
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
    return visitTokens(tfBlock, visitor)
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

//if null is returned it means we cant tell
export function isDomainNameApex(domainName: SyntaxToken | string | undefined, zoneName?: SyntaxToken | string): boolean | null {
    if(!domainName) {
        return null
    }
    if(!isSimpleTemplate(domainName)) {
        return null
    }
    const domainNameStr = asStr(domainName)
    if(zoneName && isSimpleTemplate(zoneName) && domainNameStr === asStr(zoneName)) {
        return true
    }
    const parts = domainNameStr.split('.')
    if(parts.length === 2) {
        return true
    }
    return false
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

export function autoDeleteMissingTfState(container: DatabagContainer, bagType: string, onDelete?: (bagType: string, bagName: string, savedValue: { [key: string]: any }) => StepOutput): Pipeline {
    return autoDeleteMissing2(container, {
        bagType,
        createSavable: (bagType, bagName) => {
            return prependTfStateFileName(container['cr_[terraform]'][''][0].Value!, `_${bagType}_${bagName}`)
        },
        deleteMissing: (bagType, bagName, savedValue) => {
            const imports =[{
                url: TERRAFORM_EXECUTE_URL,
                input: [{
                    Type: 'terraform_empty_execute',
                    Name: `auto_delete_${bagType}_${bagName}`,
                    Value: {
                        display_name: `Destroy missing ${bagType}.${bagName}`,
                        mode: 'apply',
                        template_json: JSON.stringify({
                            // :)
                            //turn the saved json objects back into a `terraform {}` block
                            terraform: (() => {
                                let tfObj = {}
                                for(const [key, value] of Object.entries(savedValue as { [key: string]: any })) {
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
                }]
            }]
            let output = { imports }
            if(onDelete) {
                addToStepOutput(output, onDelete(bagType, bagName, savedValue))
            }
            return output
        },
    })
}

export type AutoDeleteInput = {
    bagType: string
    createSavable: (bagType: string, bagName: string) => any
    deleteMissing: (bagType: string, bagName: string, savedValue: { [key: string]: any }) => StepOutput
}
export function autoDeleteMissing2(container: DatabagContainer, input: AutoDeleteInput): Pipeline {
    const state = BarbeState.readState()
    const STATE_KEY_NAME = 'auto_delete_missing_tracker'

    const applyPipe = pipeline([], { name: `auto_delete_${input.bagType}` })
    applyPipe.pushWithParams({ name: 'delete_missing', lifecycleSteps: ['apply', 'destroy'] }, () => {
        if(!container['cr_[terraform]']){
            return
        }
        const stateObj = state[STATE_KEY_NAME]
        if(!stateObj) {
            return
        }
        let output: StepOutput = {
            databags: [],
            imports: [],
            transforms: []
        }
        for(const [bagName, savedValue] of Object.entries(stateObj)) {
            if(!savedValue || bagName === 'Meta') {
                continue
            }
            if(container?.[input.bagType]?.[bagName]) {
                //if the bag is still in the container, it means it was not deleted
                continue
            }
            //if we're here it means a block was deployed previously but is no longer in the container
            const deleteMissing = input.deleteMissing(input.bagType, bagName, savedValue)
            output.databags!.push(...(deleteMissing.databags || []))
            output.imports!.push(...(deleteMissing.imports || []))
            output.transforms!.push(...(deleteMissing.transforms || []))
        }
        return output
    })
    //we save the current blocks in the state on post_apply so we know the deploy went thru
    applyPipe.pushWithParams({ name: 'cleanup_state', lifecycleSteps: ['post_apply'] }, () => {
        if(!container['cr_[terraform]']){
            return
        }
        //add the current blocks to the state
        const databags: SugarCoatedDatabag[] = Object.keys(container?.[input.bagType] || {})
            .map(bagName => BarbeState.putInObject(STATE_KEY_NAME, {
                [bagName]: input.createSavable(input.bagType, bagName)
            }))

        //delete the blocks that are missing that were deleted from the state
        for(const [bagName, savedValue] of Object.entries(state[STATE_KEY_NAME] || {})) {
            if(!savedValue || bagName === 'Meta') {
                continue
            }
            if(container?.[input.bagType]?.[bagName]) {
                //if the bag is still in the container, it means it was not deleted
                continue
            }
            //if we're here it means a block was deployed previously but is no longer in the container
            //and we know we destroyed it successfully int he apply step
            databags.push(BarbeState.deleteFromObject(STATE_KEY_NAME, bagName))
        }
        return { databags }
    })
    applyPipe.pushWithParams({ name: 'cleanup_state_destroy', lifecycleSteps: ['post_destroy'] }, () => {
        const databags: SugarCoatedDatabag[] = []
        for(const [bagName, savedValue] of Object.entries(state[STATE_KEY_NAME] || {})) {
            if(bagName === 'Meta') {
                continue
            }
            databags.push(BarbeState.deleteFromObject(STATE_KEY_NAME, bagName))
        }
    })
    return applyPipe
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