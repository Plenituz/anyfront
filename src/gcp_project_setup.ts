import { readDatabagContainer, barbeLifecycleStep, exportDatabags, iterateBlocks, Databag, SugarCoatedDatabag, asTraversal, asFuncCall, asValArrayConst, asBlock, BarbeState, barbeOutputDir, importComponents, asVal, asStr } from '../../barbe-serverless/src/barbe-std/utils';
import { applyDefaults, preConfCloudResourceFactory } from '../../barbe-serverless/src/barbe-sls-lib/lib';
import { GCP_PROJECT_SETUP, GCP_PROJECT_SETUP_GET_INFO, TERRAFORM_EXECUTE_URL } from './anyfront-lib/consts';
import { emptyExecuteTemplate, prependTfStateFileName, emptyExecutePostProcess } from './anyfront-lib/lib';
import { TERRAFORM_EXECUTE_GET_OUTPUT } from '../../barbe-serverless/src/barbe-sls-lib/consts';

const container = readDatabagContainer()
const state = BarbeState.readState()
const outputDir = barbeOutputDir()
const CREATED_TF_STATE_KEY = 'created_tfstate'
const CREATED_PROJECT_NAME_KEY = 'created_project_name'

//this will include the gcp_project_setups that are not in the template but not deleted by empty apply yet
//which is ok, it's just the first run after you delete the gcp_project_setup block basically
const alreadyDeployedProjectOutput = Object.entries(state[CREATED_PROJECT_NAME_KEY] || {})
    .map(([bagName, projectName]) => ({
        Type: 'gcp_project_setup_output',
        Name: bagName,
        Value: {
            project_name: projectName
        }
    }))


function gcpProjectSetupGenerateIterator(bag: Databag): (Databag | SugarCoatedDatabag)[] {
    if(!bag.Value) {
        return []
    }
    const [block, _] = applyDefaults(container, bag.Value);

    const dir = `gcp_project_setup_${bag.Name}`
    const bagPreconf = {
        dir,
        id: dir
    }
    const cloudResource = preConfCloudResourceFactory(block, 'resource', undefined, bagPreconf)
    const cloudData = preConfCloudResourceFactory(block, 'data', undefined, bagPreconf)
    const cloudOutput = preConfCloudResourceFactory(block, 'output', undefined, bagPreconf)
    const cloudProvider = preConfCloudResourceFactory(block, 'provider', undefined, bagPreconf)
    const cloudTerraform = preConfCloudResourceFactory(block, 'terraform', undefined, bagPreconf)

    const projectSetupResource = (): SugarCoatedDatabag[] => {
        let localDatabags = [
            cloudProvider('', 'google', {
                region: block.gcp_region || 'us-central1',
            })
        ]
        if(!block.project_id) {
            localDatabags.push(
                cloudData('google_billing_account', 'billing_account', {
                    open: true,
                    display_name: (() => {
                        if(block.billing_account_id) {
                            return undefined
                        }
                        if(block.billing_account_name) {
                            return block.billing_account_name
                        }
                        //this is the default name on GCP, if the user didnt change it we can use it
                        return 'My Billing Account'
                    })(),
                    billing_account: block.billing_account_id ? block.billing_account_id : undefined
                }),
                cloudResource('google_project', 'project', {
                    name: block.project_name,
                    project_id: block.project_name,
                    billing_account: asTraversal('data.google_billing_account.billing_account.id'),
                    org_id: block.organization_id || block.organization_domain ? asTraversal('data.google_organization.google_org.org_id') : undefined,
                }),
                cloudOutput('', 'project_name', {
                    value: asFuncCall('replace', [
                        asTraversal('google_project.project.id'),
                        'projects/',
                        ''
                    ])
                })
            )
            if(block.organization_id) {
                localDatabags.push(
                    cloudData('google_organization', 'google_org', {
                        organization: block.organization_id
                    })
                )
            } else if(block.organization_domain) {
                localDatabags.push(
                    cloudData('google_organization', 'google_org', {
                        domain: block.organization_domain
                    })
                )
            }
        } else {
            localDatabags.push(
                cloudData('google_project', 'project', {
                    project_id: block.project_id
                }),
                cloudOutput('', 'project_name', {
                    value: asFuncCall('replace', [
                        asTraversal('data.google_project.project.project_id'),
                        'projects/',
                        ''
                    ])
                })
            )
        }
        if(block.services_to_activate) {
            localDatabags.push(
                ...asValArrayConst(block.services_to_activate).map(serviceName => (
                    cloudResource('google_project_service', `api_${serviceName.replace(/\./g, '_')}`, {
                        project: block.project_id ? asTraversal("data.google_project.project.project_id") : asTraversal("google_project.project.project_id"),
                        service: serviceName,
                        disable_dependent_services: false,
                        disable_on_destroy: false,
                        timeouts: asBlock([{
                            create: '30m',
                            update: '40m',
                        }])
                    })
                )),
            )
        }
        return localDatabags
    }

    let databags: SugarCoatedDatabag[] = projectSetupResource()
    if(container['cr_[terraform]']) {
        databags.push(cloudTerraform('', '', prependTfStateFileName(container, `_gcp_project_setup_${bag.Name}`)))
    }
    return databags
}

