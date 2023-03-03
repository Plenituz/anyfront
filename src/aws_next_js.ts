import { applyDefaults, preConfCloudResourceFactory, compileBlockParam, getAwsCreds } from '../../barbe-serverless/src/barbe-sls-lib/lib';
import { readDatabagContainer, iterateBlocks, appendToTemplate, asBlock, Databag, SugarCoatedDatabag, asVal, asStr, ImportComponentInput, asTraversal, asTemplate, asFuncCall, barbeOutputDir, BarbeState, asValArrayConst, statFile, iterateAllBlocks, DatabagContainer } from '../../barbe-serverless/src/barbe-std/utils';
import { AWS_NEXT_JS, AWS_IAM_URL, AWS_LAMBDA_URL, TERRAFORM_EXECUTE_URL, AWS_S3_SYNC_FILES, AWS_S3_SYNC_URL } from './anyfront-lib/consts';
import { prependTfStateFileName, autoCreateStateStore, autoDeleteMissingTfState } from './anyfront-lib/lib';
import { AWS_IAM_LAMBDA_ROLE, AWS_FUNCTION } from '../../barbe-serverless/src/barbe-sls-lib/consts';
import { awsDomainBlockResources } from '../../barbe-serverless/src/barbe-sls-lib/helpers';
import { executePipelineGroup, Pipeline, pipeline, StepOutput, getHistoryItem, Step } from './anyfront-lib/pipeline';
import { isFailure } from '../../barbe-serverless/src/barbe-std/rpc';

const container = readDatabagContainer()
const outputDir = barbeOutputDir()

