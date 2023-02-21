import { readDatabagContainer, barbeLifecycleStep, Databag, SugarCoatedDatabag, asStr, appendToTemplate, asTraversal, asBlock, asTemplate, asSyntax, asVal, SyntaxToken, ImportComponentInput, barbeOutputDir, exportDatabags, importComponents, iterateBlocks, BarbeState, DatabagContainer, asValArrayConst, applyTransformers, throwStatement } from '../../../barbe-serverless/src/barbe-std/utils';
import { applyDefaults, applyMixins, getAwsCreds, preConfCloudResourceFactory } from '../../../barbe-serverless/src/barbe-sls-lib/lib';
import lister_go from './lister.go';
import base_script from './origin_request.template.js';
import { DBAndImport, emptyExecutePostProcess, emptyExecuteTemplate, guessAwsDnsZoneBasedOnDomainName, prependTfStateFileName } from '../anyfront-lib/lib';
import { AWS_CLOUDFRONT_STATIC_HOSTING, AWS_IAM_URL, AWS_LAMBDA_URL, AWS_S3_SYNC_FILES, AWS_S3_SYNC_URL, TERRAFORM_EXECUTE_URL } from '../anyfront-lib/consts';
import { AWS_IAM_LAMBDA_ROLE, AWS_FUNCTION } from '../../../barbe-serverless/src/barbe-sls-lib/consts';

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
    return emptyExecuteTemplate(container, state, AWS_CLOUDFRONT_STATIC_HOSTING, CREATED_TF_STATE_KEY)
}

