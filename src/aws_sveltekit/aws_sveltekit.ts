import { applyDefaults, compileBlockParam, getAwsCreds, preConfCloudResourceFactory } from "../../../barbe-serverless/src/barbe-sls-lib/lib"
import { readDatabagContainer, barbeOutputDir, Databag, SugarCoatedDatabag, appendToTemplate, asTraversal, asBlock, asTemplate, asFuncCall, throwStatement, allGenerateSteps, ImportComponentInput, SyntaxToken, asSyntax, asStr, statFile, asVal, iterateBlocks, exportDatabags, asValArrayConst } from '../../../barbe-serverless/src/barbe-std/utils';
import { AWS_IAM_URL, AWS_LAMBDA_URL, AWS_SVELTEKIT, TERRAFORM_EXECUTE_URL, AWS_S3_SYNC_URL, AWS_S3_SYNC_FILES } from '../anyfront-lib/consts';
import { autoCreateStateStore, autoDeleteMissingTfState, prependTfStateFileName } from "../anyfront-lib/lib"
import { Pipeline, pipeline, executePipelineGroup, getHistoryItem } from '../anyfront-lib/pipeline';
import { AWS_FUNCTION, AWS_IAM_LAMBDA_ROLE } from '../../../barbe-serverless/src/barbe-sls-lib/consts';
import svelteConfigJs from './svelte.config.template.js'
import { awsDomainBlockResources } from '../../../barbe-serverless/src/barbe-sls-lib/helpers';

const container = readDatabagContainer()
const outputDir = barbeOutputDir()

