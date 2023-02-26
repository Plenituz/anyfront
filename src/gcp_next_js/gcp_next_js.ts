import { readDatabagContainer, barbeOutputDir, appendToTemplate, barbeLifecycleStep, Databag, ImportComponentInput, SugarCoatedDatabag, asBlock, iterateBlocks, asStr, asVal, asTraversal, asTemplate, asValArrayConst, iterateAllBlocks } from '../../../barbe-serverless/src/barbe-std/utils';
import { GCP_NEXT_JS, GCP_PROJECT_SETUP_URL, GCP_PROJECT_SETUP, TERRAFORM_EXECUTE_URL, GCP_PROJECT_SETUP_GET_INFO } from "../anyfront-lib/consts";
import deployed_dockerfile from './Dockerfile.dockerfile';
import { applyDefaults, compileBlockParam, getGcpToken, preConfCloudResourceFactory, applyMixins } from '../../../barbe-serverless/src/barbe-sls-lib/lib';
import { prependTfStateFileName, autoCreateStateStore, autoDeleteMissingTfState } from '../anyfront-lib/lib';
import { executePipelineGroup, pipeline, Pipeline, getHistoryItem, step } from '../anyfront-lib/pipeline';

const container = readDatabagContainer()
const outputDir = barbeOutputDir()