function generateIterator1(bag: Databag): DBAndImport[] {
    if(!bag.Value) {
        return []
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value)

    if(!block.build_dir) {
        throw new Error(`build_dir is required for 'aws_cloudfront_static_hosting.${bag.Name}'`)
    }

    const dir = `aws_cf_static_hosting_${bag.Name}`
    const bagPreconf = {
        dir,
        id: dir
    }
    const rootObj = block.root_object || 'index.html'
    const domainNames: SyntaxToken[] = asVal(block.domain_names || asSyntax([]))
    const noProvider = { provider: undefined }
    const cloudResource = preConfCloudResourceFactory(block, 'resource', noProvider, bagPreconf)
    const cloudData = preConfCloudResourceFactory(block, 'data', noProvider, bagPreconf)
    const cloudOutput = preConfCloudResourceFactory(block, 'output', noProvider, bagPreconf)
    const cloudProvider = preConfCloudResourceFactory(block, 'provider', noProvider, bagPreconf)
    const cloudTerraform = preConfCloudResourceFactory(block, 'terraform', noProvider, bagPreconf)

    const acmCertificateResources = (domain: SyntaxToken): SugarCoatedDatabag[] => {
        return [
            cloudResource('aws_acm_certificate', 'cert', {
                domain_name: domain,
                validation_method: 'DNS'
            }),
            cloudResource('aws_route53_record', 'validation_record', {
                for_each: {
                    Type: 'for',
                    ForKeyVar: "dvo",
                    ForCollExpr: asTraversal("aws_acm_certificate.cert.domain_validation_options"),
                    ForKeyExpr: asTraversal("dvo.domain_name"),
                    ForValExpr: asSyntax({
                        name: asTraversal("dvo.resource_record_name"),
                        record: asTraversal("dvo.resource_record_value"),
                        type: asTraversal("dvo.resource_record_type"),
                    })
                },
                allow_overwrite: true,
                name: asTraversal("each.value.name"),
                records: [
                    asTraversal("each.value.record")
                ],
                ttl: 60,
                type: asTraversal("each.value.type"),
                zone_id: asTraversal("data.aws_route53_zone.zone.zone_id")
            }),
            cloudResource('aws_acm_certificate_validation', 'validation', {
                certificate_arn: asTraversal('aws_acm_certificate.cert.arn'),
                validation_record_fqdns: {
                    Type: 'for',
                    ForValVar: "record",
                    ForCollExpr: asTraversal("aws_route53_record.validation_record"),
                    ForValExpr: asTraversal("record.fqdn"),
                }
            })
        ]
    }

    const staticFileDistrib = () => {
        let localDatabags: SugarCoatedDatabag[] = [
            cloudProvider('', 'aws', {
                region: block.region
            }),
            cloudResource('aws_s3_bucket', 'origin', {
                bucket: appendToTemplate(namePrefix, ['origin']),
                force_destroy: true,
            }),
            cloudOutput('', 'static_hosting_s3_bucket', {
                value: asTraversal('aws_s3_bucket.origin.id')
            }),
            cloudResource('aws_s3_bucket_acl', 'origin_acl', {
                bucket: asTraversal('aws_s3_bucket.origin.id'),
                acl: 'private'
            }),
            cloudResource('aws_s3_bucket_cors_configuration', 'origin_cors', {
                bucket: asTraversal('aws_s3_bucket.origin.id'),
                cors_rule: asBlock([{
                    allowed_headers: ['*'],
                    allowed_methods: ['GET'],
                    allowed_origins: ['*'],
                    max_age_seconds: 3000
                }])
            }),
            cloudResource('aws_cloudfront_origin_access_identity', 'origin_access_id', {
                comment: asTemplate([
                    'origin access identity for ',
                    appendToTemplate(namePrefix, ['origin'])
                ])
            }),
            cloudData('aws_iam_policy_document', 'origin_policy', {
                statement: asBlock([
                    {
                        actions: ['s3:GetObject'],
                        resources: [
                            asTemplate([
                                asTraversal('aws_s3_bucket.origin.arn'),
                                '/*'
                            ])
                        ],
                        principals: asBlock([{
                            type: 'AWS',
                            identifiers: [
                                asTraversal('aws_cloudfront_origin_access_identity.origin_access_id.iam_arn')
                            ]
                        }])
                    },
                    {
                        actions: ['s3:ListBucket'],
                        resources: [
                            asTraversal('aws_s3_bucket.origin.arn')
                        ],
                        principals: asBlock([{
                            type: 'AWS',
                            identifiers: [
                                asTraversal('aws_cloudfront_origin_access_identity.origin_access_id.iam_arn')
                            ]
                        }])
                    }
                ])
            }),
            cloudResource('aws_s3_bucket_policy', 'origin_policy', {
                bucket: asTraversal('aws_s3_bucket.origin.id'),
                policy: asTraversal('data.aws_iam_policy_document.origin_policy.json')
            }),
            cloudOutput('', 'static_hosting_cf_distrib', {
                value: asTraversal('aws_cloudfront_distribution.distribution.id')
            }),
            cloudData('aws_cloudfront_cache_policy', 'caching_optimized', {
                name: 'Managed-CachingOptimized',
            }),
            cloudResource('aws_cloudfront_distribution', 'distribution', {
                enabled: true,
                default_root_object: rootObj,
                is_ipv6_enabled: true,
                price_class: 'PriceClass_All',

                restrictions: asBlock([{
                    geo_restriction: asBlock([{
                        restriction_type: 'none'
                    }])
                }]),

                origin: asBlock([{
                    domain_name: asTraversal('aws_s3_bucket.origin.bucket_regional_domain_name'),
                    origin_id: 'bucket',
                    s3_origin_config: asBlock([{
                        origin_access_identity: asTraversal('aws_cloudfront_origin_access_identity.origin_access_id.cloudfront_access_identity_path')
                    }])
                }]),

                default_cache_behavior: asBlock([{
                    allowed_methods: ['GET', 'HEAD', 'OPTIONS'],
                    cached_methods: ['GET', 'HEAD'],
                    target_origin_id: 'bucket',
                    viewer_protocol_policy: 'redirect-to-https',
                    compress: true,

                    cache_policy_id: asTraversal('data.aws_cloudfront_cache_policy.caching_optimized.id'),
                    lambda_function_association: asBlock([{
                        event_type: 'origin-request',
                        lambda_arn: asTraversal('aws_function.origin-request.qualified_arn'),
                        include_body: false
                    }]),
                }]),

                custom_error_response: asBlock([{
                    error_caching_min_ttl: 0,
                    error_code: 404,
                    response_code: 200,
                    response_page_path: appendToTemplate(asSyntax("/"), [rootObj])
                }]),

                aliases: domainNames,
                viewer_certificate: asBlock([
                    (() => {
                        const minimumProtocolVersion = 'TLSv1.2_2021'
                        if(domainNames.length === 0) {
                            return {
                                cloudfront_default_certificate: true
                            }
                        }
                        if(block.certificate_arn) {
                            return {
                                acm_certificate_arn: block.certificate_arn,
                                ssl_support_method: 'sni-only',
                                minimum_protocol_version: minimumProtocolVersion
                            }
                        }
                        if (block.existing_certificate_domain) {
                            return {
                                acm_certificate_arn: asTraversal(`data.aws_acm_certificate.imported_certificate.arn`),
                                ssl_support_method: 'sni-only',
                                minimum_protocol_version: minimumProtocolVersion
                            }
                        }
                        if(block.certificate_domain_to_create) {
                            return {
                                acm_certificate_arn: asTraversal(`aws_acm_certificate_validation.validation.certificate_arn`),
                                ssl_support_method: 'sni-only',
                                minimum_protocol_version: minimumProtocolVersion
                            }
                        }
                        if(domainNames.length > 1) {
                            throw new Error('no certificate_domain_to_create, existing_certificate_domain or certificate_arn given with multiple domain names. The easy way to fix this is to provide a certificate_domain_to_create like \'*.domain.com\'')
                        }
                        return {
                            acm_certificate_arn: asTraversal(`data.aws_acm_certificate.imported_certificate.arn`),
                            ssl_support_method: 'sni-only',
                            minimum_protocol_version: minimumProtocolVersion
                        }
                    })()
                ])
            })
        ]
        if (domainNames.length > 0) {
            localDatabags.push(
                cloudData('aws_route53_zone', 'zone', {
                    name: block.zone || guessAwsDnsZoneBasedOnDomainName(domainNames[0]) || throwStatement('no \'zone\' given and could not guess based on domain name')
                }),
                ...domainNames.map((domainName, i) => cloudResource('aws_route53_record', `cf_distrib_domain_record_${i}`, {
                    zone_id: asTraversal('data.aws_route53_zone.zone.zone_id'),
                    name: domainName,
                    type: 'CNAME',
                    ttl: 300,
                    records: [
                        asTraversal('aws_cloudfront_distribution.distribution.domain_name')
                    ]
                }))
            )
            if(!block.certificate_arn) {
                if(block.existing_certificate_domain) {
                    localDatabags.push(
                        cloudData('aws_acm_certificate', 'imported_certificate', {
                            domain: block.existing_certificate_domain,
                            types: ['AMAZON_ISSUED'],
                            most_recent: true
                        })
                    )
                } else if(block.certificate_domain_to_create) {
                    localDatabags.push(...acmCertificateResources(block.certificate_domain_to_create))
                } else if(domainNames.length === 1) {
                    localDatabags.push(...acmCertificateResources(domainNames[0]))
                }
            }
        }
        return localDatabags
    }
    
    let databags: SugarCoatedDatabag[] = [
        {
            Type: 'buildkit_run_in_container',
            Name: `aws_cloudfront_static_hosting_gen_origin_req_${bag.Name}`,
            Value: {
                no_cache: true,
                display_name: `λ Codegen - aws_cloudfront_static_hosting.${bag.Name}`,
                input_files: {
                    '__barbe_lister.go': lister_go,
                    '__barbe_base_script.js': applyMixins(base_script, {
                        root_object: rootObj,
                    }),
                },
                dockerfile: `
                    FROM golang:1.18-alpine AS builder

                    COPY --from=src ./${asStr(block.build_dir)} /src
                    WORKDIR /src

                    COPY --from=src __barbe_base_script.js ./origin_request.js
                    COPY --from=src __barbe_lister.go ./lister.go
                    RUN go run lister.go`,
                exported_files: {
                    'origin_request.js': `aws_cf_static_hosting_${bag.Name}/origin_request.js`,
                }
            }
        },
        ...staticFileDistrib()
    ]
    if(container['cr_[terraform]']) {
        databags.push(cloudTerraform('', '', prependTfStateFileName(container, `_aws_cf_static_hosting_${bag.Name}`)))
    }

    let imports: ImportComponentInput[] = [
        {
            name: `aws_cloudfront_static_hosting_aws_iam_${bag.Name}`,
            url: AWS_IAM_URL,
            input: [{
                Type: AWS_IAM_LAMBDA_ROLE,
                Name: 'default',
                Value: {
                    cloudresource_dir: dir,
                    cloudresource_id: dir,
                    assumable_by: ["edgelambda.amazonaws.com", "lambda.amazonaws.com"],
                    name_prefix: [namePrefix],
                }
            }]
        },
        {
            name: `aws_cloudfront_static_hosting_aws_lambda_${bag.Name}`,
            url: AWS_LAMBDA_URL,
            input: [{
                Type: AWS_FUNCTION,
                Name: 'origin-request',
                Value: {
                    cloudresource_dir: dir,
                    cloudresource_id: dir,
                    package: [{
                        file_map: {
                            "*": "origin_request.js"
                        },
                        include: [
                            `${outputDir}/${dir}/origin_request.js`
                        ]
                    }],
                    handler: "origin_request.handler",
                    runtime: "nodejs16.x",
                    timeout: 30,
                    name_prefix: [namePrefix],
                }
            }]
        }
    ]
    return [{ databags, imports }]
}

