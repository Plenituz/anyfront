import { readDatabagContainer, barbeLifecycleStep, exportDatabags, iterateBlocks, Databag, SugarCoatedDatabag, asTraversal, asFuncCall, asValArrayConst, asBlock, BarbeState, barbeOutputDir, asVal, asStr } from '../../barbe-serverless/src/barbe-std/utils';
import { applyDefaults, preConfCloudResourceFactory } from '../../barbe-serverless/src/barbe-sls-lib/lib';
import { GCP_PROJECT_SETUP, GCP_PROJECT_SETUP_GET_INFO, TERRAFORM_EXECUTE_URL } from './anyfront-lib/consts';
import { prependTfStateFileName, autoCreateStateStore, autoDeleteMissingTfState } from './anyfront-lib/lib';
import { TERRAFORM_EXECUTE_GET_OUTPUT } from '../../barbe-serverless/src/barbe-sls-lib/consts';
import { executePipelineGroup, pipeline, Pipeline, getHistoryItem } from './anyfront-lib/pipeline';

const container = readDatabagContainer()
const state = BarbeState.readState()
const outputDir = barbeOutputDir()
const CREATED_PROJECT_NAME_KEY = 'created_project_name'

const alreadyDeployedProjectOutput = Object.entries(state[CREATED_PROJECT_NAME_KEY] || {})
    .map(([bagName, projectName]) => ({
        Type: 'gcp_project_setup_output',
        Name: bagName,
        Value: {
            project_name: projectName
        }
    }))
exportDatabags(alreadyDeployedProjectOutput)

function gcpProjectSetup(bag: Databag): Pipeline {
    let pipe = pipeline([], { name: `gcp_project_setup.${bag.Name}` })
    if(!bag.Value) {
        return pipe
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
        if(container['cr_[terraform]']) {
            localDatabags.push(cloudTerraform('', '', prependTfStateFileName(container['cr_[terraform]'][''][0].Value!, `_gcp_project_setup_${bag.Name}`)))
        }
        return localDatabags
    }

    pipe.pushWithParams({ name: 'resources', lifecycleSteps: ['generate'] }, () => {
        return {
            databags: projectSetupResource()
        }
    })
    pipe.pushWithParams({ name: 'tf_apply', lifecycleSteps: ['apply'] }, () => {
        if(BarbeState.getObjectValue(state, CREATED_PROJECT_NAME_KEY, bag.Name)) {
            // Note: only skip in apply, generate should still happen
            return
        }
        const imports = [{
            url: TERRAFORM_EXECUTE_URL,
            input: [{
                Type: 'terraform_execute',
                Name: `gcp_setup_${bag.Name}`,
                Value: {
                    display_name: `Terraform apply - gcp_project_setup.${bag.Name}`,
                    mode: 'apply',
                    dir: `${outputDir}/gcp_project_setup_${bag.Name}`
                }
            }]
        }]
        return { imports }
    })
    pipe.pushWithParams({ name: 'save_state', lifecycleSteps: ['apply'] }, (input) => {
        //this will include the gcp_project_setups that are not in the template but not deleted by empty apply yet
        //which is ok, it's just the first run after you delete the gcp_project_setup block basically
        let databags: SugarCoatedDatabag[] = []
        const tfExecuteOutput = getHistoryItem(input.history, 'tf_apply')?.databags
        if(tfExecuteOutput?.terraform_execute_output?.[`gcp_setup_${bag.Name}`]) {
            const projectName = asStr(asVal(asVal(tfExecuteOutput.terraform_execute_output[`gcp_setup_${bag.Name}`][0].Value!)[0]).value)
            databags.push({
                Type: 'gcp_project_setup_output',
                Name: bag.Name,
                Value: {
                    project_name: projectName
                }
            })
            if(container['cr_[terraform]']) {
                databags.push(
                    BarbeState.putInObject(CREATED_PROJECT_NAME_KEY, {
                        [bag.Name]: projectName
                    }),
                )
            }
        }
        return { databags }
    })
    pipe.pushWithParams({ name: 'tf_destroy', lifecycleSteps: ['destroy'] }, () => {
        const imports = [{
            name: 'gcp_project_setup_destroy',
            url: TERRAFORM_EXECUTE_URL,
            input: [{
                Type: 'terraform_execute',
                Name: `gcp_destroy_${bag.Name}`,
                Value: {
                    display_name: `Terraform destroy - gcp_project_setup.${bag.Name}`,
                    mode: 'destroy',
                    dir: `${outputDir}/gcp_project_setup_${bag.Name}`
                }
            }]
        }]
        return { imports }
    })
    pipe.pushWithParams({ name: 'delete_state', lifecycleSteps: ['destroy'] }, () => {
        const databags = [BarbeState.deleteFromObject(CREATED_PROJECT_NAME_KEY, bag.Name)]
        return { databags }
    })
    return pipe
}

function gcpProjectSetupGetInfo(bag: Databag): Pipeline {
    let pipe = pipeline([], { name: `gcp_project_setup_get_info.${bag.Name}` })
    if(!bag.Value) {
        return pipe
    }
    const [block, _] = applyDefaults(container, bag.Value);
    if(!block.name) {
        throw new Error(`gcp_project_setup_get_info block ${bag.Name} is missing a 'name' parameter`)
    }
    const name = asStr(block.name)
    
    pipe.pushWithParams({ name: 'get_info' }, () => {
        const imports = [{
            name: `gcp_project_setup_get_info_${barbeLifecycleStep()}`,
            url: TERRAFORM_EXECUTE_URL,
            input: [{
                Type: TERRAFORM_EXECUTE_GET_OUTPUT,
                Name: `gcp_setup_get_output_${bag.Name}`,
                Value: {
                    display_name: `Terraform output - gcp_project_setup.${name}`,
                    dir: `${outputDir}/gcp_project_setup_${name}`
                }
            }]
        }]
        return { imports }
    })
    pipe.pushWithParams({ name: 'export_info' }, (input) => {
        const tfOutput = getHistoryItem(input.history, 'get_info')?.databags
        if(!tfOutput?.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`] || 
            !tfOutput?.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0] ||
            !tfOutput?.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0].Value ||
            !asVal(tfOutput?.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0].Value!)[0]) {
            return
        }
        const projectName = asStr(asVal(asVal(tfOutput?.terraform_execute_output[`gcp_setup_get_output_${bag.Name}`][0].Value!)[0]).value)
        let databags: SugarCoatedDatabag[] = [{
            Type: 'gcp_project_setup_output',
            Name: bag.Name,
            Value: {
                project_name: projectName
            }
        }]
        return { databags }
    })
    return pipe
}

const pipes = [
    ...iterateBlocks(container, GCP_PROJECT_SETUP, gcpProjectSetup),
    ...iterateBlocks(container, GCP_PROJECT_SETUP_GET_INFO, gcpProjectSetupGetInfo),
    autoDeleteMissingTfState(container, GCP_PROJECT_SETUP, (_, bagName) => ({ databags: [BarbeState.deleteFromObject(CREATED_PROJECT_NAME_KEY, bagName)] }),),
    autoCreateStateStore(container, GCP_PROJECT_SETUP, 'gcs')
]
executePipelineGroup(container, pipes)