function gcpProjectSetupApplyIterator(bag: Databag): (Databag | SugarCoatedDatabag)[] {
    if(!bag.Value) {
        return []
    }
    if(BarbeState.getObjectValue(state, CREATED_TF_STATE_KEY, bag.Name)) {
        // already created, skip. Note: only skip in apply, generate should still happen
        return []
    }
    return [{
        Type: 'terraform_execute',
        Name: `gcp_setup_${bag.Name}`,
        Value: {
            display_name: `Terraform apply - gcp_project_setup.${bag.Name}`,
            mode: 'apply',
            dir: `${outputDir}/gcp_project_setup_${bag.Name}`
        }
    }]
}

function makeEmptyExecuteDatabags(): SugarCoatedDatabag[] {
    if(!container['cr_[terraform]']) {
        return []
    }
    //only add empty execute if we have a terraform block
    //because this component gets called multiple times with no real input
    //and we dont want to delete the gcp_project_setup everytime that happens
    return emptyExecuteTemplate(container, state, GCP_PROJECT_SETUP, CREATED_TF_STATE_KEY)
}

function gcpProjectSetupApply() {
    const results = importComponents(container, [{
        name: 'gcp_project_setup_apply',
        url: TERRAFORM_EXECUTE_URL,
        input: [
            ...iterateBlocks(container, GCP_PROJECT_SETUP, gcpProjectSetupApplyIterator).flat(),
            ...makeEmptyExecuteDatabags()
        ]
    }])

    const applyProcessResultsIterator = (bag: Databag): (Databag | SugarCoatedDatabag)[] => {
        if(!bag.Value) {
            return []
        }
        if(!results.terraform_execute_output[`gcp_setup_${bag.Name}`]) {
            return []
        }
        const projectName = asStr(asVal(asVal(results.terraform_execute_output[`gcp_setup_${bag.Name}`][0].Value!)[0]).value)
        let databags: SugarCoatedDatabag[] = [{
            Type: 'gcp_project_setup_output',
            Name: bag.Name,
            Value: {
                project_name: projectName
            }
        }]
        if(container['cr_[terraform]']) {
            databags.push(
                BarbeState.putInObject(CREATED_TF_STATE_KEY, {
                    [bag.Name]: prependTfStateFileName(container, `_gcp_project_setup_${bag.Name}`)
                }),
                BarbeState.putInObject(CREATED_PROJECT_NAME_KEY, {
                    [bag.Name]: projectName
                }),
            )
        }
        return databags
    }

    let databags: SugarCoatedDatabag[] = [
        ...emptyExecutePostProcess(container, results, GCP_PROJECT_SETUP, CREATED_TF_STATE_KEY),
        ...emptyExecutePostProcess(container, results, GCP_PROJECT_SETUP, CREATED_PROJECT_NAME_KEY),
        ...alreadyDeployedProjectOutput,
    ]
    if(results.terraform_execute_output) {
        databags.push(
            ...iterateBlocks(container, GCP_PROJECT_SETUP, applyProcessResultsIterator).flat(),
        )
    }
    exportDatabags(databags)
}