function generate() {
    const dbOrImports = iterateBlocks(container, AWS_CLOUDFRONT_STATIC_HOSTING, generateIterator1).flat()
    exportDatabags(dbOrImports.map(db => db.databags).flat())
    exportDatabags(importComponents(container, dbOrImports.map(db => db.imports).flat()))
}

function applyIterator1(bag: Databag): SugarCoatedDatabag[] {
    if(!bag.Value) {
        return []
    }
    return [{
        Type: 'terraform_execute',
        Name: `aws_cloudfront_static_hosting_${bag.Name}`,
        Value: {
            display_name: `Terraform apply - aws_cloudfront_static_hosting.${bag.Name}`,
            mode: 'apply',
            dir: `${outputDir}/aws_cf_static_hosting_${bag.Name}`,
        }
    }]
}

const applyIterator2 = (terraformExecuteResults: DatabagContainer) => (bag: Databag): DBAndImport[] => {
    if(!bag.Value) {
        return []
    }
    const [block, namePrefix] = applyDefaults(container, bag.Value)

    let databags: SugarCoatedDatabag[] = []
    if(container['cr_[terraform]']) {
        databags.push(
            BarbeState.putInObject(CREATED_TF_STATE_KEY, {
                [bag.Name]: prependTfStateFileName(container, `_aws_cf_static_hosting_${bag.Name}`)
            })
        )
    }
    let imports: ImportComponentInput[] = []
    if(terraformExecuteResults.terraform_execute_output?.[`aws_cloudfront_static_hosting_${bag.Name}`]) {
        const outputs = asValArrayConst(terraformExecuteResults.terraform_execute_output[`aws_cloudfront_static_hosting_${bag.Name}`][0].Value!)
        const bucketName = asStr(outputs.find(pair => asStr(pair.key) === 'static_hosting_s3_bucket').value)
        imports.push({
            name: `aws_cloudfront_static_hosting_s3_sync_${bag.Name}`,
            url: AWS_S3_SYNC_URL,
            input: [{
                Type: AWS_S3_SYNC_FILES,
                Name: `sync_${bag.Name}`,
                Value: {
                    display_name: `Uploading files to S3 - ${bag.Name}`,
                    bucket_name: bucketName,
                    delete: true,
                    dir: asStr(block.build_dir!),
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

    let databags: SugarCoatedDatabag[] = []
    if(terraformExecuteResults.terraform_execute_output?.[`aws_cloudfront_static_hosting_${bag.Name}`]) {
        const outputs = asValArrayConst(terraformExecuteResults.terraform_execute_output[`aws_cloudfront_static_hosting_${bag.Name}`][0].Value!)
        const cfDistribId = asStr(outputs.find(pair => asStr(pair.key) === 'static_hosting_cf_distrib').value)
        const awsCreds = getAwsCreds()
        if(!awsCreds) {
            throw new Error('couldn\'t find AWS credentials')
        }
        databags.push({
            Type: 'buildkit_run_in_container',
            Name: `aws_cf_static_hosting_invalidate_${bag.Name}`,
            Value: {
                no_cache: true,
                display_name: `Invalidate CloudFront distribution - aws_cloudfront_static_hosting.${bag.Name}`,
                dockerfile: `
                    FROM amazon/aws-cli:latest

                    ENV AWS_ACCESS_KEY_ID="${awsCreds.access_key_id}"
                    ENV AWS_SECRET_ACCESS_KEY="${awsCreds.secret_access_key}"
                    ENV AWS_SESSION_TOKEN="${awsCreds.session_token}"
                    ENV AWS_REGION="${asStr(block.region || os.getenv("AWS_REGION") || 'us-east-1')}"
                    ENV AWS_PAGER=""

                    RUN aws cloudfront create-invalidation --distribution-id ${cfDistribId} --paths "/*"`
            }
        })
    }
    return databags
}


function apply() {
    const step0Import: ImportComponentInput = {
        name: 'aws_cloudfront_static_hosting_apply',
        url: TERRAFORM_EXECUTE_URL,
        input: [
            ...iterateBlocks(container, AWS_CLOUDFRONT_STATIC_HOSTING, applyIterator1).flat(),
            ...makeEmptyExecuteDatabags(container, state)
        ]
    }
    const terraformExecuteResults = importComponents(container, [step0Import])

    exportDatabags(emptyExecutePostProcess(container, terraformExecuteResults, AWS_CLOUDFRONT_STATIC_HOSTING, CREATED_TF_STATE_KEY))
    const step2Result = iterateBlocks(container, AWS_CLOUDFRONT_STATIC_HOSTING, applyIterator2(terraformExecuteResults)).flat()
    exportDatabags(step2Result.map(db => db.databags).flat())
    //these are just s3_sync_files, they dont emit any databags, no need to export them
    importComponents(container, step2Result.map(db => db.imports).flat())

    applyTransformers(iterateBlocks(container, AWS_CLOUDFRONT_STATIC_HOSTING, applyIterator3(terraformExecuteResults)).flat())
}

function destroyIterator1(bag: Databag): SugarCoatedDatabag[] {
    if(!bag.Value) {
        return []
    }
    return [{
        Type: 'terraform_execute',
        Name: `aws_cloudfront_static_hosting_destroy_${bag.Name}`,
        Value: {
            display_name: `Terraform destroy - aws_cloudfront_static_hosting.${bag.Name}`,
            mode: 'destroy',
            dir: `${outputDir}/aws_cf_static_hosting_${bag.Name}`,
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
        name: 'aws_cloudfront_static_hosting_destroy',
        url: TERRAFORM_EXECUTE_URL,
        input: [
            ...iterateBlocks(container, AWS_CLOUDFRONT_STATIC_HOSTING, destroyIterator1).flat(),
            ...makeEmptyExecuteDatabags(container, state)
        ]
    }
    const results = importComponents(container, [step0Import])
    exportDatabags(emptyExecutePostProcess(container, results, AWS_CLOUDFRONT_STATIC_HOSTING, CREATED_TF_STATE_KEY))
    exportDatabags(iterateBlocks(container, AWS_CLOUDFRONT_STATIC_HOSTING, destroyIterator2).flat())
}

switch(barbeLifecycleStep()) {
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
