import { applyDefaults, preConfCloudResourceFactory, compileBlockParam, getAwsCreds } from '../../barbe-serverless/src/barbe-sls-lib/lib';
import { readDatabagContainer, barbeLifecycleStep, iterateBlocks, appendToTemplate, asBlock, exportDatabags, Databag, SugarCoatedDatabag, asSyntax, asVal, SyntaxToken, asStr, ImportComponentInput, asTraversal, asTemplate, asFuncCall, importComponents, barbeOutputDir, BarbeState, DatabagContainer, asValArrayConst, throwStatement, applyTransformers } from '../../barbe-serverless/src/barbe-std/utils';
import { AWS_NEXT_JS, AWS_IAM_URL, AWS_LAMBDA_URL, TERRAFORM_EXECUTE_URL, AWS_S3_SYNC_FILES, AWS_S3_SYNC_URL } from './anyfront-lib/consts';
import { prependTfStateFileName, DBAndImport, emptyExecuteTemplate, emptyExecutePostProcess, guessAwsDnsZoneBasedOnDomainName } from './anyfront-lib/lib';
import { AWS_IAM_LAMBDA_ROLE, AWS_FUNCTION } from '../../barbe-serverless/src/barbe-sls-lib/consts';
import { awsDomainBlockResources } from '../../barbe-serverless/src/barbe-sls-lib/helpers';

const container = readDatabagContainer()
const outputDir = barbeOutputDir()
const state = BarbeState.readState()
const CREATED_TF_STATE_KEY = 'created_tfstate'

function makeEmptyExecuteDatabags(container: DatabagContainer, state: any): SugarCoatedDatabag[] {
    if(!container['cr_[terraform]']) {
        return []
    }
    //only add empty execute if we have a terraform block
    //because this component gets called multiple times with no real input
    //and we dont want to delete the gcp_project_setup everytime that happens
    return emptyExecuteTemplate(container, state, AWS_NEXT_JS, CREATED_TF_STATE_KEY)
}

function preGenerate() {
    if(container.state_store) {
        return
    }

    const databags = iterateBlocks(container, AWS_NEXT_JS, (bag) => {
        const [block, namePrefix] = applyDefaults(container, bag.Value!)
        return {
            Type: 'state_store',
            Name: '',
            Value: {
                name_prefix: [`${bag.Name}-`],
                s3: asBlock([{}])
            }
        }
    })
    exportDatabags(databags)
}