function awsSveltekit(bag: Databag): Pipeline[] {
    if(!bag.Value) {
        return []
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value)
    const pipe = pipeline([], { name: `aws_sveltekit.${bag.Name}` })
    const dotBuild = compileBlockParam(block, 'build')
    const dotDomain = compileBlockParam(block, 'domain')
    const nodeJsVersion = asStr(dotBuild.nodejs_version || block.nodejs_version || '16')

    const dir = `aws_sveltekit_${bag.Name}`
    const bagPreconf = {
        dir,
        id: dir
    }
    const cloudResource = preConfCloudResourceFactory(block, 'resource', undefined, bagPreconf)
    const cloudData = preConfCloudResourceFactory(block, 'data', undefined, bagPreconf)
    const cloudOutput = preConfCloudResourceFactory(block, 'output', undefined, bagPreconf)
    const cloudProvider = preConfCloudResourceFactory(block, 'provider', undefined, bagPreconf)
    const cloudTerraform = preConfCloudResourceFactory(block, 'terraform', undefined, bagPreconf)

    const sveltekitBuild = (): SugarCoatedDatabag => {
        const nodeJsVersionTag = asStr(dotBuild.nodejs_version_tag || block.nodejs_version_tag || '-slim')
        const appDir = asStr(dotBuild.app_dir || block.app_dir || '.')
        const installCmd = asStr(dotBuild.install_cmd || 'npm install')
        const buildCmd = asStr(dotBuild.build_cmd || 'npm run build')
        let svelteConfigJs = os.file.readFile(`${appDir}/svelte.config.js`)
        svelteConfigJs = svelteConfigJs.replace('export default ', 'const customer_svelteConfig = ')
        svelteConfigJs += `
        import __barbe_adapter from '@yarbsemaj/adapter-lambda'
        if(!customer_svelteConfig.kit) customer_svelteConfig.kit = {}
        customer_svelteConfig.kit.adapter = __barbe_adapter()
        if(!customer_svelteConfig.kit.csrf) customer_svelteConfig.kit.csrf = {}
        customer_svelteConfig.kit.csrf.checkOrigin = false
        export default customer_svelteConfig
        `
        return {
            Type: 'buildkit_run_in_container',
            Name: `aws_sveltekit_${bag.Name}`,
            Value: {
                display_name: `SvelteKit build - ${bag.Name}`,
                no_cache: true,
                excludes: [
                    'node_modules',
                    '**/node_modules',
                    '.svelte-kit',
                    outputDir
                ],
                input_files: {
                    'svelte.config.js': svelteConfigJs,
                },
                dockerfile: `
                    FROM node:${nodeJsVersion}${nodeJsVersionTag}

                    RUN apt-get update
                    RUN apt-get install -y zip

                    COPY --from=src ${appDir} /src
                    WORKDIR /src

                    RUN ${installCmd}
                    RUN npm install -D @yarbsemaj/adapter-lambda
                    COPY --from=src svelte.config.js svelte.config.js
                    RUN npx svelte-kit sync
                    RUN ${buildCmd}

                    RUN mkdir -p __barbe_next/static
                    RUN cd build/server && zip -ryq1 /src/__barbe_next/server.zip .
                    # static.js is already baked into router.js
                    RUN rm build/edge/static.js
                    RUN cd build/edge && zip -ryq1 /src/__barbe_next/edge.zip .

                    # these might fail if the directories are empty, hence the "|| true"
                    RUN mv build/assets/* __barbe_next/static/. || true
                    RUN mv build/prerendered/* __barbe_next/static/. || true
                `,
                exported_files: {
                    "__barbe_next/edge.zip": `${dir}/edge.zip`,
                    "__barbe_next/static": `${dir}/static`,
                    "__barbe_next/server.zip": `${dir}/server.zip`,
                }
            }
        }
    }

    const makeResources = (): SugarCoatedDatabag[] => {
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
            // cloudResource('aws_cloudfront_origin_access_control', 'assets_access', {
            //     name: appendToTemplate(namePrefix, [`${bag.Name}-oac`]),
            //     description: asTemplate([
            //         "origin access control for ",
            //         appendToTemplate(namePrefix, [`${bag.Name}-assets`])
            //     ]),
            //     origin_access_control_origin_type: 's3',
            //     signing_behavior: 'always',
            //     signing_protocol: 'sigv4'
            // }),
            //bucket has to be public, until this changes: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-event-structure.html
            //"You can't use an OAI when you change the request from a custom origin to an Amazon S3 origin."
            //and "This field does not support origin access control (OAC)."
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
                            type: "*",
                            identifiers: ['*']
                        }]),
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
            cloudResource('aws_cloudfront_cache_policy', 'default_cache_policy', {
                name: appendToTemplate(namePrefix, [`${bag.Name}-default-cache-policy`]),
                default_ttl: 0,
                max_ttl: 31536000, // that's 365 days
                min_ttl: 0,
                parameters_in_cache_key_and_forwarded_to_origin: asBlock([{
                    enable_accept_encoding_brotli: true,
                    enable_accept_encoding_gzip: true,
                    cookies_config: asBlock([{
                        cookie_behavior: "all"
                    }]),
                    headers_config: asBlock([{
                        header_behavior: "none",
                    }]),
                    query_strings_config: asBlock([{
                        query_string_behavior: "all"
                    }])
                }])
            }),
            cloudData("aws_cloudfront_origin_request_policy", "s3_cors", {
                name: "Managed-CORS-S3Origin",
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
                    //this isnt needed until OAC are supported
                    //also we cant use an origin group because they dont supports POST/PUT/DELETE
                    // {
                    //     domain_name: asTraversal("aws_s3_bucket.assets.bucket_regional_domain_name"),
                    //     origin_id: "assets",
                    //     origin_access_control_id: asTraversal("aws_cloudfront_origin_access_control.assets_access.id"),
                    // },
                    {
                        domain_name: asFuncCall(
                            "replace", 
                            [
                                asFuncCall( "replace", [
                                    asTraversal("aws_function.origin-server.function_url"),
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
                            origin_ssl_protocols: ["SSLv3"]
                        }]),
                        custom_header: asBlock([
                            {
                                name: "s3-host",
                                value: asTraversal("aws_s3_bucket.assets.bucket_regional_domain_name")
                            }
                        ])
                    }
                ]),
    
                default_cache_behavior: asBlock([{
                    allowed_methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS", "DELETE"],
                    cached_methods: ["GET", "HEAD", "OPTIONS"],
                    viewer_protocol_policy: "redirect-to-https",
                    target_origin_id: "server",
                    compress: true,
    
                    cache_policy_id: asTraversal("data.aws_cloudfront_cache_policy.caching_optimized.id"),
                    origin_request_policy_id: asTraversal("data.aws_cloudfront_origin_request_policy.s3_cors.id"),

                    lambda_function_association: asBlock([{
                        event_type: "origin-request",
                        lambda_arn: asTraversal("aws_function.origin-request.qualified_arn"),
                        include_body: false
                    }]),
                }]),
    
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
        return databags
    }

    pipe.pushWithParams({ name: 'resources', lifecycleSteps: allGenerateSteps }, () => {
        let databags = makeResources()
        if(container['cr_[terraform]']) {
            databags.push(cloudTerraform('', '', prependTfStateFileName(container['cr_[terraform]'][''][0].Value!, `_${AWS_SVELTEKIT}_${bag.Name}`)))
        }
        let transforms: SugarCoatedDatabag[] = []
        const imports: ImportComponentInput[] = [
            {
                name: `aws_sveltekit_aws_iam_lambda_role_${bag.Name}`,
                url: AWS_IAM_URL,
                input: [{
                    Type: AWS_IAM_LAMBDA_ROLE,
                    Name: 'default',
                    Value: {
                        name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])],
                        cloudresource_dir: dir,
                        cloudresource_id: dir,
                        assumable_by: ["edgelambda.amazonaws.com", "lambda.amazonaws.com"],
                    }
                }]
            },
            {
                name: `aws_sveltekit_aws_lambda_${bag.Name}`,
                url: AWS_LAMBDA_URL,
                input: [
                    {
                        Type: AWS_FUNCTION,
                        Name: 'origin-request',
                        Value: {
                            cloudresource_dir: dir,
                            cloudresource_id: dir,
                            //these paths are scoped to the directory in which the tf template is executed, hence no ${dir} prefix
                            package: [{
                                packaged_file: 'edge.zip',
                            }],
                            handler: 'router.handler',
                            runtime: `nodejs${nodeJsVersion}.x`,
                            timeout: 3,
                            name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])],
                        }
                    },
                    {
                        Type: "aws_function",
                        Name: "origin-server",
                        Value: {
                            cloudresource_dir: dir,
                            cloudresource_id: dir,
                            package: [{
                                packaged_file: "server.zip",
                            }],
                            handler: "serverless.handler",
                            runtime: `nodejs${nodeJsVersion}.x`,
                            timeout: 10,
                            memory_size: 1024,
                            function_url_enabled: true,
                            name_prefix: [appendToTemplate(namePrefix, [`${bag.Name}-`])],
                        }
                    }
                ]
            }
        ]
        if(!(dotBuild.disabled && asVal(dotBuild.disabled))) {
            transforms.push(sveltekitBuild())
        }
        return { databags, imports, transforms }
    })
    //export the aws_lambda and aws_iam_lambda_role stuff
    pipe.pushWithParams({ name: 'export', lifecycleSteps: allGenerateSteps }, input => exportDatabags(input.previousStepResult))

    pipe.pushWithParams({ name: 'destroy_tf', lifecycleSteps: ['destroy'] }, () => {
        let imports: ImportComponentInput[] = [{
            url: TERRAFORM_EXECUTE_URL,
            input: [{
                Type: 'terraform_execute',
                Name: `aws_sveltekit_${bag.Name}_destroy`,
                Value: {
                    display_name: `Terraform destroy - aws_sveltekit.${bag.Name}`,
                    mode: 'destroy',
                    dir: `${outputDir}/${dir}`,
                }
            }]
        }]
        return { imports }
    })
    pipe.pushWithParams({ name: 'apply_tf', lifecycleSteps: ['apply'] }, () => {
        let imports: ImportComponentInput[] = [{
            url: TERRAFORM_EXECUTE_URL,
            input: [{
                Type: 'terraform_execute',
                Name: `aws_sveltekit_${bag.Name}_apply`,
                Value: {
                    display_name: `Terraform apply - aws_sveltekit.${bag.Name}`,
                    mode: 'apply',
                    dir: `${outputDir}/${dir}`,
                }
            }]
        }]
        return { imports }
    })

    pipe.pushWithParams({ name: 'upload', lifecycleSteps: ['apply'] }, (input) => {
        if(!input.previousStepResult.terraform_execute_output?.[`aws_sveltekit_${bag.Name}_apply`]) {
            return
        }
        const outputs = asValArrayConst(input.previousStepResult.terraform_execute_output[`aws_sveltekit_${bag.Name}_apply`][0].Value!)
        const bucketName = asStr(outputs.find(pair => asStr(pair.key) === 'assets_s3_bucket').value)
        let imports: ImportComponentInput[] = [{
            name: `aws_sveltekit_${bag.Name}`,
            url: AWS_S3_SYNC_URL,
            input: [{
                Type: AWS_S3_SYNC_FILES,
                Name: `aws_sveltekit_${bag.Name}`,
                Value: {
                    display_name: `Uploading SvelteKit files - ${bag.Name}`,
                    bucket_name: bucketName,
                    delete: true,
                    dir: `${outputDir}/${dir}/static`,
                    blob: '.',
                    cache_control: 'max-age=31536000',
                }
            }]
        }]
        return { imports }
    })

    pipe.pushWithParams({ name: 'invalidate', lifecycleSteps: ['apply'] }, (input) => {
        const prev = getHistoryItem(input.history, 'apply_tf')?.databags
        if(!prev?.terraform_execute_output?.[`aws_sveltekit_${bag.Name}_apply`]) {
            return
        }
        const awsCreds = getAwsCreds()
        if(!awsCreds) {
            throw new Error('couldn\'t find AWS credentials')
        }
        const outputs = asValArrayConst(prev.terraform_execute_output[`aws_sveltekit_${bag.Name}_apply`][0].Value!)
        const cfDistribId = asStr(outputs.find(pair => asStr(pair.key) === 'cf_distrib').value)
        let transforms = [{
            Type: 'buildkit_run_in_container',
            Name: `aws_sveltekit_invalidate_${bag.Name}`,
            Value: {
                no_cache: true,
                display_name: `Invalidate CloudFront distribution - aws_sveltekit.${bag.Name}`,
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

    return [pipe]
}

executePipelineGroup(container, [
    ...iterateBlocks(container, AWS_SVELTEKIT, awsSveltekit).flat(),
    autoDeleteMissingTfState(container, AWS_SVELTEKIT),
    autoCreateStateStore(container, AWS_SVELTEKIT, 's3')
])