function gcpNextJs(bag: Databag): Pipeline {
    let pipe = pipeline([], { name: `gcp_next_js.${bag.Name}` })
    if(!bag.Value) {
        return pipe
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value)

    const dir = `gcp_next_js_${bag.Name}`
    const bagPreconf = {
        dir,
        id: dir
    }
    const dotDomain = compileBlockParam(block, 'domain')
    const dotBuild = compileBlockParam(block, 'build')
    const nodeJsVersion = asStr(dotBuild.nodejs_version || block.nodejs_version || '16')
    const imageName = asStr(appendToTemplate(namePrefix, ["next-", bag.Name]))
    const nodeJsVersionTag = asStr(dotBuild.nodejs_version_tag || block.nodejs_version_tag || '-alpine')
    const gcpToken = getGcpToken(false)

    const cloudResource = preConfCloudResourceFactory(block, 'resource', undefined, bagPreconf)
    const cloudData = preConfCloudResourceFactory(block, 'data', undefined, bagPreconf)
    const cloudOutput = preConfCloudResourceFactory(block, 'output', undefined, bagPreconf)
    const cloudProvider = preConfCloudResourceFactory(block, 'provider', undefined, bagPreconf)
    const cloudVariable = preConfCloudResourceFactory(block, 'variable', undefined, bagPreconf)
    const cloudTerraform = preConfCloudResourceFactory(block, 'terraform', undefined, bagPreconf)

    const nextJsBuild = (): SugarCoatedDatabag => {
        const nodeJsVersionTag = asStr(dotBuild.nodejs_version_tag || block.nodejs_version_tag || '-alpine')
        const appDir = asStr(dotBuild.app_dir || block.app_dir || '.')
        const installCmd = asStr(dotBuild.install_cmd || 'npm install')
        const buildCmd = asStr(dotBuild.build_cmd || 'npm run build')
        return {
            Type: 'buildkit_run_in_container',
            Name: `gcp_next_js_${bag.Name}`,
            Value: {
                display_name: `Next.js build - ${bag.Name}`,
                excludes: [
                    '**/node_modules',
                    'node_modules',
                    outputDir
                ],
                dockerfile: `
                    # https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile
                    # Rebuild the source code only when needed
                    FROM node:${nodeJsVersion}${nodeJsVersionTag} AS builder
                    RUN apk add --no-cache libc6-compat

                    WORKDIR /app
                    COPY --from=src ./${appDir} .
                    
                    ENV NEXT_TELEMETRY_DISABLED 1
                    ENV NEXT_PRIVATE_STANDALONE true
                    RUN ${installCmd}
                    RUN ${buildCmd}

                    # Production image, copy all the files and run next
                    FROM scratch
                    WORKDIR /app

                    COPY --from=builder /app/public ./public
                    COPY --from=builder /app/.next/standalone ./
                    COPY --from=builder /app/.next/static ./.next/static`,
                exported_files: {
                    '/app': `${dir}/build`
                }
            }
        }
    }

    const gcpNextJsResources = (): SugarCoatedDatabag[] => {
        let localDatabags: SugarCoatedDatabag[] = [
            cloudVariable('', 'gcp_project', {
                type: asTraversal('string'),
            }),
            cloudProvider('', 'google', {
                region: block.region || 'us-central1',
                project: asTraversal('var.gcp_project'),
            }),
            cloudResource('google_cloud_run_service', 'cloudrun', {
                name: appendToTemplate(namePrefix, [`${bag.Name}-cloudrun-srv`]),
                location: block.region || 'us-central1',
                autogenerate_revision_name: true,
                template: asBlock([{
                    spec: asBlock([{
                        containers: asBlock([{
                            image: asTemplate([
                                "gcr.io/",
                                asTraversal("var.gcp_project"),
                                "/",
                                asStr(appendToTemplate(namePrefix, [`next-${bag.Name}`])),
                                ":latest",
                            ])
                        }]),
                    }])
                }]),
                traffic: asBlock([{
                    percent: 100,
                    latest_revision: true
                }])
            }),
            cloudData('google_iam_policy', 'noauth', {
                binding: asBlock([{
                    role: "roles/run.invoker",
                    members: ["allUsers"]
                }])
            }),
            cloudResource("google_cloud_run_service_iam_policy", "noauth", {
                location: asTraversal("google_cloud_run_service.cloudrun.location"),
                service: asTraversal("google_cloud_run_service.cloudrun.name"),
                project: asTraversal("google_cloud_run_service.cloudrun.project"),
                policy_data: asTraversal("data.google_iam_policy.noauth.policy_data")
            }),
            cloudResource("google_compute_global_address", "lb_ip", {
                project: asTraversal("google_cloud_run_service.cloudrun.project"),
                name: appendToTemplate(namePrefix, [`${bag.Name}-lb-ip`])
            }),
            cloudResource("google_compute_region_network_endpoint_group", "lb_epgroup", {
                project: asTraversal("google_cloud_run_service.cloudrun.project"),
                name: appendToTemplate(namePrefix, [`${bag.Name}-lb-neg`]),
                region: block.region || 'us-central1',
                network_endpoint_type: "SERVERLESS",
                cloud_run: asBlock([{
                    service: asTraversal("google_cloud_run_service.cloudrun.name")
                }])
            }),
            cloudResource("google_compute_backend_service", "lb_backend", {
                project: asTraversal("google_cloud_run_service.cloudrun.project"),
                name: appendToTemplate(namePrefix, [`${bag.Name}-lb-backend`]),
                load_balancing_scheme: "EXTERNAL_MANAGED",
                enable_cdn: true,

                backend: asBlock([{
                    balancing_mode: "UTILIZATION",
                    capacity_scaler: 0.85,
                    group: asTraversal("google_compute_region_network_endpoint_group.lb_epgroup.id")
                }]),
                cdn_policy: asBlock([{
                    cache_mode: "CACHE_ALL_STATIC",
                    client_ttl: 3600,
                    default_ttl: 3600,
                    max_ttl: 86400,
                    negative_caching: true,
                    serve_while_stale: 86400,
                    signed_url_cache_max_age_sec: 7200,
                }])
            }),
            cloudResource("google_compute_url_map", "lb_urlmap", {
                project: asTraversal("google_cloud_run_service.cloudrun.project"),
                name: appendToTemplate(namePrefix, [`${bag.Name}-lb-urlmap`]),
                default_service: asTraversal("google_compute_backend_service.lb_backend.id"),

                path_matcher: asBlock([{
                    name: "allpaths",
                    default_service: asTraversal("google_compute_backend_service.lb_backend.id"),
                    route_rules: asBlock([{
                        priority: 1,
                        url_redirect: asBlock([{
                            https_redirect: true,
                            redirect_response_code: "MOVED_PERMANENTLY_DEFAULT",
                        }])
                    }])
                }])
            }),
            cloudOutput('', "load_balancer_ip_addr", {
                value: asTraversal("google_compute_global_address.lb_ip.address")
            }),
            cloudOutput('', "load_balancer_url_map", {
                value: asTraversal("google_compute_url_map.lb_urlmap.name")
            }),
            cloudOutput('', "cloudrun_service_name", {
                value: asTraversal("google_cloud_run_service.cloudrun.name")
            }),
        ]
        if(dotDomain.name) {
            localDatabags.push(
                cloudResource("google_compute_target_https_proxy", "lb_target_https", {
                    project: asTraversal("google_cloud_run_service.cloudrun.project"),
                    name: appendToTemplate(namePrefix, [`${bag.Name}-https-proxy`]),
                    url_map: asTraversal("google_compute_url_map.lb_urlmap.id"),
                    ssl_certificates: [asTraversal("google_compute_managed_ssl_certificate.lb_ssl_cert.name")]
                }),
                cloudResource("google_compute_global_forwarding_rule", "lb_forwarding", {
                    project: asTraversal("google_cloud_run_service.cloudrun.project"),
                    name: appendToTemplate(namePrefix, [`${bag.Name}-lb-forwarding`]),
                    load_balancing_scheme: "EXTERNAL_MANAGED",
                    target: asTraversal("google_compute_target_https_proxy.lb_target_https.id"),
                    ip_address: asTraversal("google_compute_global_address.lb_ip.id"),
                    port_range: "443"
                }),
                cloudResource("google_compute_url_map", "lb_redirect_to_https", {
                    project: asTraversal("google_cloud_run_service.cloudrun.project"),
                    name: appendToTemplate(namePrefix, [`${bag.Name}-lb-redirect-to-https-urlmap`]),

                    default_url_redirect: asBlock([{
                        redirect_response_code: "MOVED_PERMANENTLY_DEFAULT",
                        https_redirect: true,
                        strip_query: false,
                    }])
                }),
                cloudResource("google_compute_target_http_proxy", "lb_target_http", {
                    project: asTraversal("google_cloud_run_service.cloudrun.project"),
                    name: appendToTemplate(namePrefix, [`${bag.Name}-http-proxy`]),
                    url_map: asTraversal("google_compute_url_map.lb_redirect_to_https.id")
                }),
                cloudResource("google_compute_global_forwarding_rule", "lb_http_forwarding", {
                    project: asTraversal("google_cloud_run_service.cloudrun.project"),
                    name: appendToTemplate(namePrefix, [`${bag.Name}-http-forwarding`]),
                    target: asTraversal("google_compute_target_http_proxy.lb_target_http.id"),
                    ip_address: asTraversal("google_compute_global_address.lb_ip.id"),
                    port_range: "80"
                }),
                cloudResource("google_compute_managed_ssl_certificate", "lb_ssl_cert", {
                    project: asTraversal("google_cloud_run_service.cloudrun.project"),
                    name: appendToTemplate(namePrefix, [`${bag.Name}-lb-ssl-cert`]),
                    managed: asBlock([{
                        domains: [appendToTemplate(dotDomain.name, ['.'])]
                    }])
                }),
                cloudResource("google_dns_record_set", "lb_dns", {
                    project: dotDomain.zone_project || asTraversal("google_cloud_run_service.cloudrun.project"),
                    name: appendToTemplate(dotDomain.name, ['.']),
                    type: "A",
                    ttl: 300,
                    managed_zone: dotDomain.zone,
                    rrdatas: [asTraversal("google_compute_global_address.lb_ip.address")]
                }),
            )
        } else {
            localDatabags.push(
                cloudResource("google_compute_target_http_proxy", "lb_target_http", {
                    project: asTraversal("google_cloud_run_service.cloudrun.project"),
                    name: appendToTemplate(namePrefix, [`${bag.Name}-http-proxy`]),
                    url_map: asTraversal("google_compute_url_map.lb_urlmap.id")
                }),
                cloudResource("google_compute_global_forwarding_rule", "lb_http_forwarding", {
                    project: asTraversal("google_cloud_run_service.cloudrun.project"),
                    name: appendToTemplate(namePrefix, [`${bag.Name}-http-forwarding`]),
                    load_balancing_scheme: "EXTERNAL_MANAGED",
                    target: asTraversal("google_compute_target_http_proxy.lb_target_http.id"),
                    ip_address: asTraversal("google_compute_global_address.lb_ip.id"),
                    port_range: "80"
                }),
            )
        }
        console.log('dsfsdfg', JSON.stringify(container['cr_[terraform]']))
        if(container['cr_[terraform]']) {
            localDatabags.push(cloudTerraform('', '', prependTfStateFileName(container['cr_[terraform]'][''][0].Value!, `_${GCP_NEXT_JS}_${bag.Name}`)))
        }
        return localDatabags
    }

    if(!(dotBuild.disabled && asVal(dotBuild.disabled))) {
        pipe.pushWithParams({ name: 'build', lifecycleSteps: ['generate'] }, () => {
            return {
                transforms: [nextJsBuild()]
            }
        })
    }
    pipe.pushWithParams({ name: 'resources', lifecycleSteps: ['generate'] }, () => {
        return {
            databags: gcpNextJsResources()
        }
    })
    pipe.pushWithParams({ name: 'gcp_project_setup_get_info', lifecycleSteps: ['destroy'] }, () => {
        const imports = [{
            name: 'gcp_next_js_get_project_info_destroy',
            url: GCP_PROJECT_SETUP_URL,
            input: [{
                Type: GCP_PROJECT_SETUP_GET_INFO,
                Name: `gcp_next_js_get_info_${bag.Name}`,
                Value: {
                    name: bag.Name
                }
            }]
        }]
        return { imports }
    })
    pipe.pushWithParams({ name: 'tf_destroy', lifecycleSteps: ['destroy'] }, (input) => {
        const gcpProjectSetupResults = getHistoryItem(input.history, 'gcp_project_setup_get_info')?.databags
        if(!gcpProjectSetupResults?.gcp_project_setup_output[`gcp_next_js_get_info_${bag.Name}`]) {
            return
        }
        const gcpProjectName = asStr(asVal(gcpProjectSetupResults.gcp_project_setup_output[`gcp_next_js_get_info_${bag.Name}`][0].Value!).project_name)
        const imports = [{
            url: TERRAFORM_EXECUTE_URL,
            input: [{
                Type: 'terraform_execute',
                Name: `gcp_next_js_destroy_${bag.Name}`,
                Value: {
                    display_name: `Terraform destroy - gcp_next_js.${bag.Name}`,
                    mode: 'destroy',
                    dir: `${outputDir}/gcp_next_js_${bag.Name}`,
                    variable_values: [{
                        key: "gcp_project",
                        value: gcpProjectName
                    }]
                }
            }]
        }]
        return { imports }
    })
    pipe.pushWithParams({ name: 'gcp_project_setup', lifecycleSteps: ['generate', 'apply', 'post_apply', 'destroy', 'post_destroy'] }, () => {
        return {
            imports: [{
                url: GCP_PROJECT_SETUP_URL,
                copyFromContainer: ["cr_[terraform]"],
                input: [{
                    Type: GCP_PROJECT_SETUP,
                    Name: bag.Name,
                    Value: {
                        project_id: block.project_id,
                        project_name: appendToTemplate(namePrefix, [bag.Name]),
                        organization_id: block.organization_id,
                        billing_account_id: block.billing_account_id,
                        billing_account_name: block.billing_account_name,
                        services_to_activate: [
                            "run.googleapis.com",
                            "compute.googleapis.com",
                            "dns.googleapis.com",
                        ]
                    }
                }]
            }]
        }
    })
    pipe.pushWithParams({ name: 'gcp_project_setup_export', lifecycleSteps: ['generate', 'apply', 'destroy'] }, (input) => {
        return {
            databags: iterateAllBlocks(input.previousStepResult, b => b)
        }
    })
    pipe.pushWithParams({ name: 'build_img', lifecycleSteps: ['apply'] }, (input) => {
        const gcpProjectSetupResults = getHistoryItem(input.history, 'gcp_project_setup')?.databags
        if(!gcpProjectSetupResults?.gcp_project_setup_output?.[bag.Name]) {
            return
        }
        const gcpProjectName = asStr(asVal(gcpProjectSetupResults.gcp_project_setup_output[bag.Name][0].Value!).project_name)
        const absoluteDir = `${outputDir}/${dir}`
        const buildDir = `${absoluteDir}/build`
        const gcpNginxImageBuild = {
            Type: 'buildkit_run_in_container',
            Name: `${bag.Name}_gcp_next_js`,
            Value: {
                display_name: `Image build - gcp_next_js.${bag.Name}`,
                no_cache: true,
                input_files: {
                    '__barbe_Dockerfile': applyMixins(deployed_dockerfile, {
                        node_version: nodeJsVersion,
                        node_version_tag: nodeJsVersionTag,
                    }),
                },
                dockerfile: `
                    FROM docker
    
                    RUN echo "${gcpToken}" | docker login -u oauth2accesstoken --password-stdin https://gcr.io
    
                    COPY --from=src ./${buildDir} /src
                    WORKDIR /src
    
                    RUN mkdir __barbe_tmp
                    COPY --from=src __barbe_Dockerfile ./__barbe_tmp/Dockerfile
    
                    RUN --mount=type=ssh,id=docker.sock,target=/var/run/docker.sock docker build -f __barbe_tmp/Dockerfile -t gcr.io/${gcpProjectName}/${imageName} .
                    RUN --mount=type=ssh,id=docker.sock,target=/var/run/docker.sock docker push gcr.io/${gcpProjectName}/${imageName}`,
            }
        }
        return {
            transforms: [gcpNginxImageBuild],
        }
    })

    pipe.pushWithParams({ name: 'tf_apply', lifecycleSteps: ['apply'] }, (input) => {
        const gcpProjectSetupResults = getHistoryItem(input.history, 'gcp_project_setup')?.databags
        if(!gcpProjectSetupResults?.gcp_project_setup_output?.[bag.Name]) {
            return
        }
        const absoluteDir = `${outputDir}/${dir}`
        const gcpProjectName = asStr(asVal(gcpProjectSetupResults.gcp_project_setup_output[bag.Name][0].Value!).project_name)
        const tfExecute: ImportComponentInput = {
            url: TERRAFORM_EXECUTE_URL,
            input: [{
                Type: 'terraform_execute',
                Name: `gcp_next_js_apply_${bag.Name}`,
                Value: {
                    display_name: `Terraform apply - gcp_next_js.${bag.Name}`,
                    mode: 'apply',
                    dir: absoluteDir,
                    variable_values: [{
                        key: 'gcp_project',
                        value: gcpProjectName
                    }]
                }
            }]
        }
        return {
            imports: [tfExecute]
        }
    })
    pipe.pushWithParams({ name: 'invalidate', lifecycleSteps: ['apply'] }, (input) => {
        const gcpProjectSetupResults = getHistoryItem(input.history, 'gcp_project_setup')?.databags
        const terraformExecuteResults = getHistoryItem(input.history, 'tf_apply')?.databags
        if(!terraformExecuteResults?.terraform_execute_output?.[`gcp_next_js_apply_${bag.Name}`]) {
            return
        }
        if(!gcpProjectSetupResults?.gcp_project_setup_output?.[bag.Name]) {
            return
        }
        const tfOutput = asValArrayConst(terraformExecuteResults.terraform_execute_output[`gcp_next_js_apply_${bag.Name}`][0].Value!)
        const cloudrunServiceName = asStr(tfOutput.find(pair => asStr(pair.key) === 'cloudrun_service_name').value)
        const urlMapName = asStr(tfOutput.find(pair => asStr(pair.key) === 'load_balancer_url_map').value)
        const gcpProjectName = asStr(asVal(gcpProjectSetupResults.gcp_project_setup_output[bag.Name][0].Value!).project_name)
        const region = asStr(block.region || 'us-central1')
    
        const transforms = [{
            Type: 'buildkit_run_in_container',
            Name: `gcp_next_js_invalidate_${bag.Name}`,
            Value: {
                display_name: `Invalidate CDN - gcp_next_js.${bag.Name}`,
                no_cache: true,
                dockerfile: `
                FROM google/cloud-sdk:slim
    
                ENV CLOUDSDK_AUTH_ACCESS_TOKEN="${gcpToken}"
                ENV CLOUDSDK_CORE_DISABLE_PROMPTS=1
    
                RUN gcloud run deploy ${cloudrunServiceName} --image gcr.io/${gcpProjectName}/${imageName} --project ${gcpProjectName} --region ${region} --quiet
                RUN gcloud beta compute url-maps invalidate-cdn-cache ${urlMapName} --path "/*" --project ${gcpProjectName} --async --quiet`
            }
        }]
        return { transforms }
    })
    return pipe
}

const pipes = [
    ...iterateBlocks(container, GCP_NEXT_JS, gcpNextJs).flat(),
    autoDeleteMissingTfState(container, GCP_NEXT_JS),
    autoCreateStateStore(container, GCP_NEXT_JS, 'gcs')
]
if(container['cr_[terraform]'] && !container[GCP_NEXT_JS]) {
    //no gcp_next_js blocks, but there might have been some in the past so we run an empty gcp_project_setup
    pipes.push(pipeline([
        step(() => ({
            imports: [{
                url: GCP_PROJECT_SETUP_URL,
                copyFromContainer: ["cr_[terraform]"],
                input: []
            }]
        }))
    ]))
}

executePipelineGroup(container, pipes)