function generateIterator1(bag: Databag): DBAndImport[] {
    if(!bag.Value) {
        return []
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
        const installCmd = asStr(dotBuild.install_cmd || 'npm install')
        //this is there altho probably shouldnt be overriden because of how specific we need the
        //next build output to be
        const buildCmd = asStr(dotBuild.build_cmd || 'npx --yes open-next@latest build')
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
                    RUN apt-get install -y zip

                    COPY --from=src ${appDir} /src
                    WORKDIR /src

                    RUN ${installCmd}
                    RUN ${buildCmd}

                    RUN cd .open-next/server-function && zip -ryq1 /src/server-function.zip .
                    RUN cd .open-next/middleware-function && zip -ryq1 /src/middleware-function.zip .
                    RUN cd .open-next/image-optimization-function && zip -ryq1 /src/image-optimization-function.zip .
                `,
                exported_files: {
                    "/src/.open-next/assets": `${dir}/assets`,
                    "/src/server-function.zip": `${dir}/server-function.zip`,
                    "/src/middleware-function.zip": `${dir}/middleware-function.zip`,
                    "/src/image-optimization-function.zip": `${dir}/image-optimization-function.zip`,
                }
            }
        }
    }

    const serverBehavior = (pattern: string) => ({
        path_pattern: pattern,
        allowed_methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS", "DELETE"],
        cached_methods: ["GET", "HEAD", "OPTIONS"],
        viewer_protocol_policy: "redirect-to-https",
        target_origin_id: "server",
        compress: true,

        cache_policy_id: asTraversal("aws_cloudfront_cache_policy.next_js_default.id"),

        lambda_function_association: asBlock([{
            event_type: "viewer-request",
            lambda_arn: asTraversal("aws_function.middleware.qualified_arn"),
            include_body: false
        }]),
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

                lambda_function_association: asBlock([{
                    event_type: "viewer-request",
                    lambda_arn: asTraversal("aws_function.middleware.qualified_arn"),
                    include_body: false
                }]),
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
                },
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
                }
            ]
        }
    ]
    if(!(dotBuild.disabled && asVal(dotBuild.disabled))) {
        databags.push(nextJsBuild())
    }
    if(container['cr_[terraform]']) {
        databags.push(cloudTerraform('', '', prependTfStateFileName(container, `_aws_next_js_${bag.Name}`)))
    }
    return [{ databags, imports }]
}

function generate() {
    const dbOrImports = iterateBlocks(container, AWS_NEXT_JS, generateIterator1).flat()
    exportDatabags(dbOrImports.map(db => db.databags).flat())
    exportDatabags(importComponents(container, dbOrImports.map(db => db.imports).flat()))
}

function applyIterator1(bag: Databag): SugarCoatedDatabag[] {
    if(!bag.Value) {
        return []
    }
    return [{
        Type: 'terraform_execute',
        Name: `aws_next_js_${bag.Name}`,
        Value: {
            display_name: `Terraform apply - aws_next_js.${bag.Name}`,
            mode: 'apply',
            dir: `${outputDir}/aws_next_js_${bag.Name}`,
        }
    }]
}

const applyIterator2 = (terraformExecuteResults: DatabagContainer) => (bag: Databag): DBAndImport[] => {
    if(!bag.Value) {
        return []
    }
    let databags: SugarCoatedDatabag[] = []
    if(container['cr_[terraform]']){
        databags.push(
            BarbeState.putInObject(CREATED_TF_STATE_KEY, {
                [bag.Name]: prependTfStateFileName(container, `_aws_next_js_${bag.Name}`)
            })
        )
    }
    let imports: ImportComponentInput[] = []
    if(terraformExecuteResults.terraform_execute_output?.[`aws_next_js_${bag.Name}`]) {
        const outputs = asValArrayConst(terraformExecuteResults.terraform_execute_output[`aws_next_js_${bag.Name}`][0].Value!)
        const bucketName = asStr(outputs.find(pair => asStr(pair.key) === 'assets_s3_bucket').value)
        imports.push({
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
                    blob: '.'
                }
            }]
        })
    }
    return [{ databags, imports }]
}

const applyIterator3 = (terraformExecuteResults: DatabagContainer) => (bag: Databag): SugarCoatedDatabag[] => {
    if(!bag.Value) {
        return []
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value)

    
    if(!terraformExecuteResults.terraform_execute_output?.[`aws_next_js_${bag.Name}`]) {
        return []
    }
    const outputs = asValArrayConst(terraformExecuteResults.terraform_execute_output[`aws_next_js_${bag.Name}`][0].Value!)
    const cfDistribId = asStr(outputs.find(pair => asStr(pair.key) === 'cf_distrib').value)
    const awsCreds = getAwsCreds()
    if(!awsCreds) {
        throw new Error('couldn\'t find AWS credentials')
    }
    return [{
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
}

function apply() {
    const step0Import: ImportComponentInput = {
        name: 'aws_cloudfront_static_hosting_apply',
        url: TERRAFORM_EXECUTE_URL,
        input: [
            ...iterateBlocks(container, AWS_NEXT_JS, applyIterator1).flat(),
            ...makeEmptyExecuteDatabags(container, state)
        ]
    }
    const terraformExecuteResults = importComponents(container, [step0Import])

    exportDatabags(emptyExecutePostProcess(container, terraformExecuteResults, AWS_NEXT_JS, CREATED_TF_STATE_KEY))
    const step2Result = iterateBlocks(container, AWS_NEXT_JS, applyIterator2(terraformExecuteResults)).flat()
    exportDatabags(step2Result.map(db => db.databags).flat())
    //these are just s3_sync_files, they dont emit any databags, no need to export them
    importComponents(container, step2Result.map(db => db.imports).flat())
    applyTransformers(iterateBlocks(container, AWS_NEXT_JS, applyIterator3(terraformExecuteResults)).flat())
}

function destroyIterator1(bag: Databag): SugarCoatedDatabag[] {
    if(!bag.Value) {
        return []
    }
    return [{
        Type: 'terraform_execute',
        Name: `aws_next_js_destroy_${bag.Name}`,
        Value: {
            display_name: `Terraform destroy - aws_next_js.${bag.Name}`,
            mode: 'destroy',
            dir: `${outputDir}/aws_next_js_${bag.Name}`,
        }
    }]
}

function destroyIterator2(bag: Databag): SugarCoatedDatabag[] {
    if(!bag.Value) {
        return []
    }
    return [
        BarbeState.deleteFromObject(CREATED_TF_STATE_KEY, bag.Name)
    ]
}

function destroy() {
    let step0Import = {
        name: 'aws_next_js_destroy',
        url: TERRAFORM_EXECUTE_URL,
        input: [
            ...iterateBlocks(container, AWS_NEXT_JS, destroyIterator1).flat(),
            ...makeEmptyExecuteDatabags(container, state)
        ]
    }
    const results = importComponents(container, [step0Import])
    exportDatabags(emptyExecutePostProcess(container, results, AWS_NEXT_JS, CREATED_TF_STATE_KEY))
    exportDatabags(iterateBlocks(container, AWS_NEXT_JS, destroyIterator2).flat())
}

switch(barbeLifecycleStep()) {
    case 'pre_generate': 
        preGenerate()
        break
    case 'generate':
        generate()
        break
    case 'apply':
        apply()
        break
    case 'destroy':
        destroy()
        break
}