function awsNextJs(bag: Databag): Pipeline {
    let pipe = pipeline([], { name: `aws_next_js.${bag.Name}` })
    if(!bag.Value) {
        return pipe
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value)

    const dir = `aws_next_js_${bag.Name}`
    const bagPreconf = {
        dir,
        id: dir
    }
    const dotDomain = compileBlockParam(block, 'domain')
    const dotBuild = compileBlockParam(block, 'build')
    const nodeJsVersion = asStr(dotBuild.nodejs_version || block.nodejs_version || '18')

    const cloudResource = preConfCloudResourceFactory(block, 'resource', undefined, bagPreconf)
    const cloudData = preConfCloudResourceFactory(block, 'data', undefined, bagPreconf)
    const cloudOutput = preConfCloudResourceFactory(block, 'output', undefined, bagPreconf)
    const cloudProvider = preConfCloudResourceFactory(block, 'provider', undefined, bagPreconf)
    const cloudTerraform = preConfCloudResourceFactory(block, 'terraform', undefined, bagPreconf)

    const nextJsBuild = (): SugarCoatedDatabag => {
        const nodeJsVersionTag = asStr(dotBuild.nodejs_version_tag || block.nodejs_version_tag || '-slim')
        const appDir = asStr(dotBuild.app_dir || block.app_dir || '.')
        //this is there altho probably shouldnt be overriden because of how specific we need the
        //next build output to be
        const buildCmd = asStr(dotBuild.build_cmd || 'npx --yes open-next@latest build')
        let pnpmInstall = ''
        const statPnpm = statFile(`${appDir}/pnpm-lock.yaml`)
        if(!isFailure(statPnpm) && !statPnpm.result.isDir) {
            pnpmInstall = asStr(dotBuild.pnpm_install_cmd || 'npm install -g pnpm')
        }
        return {
            Type: 'buildkit_run_in_container',
            Name: `aws_next_js_${bag.Name}`,
            Value: {
                display_name: `Next.js build - ${bag.Name}`,
                excludes: [
                    'node_modules',
                    '**/node_modules',
                    outputDir
                ],
                dockerfile: `
                    FROM node:${nodeJsVersion}${nodeJsVersionTag}

                    RUN apt-get update
                    RUN apt-get install -y zip wget
                    ${pnpmInstall ? `RUN ${pnpmInstall}` : ''}

                    COPY --from=src ${appDir} /src
                    WORKDIR /src

                    RUN ${buildCmd}

                    RUN cd .open-next/server-function && zip -ryq1 /src/server-function.zip .
                    RUN cd .open-next/middleware-function && zip -ryq1 /src/middleware-function.zip . || true
                    RUN touch middleware-function.zip
                    RUN cd .open-next/image-optimization-function && zip -ryq1 /src/image-optimization-function.zip .
                `,
                exported_files: {
                    ".open-next/assets": `${dir}/assets`,
                    "server-function.zip": `${dir}/server-function.zip`,
                    "middleware-function.zip": `${dir}/middleware-function.zip`,
                    "image-optimization-function.zip": `${dir}/image-optimization-function.zip`,
                }
            }
        }
    }

    const tfDatabags = (): StepOutput => {
        let hasMiddleware = true
        let middlewareZipStat = statFile(`${outputDir}/${dir}/middleware-function.zip`)
        if(isFailure(middlewareZipStat) || middlewareZipStat.result.isDir || middlewareZipStat.result.size === 0) {
            hasMiddleware = false
        }

        const serverBehavior = (pattern: string) => ({
            path_pattern: pattern,
            allowed_methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS", "DELETE"],
            cached_methods: ["GET", "HEAD", "OPTIONS"],
            viewer_protocol_policy: "redirect-to-https",
            target_origin_id: "server",
            compress: true,
    
            cache_policy_id: asTraversal("aws_cloudfront_cache_policy.next_js_default.id"),
    
            lambda_function_association: hasMiddleware ? asBlock([{
                event_type: "viewer-request",
                lambda_arn: asTraversal("aws_function.middleware.qualified_arn"),
                include_body: false
            }]) : null,
        })

        const domainBlock = awsDomainBlockResources({
            dotDomain,
            domainValue: asTraversal("aws_cloudfront_distribution.distribution.domain_name"),
            resourcePrefix: '',
            apexHostedZoneId: asTraversal('aws_cloudfront_distribution.distribution.hosted_zone_id'),
            cloudData,
            cloudResource,
        })
        let databags: SugarCoatedDatabag[] = [
            cloudProvider('', 'aws', {
                region: block.region || os.getenv('AWS_REGION') || 'us-east-1',
            }),
            cloudResource('aws_s3_bucket', 'assets', {
                bucket: appendToTemplate(namePrefix, [`${bag.Name}-assets`]),
                force_destroy: true,
            }),
            cloudOutput('', 'assets_s3_bucket', {
                value: asTraversal('aws_s3_bucket.assets.id'),
            }),
            cloudResource('aws_s3_bucket_acl', 'assets_acl', {
                bucket: asTraversal('aws_s3_bucket.assets.id'),
                acl: 'private'
            }),
            cloudResource('aws_s3_bucket_cors_configuration', 'assets_cors', {
                bucket: asTraversal('aws_s3_bucket.assets.id'),
                cors_rule: asBlock([{
                    allowed_headers: ["*"],
                    allowed_methods: ["GET"],
                    allowed_origins: ["*"],
                    max_age_seconds: 3000
                }])
            }),
            cloudResource('aws_cloudfront_origin_access_identity', 'assets_access_id', {
                comment: asTemplate([
                    "origin access identity for ",
                    appendToTemplate(namePrefix, [`${bag.Name}-assets`])
                ])
            }),
            cloudData('aws_iam_policy_document', 'assets_policy', {
                statement: asBlock([
                    {
                        actions: ["s3:GetObject"],
                        resources: [
                            asTemplate([
                                asTraversal('aws_s3_bucket.assets.arn'),
                                "/*"
                            ])
                        ],
                        principals: asBlock([{
                            type: "AWS",
                            identifiers: [asTraversal('aws_cloudfront_origin_access_identity.assets_access_id.iam_arn')]
                        }])
                    },
                    {
                        actions: ["s3:ListBucket"],
                        resources: [asTraversal('aws_s3_bucket.assets.arn')],
                        principals: asBlock([{
                            type: "AWS",
                            identifiers: [asTraversal('aws_cloudfront_origin_access_identity.assets_access_id.iam_arn')]
                        }])
                    }
                ])
            }),
            cloudResource('aws_s3_bucket_policy', 'assets_policy', {
                bucket: asTraversal('aws_s3_bucket.assets.id'),
                policy: asTraversal('data.aws_iam_policy_document.assets_policy.json')
            }),
            cloudOutput('', 'cf_distrib', {
                value: asTraversal('aws_cloudfront_distribution.distribution.id'),
            }),
            cloudResource('aws_cloudfront_cache_policy', 'next_js_default', {
                name: appendToTemplate(namePrefix, [`${bag.Name}-default-cache-policy`]),
                default_ttl: 0,
                min_ttl: 0,
                max_ttl: 31536000, // that's 365 days
                parameters_in_cache_key_and_forwarded_to_origin: asBlock([{
                    enable_accept_encoding_brotli: true,
                    enable_accept_encoding_gzip: true,
                    cookies_config: asBlock([{
                        cookie_behavior: "all"
                    }]),
                    headers_config: asBlock([{
                        header_behavior: "whitelist",
                        headers: asBlock([{
                            items: [
                                'x-op-middleware-response-headers',
                                'x-middleware-prefetch',
                                'rsc',
                                'x-op-middleware-request-headers',
                                'next-router-prefetch',
                                'next-router-state-tree',
                                'x-nextjs-data',
                                'accept',
                            ]
                        }])
                    }]),
                    query_strings_config: asBlock([{
                        query_string_behavior: "all"
                    }])
                }])
            }),
            cloudData("aws_cloudfront_cache_policy", "caching_optimized", {
                name: "Managed-CachingOptimized",
            }),
            cloudResource('aws_cloudfront_distribution', 'distribution', {
                enabled: true,
                is_ipv6_enabled: true,
                price_class: "PriceClass_All",
    
                restrictions: asBlock([{
                    geo_restriction: asBlock([{
                        restriction_type: "none"
                    }])
                }]),
    
                origin: asBlock([
                    {
                        domain_name: asTraversal("aws_s3_bucket.assets.bucket_regional_domain_name"),
                        origin_id: "assets",
                        s3_origin_config: asBlock([{
                            origin_access_identity: asTraversal("aws_cloudfront_origin_access_identity.assets_access_id.cloudfront_access_identity_path")
                        }])
                    },
                    {
                        domain_name: asFuncCall(
                            "replace", 
                            [
                                asFuncCall( "replace", [
                                    asTraversal("aws_function.server.function_url"),
                                    "https://",
                                    ""
                                ]),
                                "/",
                                ""
                            ]
                        ),
                        origin_id: "server",
                        custom_origin_config: asBlock([{
                            http_port: 80,
                            https_port: 443,
                            origin_protocol_policy: "https-only",
                            origin_ssl_protocols: ["TLSv1.2"]
                        }]),
                    },
                    {
                        domain_name: asFuncCall(
                            "replace", 
                            [
                                asFuncCall( "replace", [
                                    asTraversal("aws_function.image-optimization.function_url"),
                                    "https://",
                                    ""
                                ]),
                                "/",
                                ""
                            ]
                        ),
                        origin_id: "image-optimization",
                        custom_origin_config: asBlock([{
                            http_port: 80,
                            https_port: 443,
                            origin_protocol_policy: "https-only",
                            origin_ssl_protocols: ["TLSv1.2"]
                        }]),
                    }
                ]),
                origin_group: asBlock([{
                    origin_id: "server-or-assets",
                    member: asBlock([
                        { origin_id: "server" },
                        { origin_id: "assets" }
                    ]),
                    failover_criteria: asBlock([{
                        status_codes: [404]
                    }])
                }]),
    
                default_cache_behavior: asBlock([{
                    allowed_methods: ["GET", "HEAD"],
                    cached_methods: ["GET", "HEAD"],
                    viewer_protocol_policy: "redirect-to-https",
                    target_origin_id: "server-or-assets",
                    compress: true,
    
                    cache_policy_id: asTraversal("aws_cloudfront_cache_policy.next_js_default.id"),
    
                    lambda_function_association: hasMiddleware ? asBlock([{
                        event_type: "viewer-request",
                        lambda_arn: asTraversal("aws_function.middleware.qualified_arn"),
                        include_body: false
                    }]) : null,
                }]),
    
                ordered_cache_behavior: asBlock([
                    serverBehavior("api/*"),
                    serverBehavior("_next/data/*"),
                    {
                        path_pattern: "_next/image*",
                        allowed_methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS", "DELETE"],
                        cached_methods: ["GET", "HEAD", "OPTIONS"],
                        viewer_protocol_policy: "redirect-to-https",
                        target_origin_id: "image-optimization",
                        compress: true,
                        cache_policy_id: asTraversal("aws_cloudfront_cache_policy.next_js_default.id"),
                    },
                    {
                        path_pattern: "_next/*",
                        allowed_methods: ["GET", "HEAD", "OPTIONS"],
                        cached_methods: ["GET", "HEAD", "OPTIONS"],
                        viewer_protocol_policy: "redirect-to-https",
                        target_origin_id: "assets",
                        compress: true,
                        cache_policy_id: asTraversal("data.aws_cloudfront_cache_policy.caching_optimized.id"),
                    }
                ]),
    
                aliases: domainBlock?.domainNames || [],
                viewer_certificate: asBlock([
                    (() => {
                        const minimumProtocolVersion = 'TLSv1.2_2021'
                        if(!domainBlock) {
                            return {
                                cloudfront_default_certificate: true
                            }
                        }
                        return {
                            acm_certificate_arn: domainBlock.certArn,
                            ssl_support_method: 'sni-only',
                            minimum_protocol_version: minimumProtocolVersion
                        }
                    })()
                ])
            })
        ]
        if(domainBlock) {
            databags.push(...domainBlock.databags)
        }
        if(container['cr_[terraform]']) {
            databags.push(cloudTerraform('', '', prependTfStateFileName(container['cr_[terraform]'][''][0].Value!, `_${AWS_NEXT_JS}_${bag.Name}`)))
        }
        let imports: ImportComponentInput[] = [
            {
                name: `aws_next_js_aws_iam_lambda_role_${bag.Name}`,
                url: AWS_IAM_URL,
                input: [{
                    Type: AWS_IAM_LAMBDA_ROLE,
                    Name: 'default',
                    Value: {
                        name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])],
                        cloudresource_dir: dir,
                        cloudresource_id: dir,
                        assumable_by: ["edgelambda.amazonaws.com", "lambda.amazonaws.com"],
                        statements: [
                            //the image optmization lambda needs to be able to read to the assets bucket
                            {
                                Action: "s3:*",
                                Effect: "Allow",
                                Resource: [
                                    asTraversal(`aws_s3_bucket.assets.arn`),
                                    asTemplate([
                                        asTraversal(`aws_s3_bucket.assets.arn`),
                                        '*'
                                    ])
                                ]
                            }
                        ]
                    }
                }]
            },
            {
                name: `aws_next_js_aws_lambda_${bag.Name}`,
                url: AWS_LAMBDA_URL,
                input: [
                    {
                        Type: AWS_FUNCTION,
                        Name: "server",
                        Value: {
                            cloudresource_dir: dir,
                            cloudresource_id: dir,
                            package: [{
                                packaged_file: "server-function.zip",
                            }],
                            handler: "index.handler",
                            runtime: `nodejs${nodeJsVersion}.x`,
                            timeout: 10,
                            memory_size: 1024,
                            architecture: 'arm64',
                            function_url_enabled: true,
                            name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])],
                        }
                    },
                    {
                        Type: AWS_FUNCTION,
                        Name: "image-optimization",
                        Value: {
                            cloudresource_dir: dir,
                            cloudresource_id: dir,
                            package: [{
                                packaged_file: "image-optimization-function.zip",
                            }],
                            environment: [{
                                BUCKET_NAME: asTraversal("aws_s3_bucket.assets.id"),
                            }],
                            handler: "index.handler",
                            runtime: `nodejs${nodeJsVersion}.x`,
                            timeout: 25,
                            memory_size: 1536,
                            architecture: 'arm64',
                            function_url_enabled: true,
                            name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])],
                        }
                    },
                    hasMiddleware ? {
                        Type: AWS_FUNCTION,
                        Name: 'middleware',
                        Value: {
                            cloudresource_dir: dir,
                            cloudresource_id: dir,
                            //these paths are scoped to the directory in which the tf template is executed, hence no ${dir} prefix
                            package: [{
                                packaged_file: 'middleware-function.zip',
                            }],
                            handler: 'index.handler',
                            runtime: `nodejs${nodeJsVersion}.x`,
                            memory_size: 128,
                            timeout: 5,
                            name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])],
                        }
                    } : null!
                ].filter(x => x)
            }
        ]
        return { databags, imports }
    }

    if(!(dotBuild.disabled && asVal(dotBuild.disabled))) {
        pipe.pushWithParams({ name: 'build', lifecycleSteps: ['generate'] }, () => {
            return {
                transforms: [nextJsBuild()]
            }
        })
    }
    pipe.pushWithParams({ name: 'resources', lifecycleSteps: ['generate'] }, () => {
        return tfDatabags()
    })
    pipe.pushWithParams({ name: 'resources_export', lifecycleSteps: ['generate'] }, (input) => {
        return {
            databags: iterateAllBlocks(input.previousStepResult, d => d)
        }
    })
    pipe.pushWithParams({ name: 'tf_apply', lifecycleSteps: ['apply'] }, () => {
        const imports = [{
            name: 'aws_cloudfront_static_hosting_apply',
            url: TERRAFORM_EXECUTE_URL,
            input: [{
                Type: 'terraform_execute',
                Name: `aws_next_js_${bag.Name}`,
                Value: {
                    display_name: `Terraform apply - aws_next_js.${bag.Name}`,
                    mode: 'apply',
                    dir: `${outputDir}/aws_next_js_${bag.Name}`,
                }
            }]
        }]
        return { imports }
    })
    pipe.pushWithParams({ name: 'upload', lifecycleSteps: ['apply'] }, (input) => {
        const terraformExecuteResults = getHistoryItem(input.history, 'tf_apply')?.databags
        if(!terraformExecuteResults?.terraform_execute_output?.[`aws_next_js_${bag.Name}`]) {
            return
        }
        const outputs = asValArrayConst(terraformExecuteResults.terraform_execute_output[`aws_next_js_${bag.Name}`][0].Value!)
        const bucketName = asStr(outputs.find(pair => asStr(pair.key) === 'assets_s3_bucket').value)
        const imports = [{
            name: `aws_next_js_${bag.Name}`,
            url: AWS_S3_SYNC_URL,
            input: [{
                Type: AWS_S3_SYNC_FILES,
                Name: `aws_next_js_${bag.Name}`,
                Value: {
                    display_name: `Uploading Next.js files - ${bag.Name}`,
                    bucket_name: bucketName,
                    delete: true,
                    dir: `${outputDir}/aws_next_js_${bag.Name}/assets`,
                    cache_control: 'max-age=31536000',
                    blob: '.'
                }
            }]
        }]
        return { imports }
    })
    pipe.pushWithParams({ name: 'invalidate', lifecycleSteps: ['apply'] }, (input) => {
        const terraformExecuteResults = getHistoryItem(input.history, 'tf_apply')?.databags
        if(!terraformExecuteResults?.terraform_execute_output?.[`aws_next_js_${bag.Name}`]) {
            return {}
        }
        const outputs = asValArrayConst(terraformExecuteResults.terraform_execute_output[`aws_next_js_${bag.Name}`][0].Value!)
        const cfDistribId = asStr(outputs.find(pair => asStr(pair.key) === 'cf_distrib').value)
        const awsCreds = getAwsCreds()
        if(!awsCreds) {
            throw new Error('couldn\'t find AWS credentials')
        }
        const transforms = [{
            Type: 'buildkit_run_in_container',
            Name: `aws_cf_static_hosting_invalidate_${bag.Name}`,
            Value: {
                no_cache: true,
                display_name: `Invalidate CloudFront distribution - aws_next_js.${bag.Name}`,
                dockerfile: `
                    FROM amazon/aws-cli:latest
    
                    ENV AWS_ACCESS_KEY_ID="${awsCreds.access_key_id}"
                    ENV AWS_SECRET_ACCESS_KEY="${awsCreds.secret_access_key}"
                    ENV AWS_SESSION_TOKEN="${awsCreds.session_token}"
                    ENV AWS_REGION="${asStr(block.region || os.getenv("AWS_REGION") || 'us-east-1')}"
                    ENV AWS_PAGER=""
    
                    RUN aws cloudfront create-invalidation --distribution-id ${cfDistribId} --paths "/*"`
            }
        }]
        return { transforms }
    })

    pipe.pushWithParams({ name: 'tf_destroy', lifecycleSteps: ['destroy'] }, () => {
        const imports = [{
            name: 'aws_cloudfront_static_hosting_destroy',
            url: TERRAFORM_EXECUTE_URL,
            input: [{
                Type: 'terraform_execute',
                Name: `aws_next_js_destroy_${bag.Name}`,
                Value: {
                    display_name: `Terraform destroy - aws_next_js.${bag.Name}`,
                    mode: 'destroy',
                    dir: `${outputDir}/aws_next_js_${bag.Name}`,
                }
            }]
        }]
        return { imports }
    })
    return pipe
}

executePipelineGroup(container, [
    ...iterateBlocks(container, AWS_NEXT_JS, awsNextJs).flat(),
    autoDeleteMissingTfState(container, AWS_NEXT_JS),
    autoCreateStateStore(container, AWS_NEXT_JS, 's3')
])