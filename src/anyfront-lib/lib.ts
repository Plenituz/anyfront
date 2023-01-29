import { BarbeState, Databag, DatabagContainer, ImportComponentInput, SugarCoatedDatabag, SyntaxToken, visitTokens } from '../../../barbe-serverless/src/barbe-std/utils';

export type DBAndImport = {
    databags: (Databag | SugarCoatedDatabag)[]
    imports: ImportComponentInput[]
}


export function emptyExecuteBagNamePrefix(stateKey: string) {
    return `${stateKey}_destroy_missing_`
}
export function emptyExecuteTemplate(container: DatabagContainer, state: any, blockType: string, stateKey: string): SugarCoatedDatabag[] {
    const stateObj = state[stateKey]
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

export function prependTfStateFileName(container: DatabagContainer, prefix: string): SyntaxToken {
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
    return visitTokens(container['cr_[terraform]'][''][0].Value!, visitor)
}