function gcpProjectSetupDestroyIterator(bag: Databag): (Databag | SugarCoatedDatabag)[] {
    if(!bag.Value) {
        return []
    }

    return [{
        Type: 'terraform_execute',
        Name: `gcp_destroy_${bag.Name}`,
        Value: {
            display_name: `Terraform destroy - gcp_project_setup.${bag.Name}`,
            mode: 'destroy',
            dir: `${outputDir}/gcp_project_setup_${bag.Name}`
        }
    }]
}

function gcpProjectSetupDestroy() {
    const results = importComponents(container, [{
        name: 'gcp_project_setup_destroy',
        url: TERRAFORM_EXECUTE_URL,
        input: [
            ...iterateBlocks(container, GCP_PROJECT_SETUP, gcpProjectSetupDestroyIterator).flat(),
            ...makeEmptyExecuteDatabags()
        ]
    }])

    const destroyProcessResultsIterator = (bag: Databag): (Databag | SugarCoatedDatabag)[] => {
        if(!bag.Value) {
            return []
        }
        return [
            BarbeState.deleteFromObject(CREATED_TF_STATE_KEY, bag.Name),
            BarbeState.deleteFromObject(CREATED_PROJECT_NAME_KEY, bag.Name),
        ]
    }

    let databags: SugarCoatedDatabag[] = [
        ...emptyExecutePostProcess(container, results, GCP_PROJECT_SETUP, CREATED_TF_STATE_KEY),
        ...emptyExecutePostProcess(container, results, GCP_PROJECT_SETUP, CREATED_PROJECT_NAME_KEY),
        //we keep that in case the calling template uses it, even tho it just got destroyed
        ...alreadyDeployedProjectOutput,
        ...iterateBlocks(container, GCP_PROJECT_SETUP, destroyProcessResultsIterator).flat(),
    ]
    exportDatabags(databags)
}

function gcpProjectSetupGetInfoIterator(bag: Databag): (Databag | SugarCoatedDatabag)[] {
    return [{
        Type: TERRAFORM_EXECUTE_GET_OUTPUT,
        Name: `gcp_setup_get_output_${bag.Name}`,
        Value: {
            display_name: `Terraform output - gcp_project_setup.${bag.Name}`,
            dir: `${outputDir}/gcp_project_setup_${bag.Name}`
        }
    }]
}

function getInfo() {
    const results = importComponents(container, [{
        name: `gcp_project_setup_get_info_${barbeLifecycleStep()}`,
        url: TERRAFORM_EXECUTE_URL,
        input: iterateBlocks(container, GCP_PROJECT_SETUP_GET_INFO, gcpProjectSetupGetInfoIterator).flat()
    }])

    const resultsIterator = (bag: Databag): (Databag | SugarCoatedDatabag)[] => {
        if(!bag.Value) {
            return []
        }
        if(!results.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`] || 
            !results.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0] ||
            !results.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0].Value ||
            !asVal(results.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0].Value!)[0]) {
            return []
        }
        const projectName = asStr(asVal(asVal(results.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0].Value!)[0]).value)
        let databags: SugarCoatedDatabag[] = [{
            Type: 'gcp_project_setup_output',
            Name: bag.Name,
            Value: {
                project_name: projectName
            }
        }]
        return databags
    }

    if(results.terraform_execute_output) {
        exportDatabags(iterateBlocks(container, GCP_PROJECT_SETUP_GET_INFO, resultsIterator).flat())
    }
}

getInfo()
switch(barbeLifecycleStep()) {
    case 'generate':
        exportDatabags(iterateBlocks(container, GCP_PROJECT_SETUP, gcpProjectSetupGenerateIterator).flat())
        break
    case 'apply':
        gcpProjectSetupApply()
        break
    case 'destroy':
        gcpProjectSetupDestroy()
        break
}

