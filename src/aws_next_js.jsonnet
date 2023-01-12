local barbe = std.extVar("barbe");
local container = std.extVar("container");
local globalDefaults = barbe.compileDefaults(container, "");
local env = std.extVar("env");
local state = std.extVar("state");

local cloudResourceAbstractFactory(dir, id) =
    function(kind)
    function(type, name, value)
        barbe.cloudResourceRaw(dir, id, kind, type, name, value);

local emptyExecuteTemplate(container, state, containerKeyName, stateKeyName) = [
    {
        Type: "terraform_empty_execute",
        Name: stateKeyName + "_destroy_missing_" + name,
        Value: {
            display_name: "Terraform destroy - aws_next_js." + name,
            mode: "apply",
            template_json: std.manifestJsonMinified({
                terraform: {
                   [key]: {
                       [state[stateKeyName][name][key][0].labels[0]]: {
                            [innerKey]: state[stateKeyName][name][key][0][innerKey]
                            for innerKey in std.objectFields(state[stateKeyName][name][key][0])
                            if innerKey != "labels"
                       }
                   }
                   for key in std.objectFields(state[stateKeyName][name])
                }
            })
        }
    }
    for name in std.objectFields(std.get(state, stateKeyName, {}))
    if !std.objectHas(std.get(container, containerKeyName, {}), name)
];

/*
domain: domain name, can be any token
zone_id: zone id, can be any token
cloudResource: a function used to create cloud resources objects, should be (type, name, value) => {databag}
*/
local acmCertificateResources(opt) = [
    opt.cloudResource("aws_acm_certificate", "cert", {
         domain_name: opt.domain,
         validation_method: "DNS",
    }),
    opt.cloudResource("aws_route53_record", "validation_record", {
        for_each: {
            Type: "for",
            ForKeyVar: "dvo",
            ForCollExpr: barbe.asTraversal("aws_acm_certificate.cert.domain_validation_options"),
            ForKeyExpr: barbe.asTraversal("dvo.domain_name"),
            ForValExpr: barbe.asSyntax({
                name: barbe.asTraversal("dvo.resource_record_name"),
                record: barbe.asTraversal("dvo.resource_record_value"),
                type: barbe.asTraversal("dvo.resource_record_type"),
            })
        },
        allow_overwrite: true,
        name: barbe.asTraversal("each.value.name"),
        records: [
            barbe.asTraversal("each.value.record"),
        ],
        ttl: 60,
        type: barbe.asTraversal("each.value.type"),
        zone_id: opt.zone_id,
    }),
    opt.cloudResource("aws_acm_certificate_validation", "validation", {
        certificate_arn: barbe.asTraversal("aws_acm_certificate.cert.arn"),
        validation_record_fqdns: {
            Type: "for",
            ForValVar: "record",
            ForCollExpr: barbe.asTraversal("aws_route53_record.validation_record"),
            ForValExpr: barbe.asTraversal("record.fqdn"),
        }
    }),
];

barbe.pipelines([{
    generate: [
        function(container) barbe.databags([
            barbe.iterateBlocks(container, "aws_next_js", function(bag)
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                local dotBuild = barbe.asVal(barbe.mergeTokens(std.get(fullBlock, "build", barbe.asSyntax([])).ArrayConst));
                local dotDomain = barbe.asVal(barbe.mergeTokens(std.get(fullBlock, "domain", barbe.asSyntax([])).ArrayConst));
                local domainNames = 
                    if std.objectHas(dotDomain, "name") then
                        [dotDomain.name]
                    else
                        [];
                local cloudResourceKindFactory = cloudResourceAbstractFactory("aws_next_js_" + bag.Name, "aws_next_js_" + bag.Name);
                local cloudResource = cloudResourceKindFactory("resource");
                local cloudData = cloudResourceKindFactory("data");
                local cloudOutput = cloudResourceKindFactory("output");
                local cloudProvider = cloudResourceKindFactory("provider");
                [
                    if std.extVar("barbe_command") != "destroy" && !barbe.asVal(std.get(dotBuild, "disabled", barbe.asSyntax(false))) then
                        {
                            Type: "buildkit_run_in_container",
                            Name: "aws_next_js_" + bag.Name,
                            Value: {
                                display_name: "Next.js build - " + bag.Name,
                                excludes: [
                                    "**/node_modules",
                                    "node_modules",
                                ],
                                dockerfile: |||
                                    FROM node:%(node_version)s

                                    RUN apt-get update
                                    RUN apt-get install -y zip git
                                    RUN git clone https://github.com/jetbridge/cdk-nextjs.git
                                    RUN cd /cdk-nextjs/assets/lambda && npm init -y && npm i serverless-http next

                                    RUN mkdir /esbuild
                                    RUN cd /esbuild && npm install --save-exact esbuild
                                    RUN /esbuild/node_modules/.bin/esbuild --version

                                    COPY --from=src %(app_dir)s /src
                                    WORKDIR /src

                                    RUN %(install_cmd)s
                                    RUN %(build_cmd)s

                                    RUN /esbuild/node_modules/.bin/esbuild --bundle --minify --sourcemap --target=node16 --platform=node --external:next --external:serverless-http --external:aws-sdk --format=cjs --outfile=.next/standalone/nextapp/server.cjs /cdk-nextjs/assets/lambda/NextJsHandler.ts
                                    RUN mv .next/standalone/.next/ .next/standalone/nextapp/
                                    RUN mv /cdk-nextjs/assets/lambda/node_modules .next/standalone/nextapp/
                                    # RUN ln -s /cdk-nextjs/assets/lambda/node_modules .next/standalone/nextapp/node_modules

                                    RUN mkdir -p __barbe_next/standalone
                                    RUN mkdir -p __barbe_next/static/_next
                                    RUN mkdir -p __barbe_next/edge

                                    RUN cd .next/standalone && zip -ryq1 /src/__barbe_next/standalone.zip nextapp package.json

                                    RUN cp -r .next/static/ __barbe_next/static/_next/static/
                                    RUN cp -r public/* __barbe_next/static/
                                    # RUN cd __barbe_next/static/ && zip -ryq1 /src/__barbe_next/assets.zip ./*

                                    RUN /esbuild/node_modules/.bin/esbuild --bundle --minify --sourcemap --target=node16 --platform=node --external:aws-sdk --external:url --outfile=__barbe_next/edge/origin_request.js /cdk-nextjs/assets/lambda@edge/LambdaOriginRequest
                                    RUN cd __barbe_next/edge && zip -ryq1 /src/__barbe_next/edge.zip ./*
                                ||| % {
                                    node_version: barbe.asStr(std.get(dotBuild, "nodejs_version", std.get(fullBlock, "nodejs_version", "16"))) + "-slim",
                                    app_dir: barbe.asStr(std.get(dotBuild, "app_dir", std.get(fullBlock, "app_dir", "."))),
                                    install_cmd: barbe.asStr(std.get(dotBuild, "install_cmd", "npm install")),
                                    build_cmd: barbe.asStr(std.get(dotBuild, "build_cmd", "npm run build")),
                                },
                                exported_files: {
                                    "__barbe_next/edge.zip": "aws_next_js_" + bag.Name + "/edge.zip",
                                    "__barbe_next/static": "aws_next_js_" + bag.Name + "/static",
                                    "__barbe_next/standalone.zip": "aws_next_js_" + bag.Name + "/server.zip",
                                }
                            }
                        }
                    ,
                    if std.objectHas(container, "cr_[terraform]") then
                        local tfBlock = barbe.visitTokens(
                            container["cr_[terraform]"][""][0].Value,
                            function(token)
                                if token.Type == "literal_value" && std.isString(token.Value) && std.length(std.findSubstr(".tfstate", token.Value)) > 0 then
                                    {
                                        Type: "literal_value",
                                        Meta: std.get(token, "Meta", null),
                                        Value: std.strReplace(token.Value, ".tfstate", "_aws_next_js_" + bag.Name + ".tfstate"),
                                    }
                                else
                                    false
                        ) + {
                            Meta: { sub_dir: "aws_next_js_" + bag.Name }
                        };
                        [{
                            Name: "aws_next_js_" + bag.Name,
                            Type: "cr_[terraform(aws_next_js_" + bag.Name + ")]",
                            Value: tfBlock,
                        },
                        {

                            Type: "barbe_state(put_in_object)",
                            Name: "aws_next_js_created_tfstate",
                            Value: {
                                [bag.Name]: tfBlock,
                            },
                        }]
                    else
                        null
                    ,
                    barbe.importComponent(
                        container,
                        "aws_next_js_aws_iam_lambda_role_" + bag.Name,
                        "https://hub.barbe.app/barbe-serverless/aws_iam/v0.1.0/.jsonnet",
                        [],
                        [{
                            Type: "aws_iam_lambda_role",
                            Name: "default",
                            Value: {
                                cloudresource_dir: "aws_next_js_" + bag.Name,
                                assumable_by: ["edgelambda.amazonaws.com", "lambda.amazonaws.com"],
                                name_prefix: [barbe.appendToTemplate(namePrefix, [bag.Name + "-"])],
                            }
                        }]
                    ),
                    barbe.importComponent(
                        container,
                        "aws_next_js_aws_lambda_" + bag.Name,
                        "https://hub.barbe.app/barbe-serverless/aws_lambda/v0.1.0/.jsonnet",
                        [],
                        [
                            {
                                Type: "aws_function",
                                Name: "origin-request",
                                Value: {
                                    cloudresource_dir: "aws_next_js_" + bag.Name,
                                    cloudresource_id: "aws_next_js_" + bag.Name,
                                    package: [{
                                        packaged_file: "edge.zip",
                                    }],
                                    handler: "origin_request.handler",
                                    runtime: "nodejs" + barbe.asStr(std.get(dotBuild, "nodejs_version", std.get(fullBlock, "nodejs_version", "16"))) + ".x",
                                    timeout: 3,
                                    name_prefix: [barbe.appendToTemplate(namePrefix, [bag.Name + "-"])],
                                }
                            },
                            {
                                Type: "aws_function",
                                Name: "origin-server",
                                Value: {
                                    cloudresource_dir: "aws_next_js_" + bag.Name,
                                    cloudresource_id: "aws_next_js_" + bag.Name,
                                    package: [{
                                        packaged_file: "server.zip",
                                    }],
                                    handler: "nextapp/server.handler",
                                    runtime: "nodejs" + barbe.asStr(std.get(dotBuild, "nodejs_version", std.get(fullBlock, "nodejs_version", "16"))) + ".x",
                                    timeout: 10,
                                    memory_size: 1024,
                                    function_url_enabled: true,
                                    name_prefix: [barbe.appendToTemplate(namePrefix, [bag.Name + "-"])],
                                }
                            }
                        ]
                    ),
                    cloudProvider(null, "aws", {
                        region: std.get(fullBlock, "region", std.get(env, "AWS_REGION", "us-east-1")),
                    }),
                    cloudResource("aws_s3_bucket", "assets", {
                        bucket: barbe.appendToTemplate(namePrefix, [bag.Name + "-assets"]),
                        force_destroy: true,
                    }),
                    cloudOutput(null, "assets_s3_bucket", {
                        value: barbe.asTraversal("aws_s3_bucket.assets.id")
                    }),
                    cloudResource("aws_s3_bucket_acl", "assets_acl", {
                        bucket: barbe.asTraversal("aws_s3_bucket.assets.id"),
                        acl: "private"
                    }),
                    cloudResource("aws_s3_bucket_cors_configuration", "assets_cors", {
                        bucket: barbe.asTraversal("aws_s3_bucket.assets.id"),
                        cors_rule: barbe.asBlock([{
                            allowed_headers: ["*"],
                            allowed_methods: ["GET"],
                            allowed_origins: ["*"],
                            max_age_seconds: 3000
                        }])
                    }),
                    cloudResource("aws_cloudfront_origin_access_identity", "assets_access_id", {
                        comment: barbe.asTemplate([
                            "origin access identity for ",
                            barbe.appendToTemplate(namePrefix, [bag.Name + "-assets"])
                        ])
                    }),
                    cloudData("aws_iam_policy_document", "assets_policy", {
                        statement: barbe.asBlock([
                            {
                                actions: ["s3:GetObject"],
                                resources: [
                                    barbe.asTemplate([
                                        barbe.asTraversal("aws_s3_bucket.assets.arn"),
                                        "/*"
                                    ])
                                ],
                                principals: barbe.asBlock([{
                                    type: "AWS",
                                    identifiers: [
                                        barbe.asTraversal("aws_cloudfront_origin_access_identity.assets_access_id.iam_arn")
                                    ],
                                }]),
                            },
                            {
                                actions: ["s3:ListBucket"],
                                resources: [
                                    barbe.asTraversal("aws_s3_bucket.assets.arn"),
                                ],
                                principals: barbe.asBlock([{
                                    type: "AWS",
                                    identifiers: [
                                        barbe.asTraversal("aws_cloudfront_origin_access_identity.assets_access_id.iam_arn")
                                    ],
                                }]),
                            }
                        ])
                    }),
                    cloudResource("aws_s3_bucket_policy", "assets_policy", {
                        bucket: barbe.asTraversal("aws_s3_bucket.assets.id"),
                        policy: barbe.asTraversal("data.aws_iam_policy_document.assets_policy.json")
                    }),
                    cloudOutput(null, "cf_distrib", {
                        value: barbe.asTraversal("aws_cloudfront_distribution.distribution.id")
                    }),
                    cloudResource("aws_cloudfront_cache_policy", "next_js_default", {
                        name: barbe.appendToTemplate(namePrefix, [bag.Name + "-default-cache-policy"]),
                        default_ttl: 0,
                        max_ttl: 31536000, // that's 365 days
                        min_ttl: 0,
                        parameters_in_cache_key_and_forwarded_to_origin: barbe.asBlock([{
                            enable_accept_encoding_brotli: true,
                            enable_accept_encoding_gzip: true,
                            cookies_config: barbe.asBlock([{
                                cookie_behavior: "all"
                            }]),
                            headers_config: barbe.asBlock([{
                                header_behavior: "none",
                            }]),
                            query_strings_config: barbe.asBlock([{
                                query_string_behavior: "all"
                            }])
                        }])
                    }),
                    cloudResource("aws_cloudfront_cache_policy", "next_js_s3", {
                        name: barbe.appendToTemplate(namePrefix, [bag.Name + "-s3-cache-policy"]),
                        default_ttl: 2592000,
                        max_ttl: 5184000,
                        min_ttl: 2592000,
                        parameters_in_cache_key_and_forwarded_to_origin: barbe.asBlock([{
                            enable_accept_encoding_brotli: true,
                            enable_accept_encoding_gzip: true,
                            cookies_config: barbe.asBlock([{
                                cookie_behavior: "none"
                            }]),
                            headers_config: barbe.asBlock([{
                                header_behavior: "none",
                            }]),
                            query_strings_config: barbe.asBlock([{
                                query_string_behavior: "none"
                            }])
                        }])
                    }),
                    cloudResource("aws_cloudfront_response_headers_policy", "next_js_s3", {
                        name: barbe.appendToTemplate(namePrefix, [bag.Name + "-s3-response-headers-policy"]),
                        custom_headers_config: barbe.asBlock([{
                            items: barbe.asBlock([{
                                header: "cache-control",
                                override: false,
                                value: "public,max-age=2592000,immutable"
                            }])
                        }])
                    }),
                    cloudData("aws_cloudfront_origin_request_policy", "all_viewer", {
                        name: "Managed-AllViewer",
                    }),
                    cloudData("aws_cloudfront_cache_policy", "no_cache", {
                        name: "Managed-CachingDisabled",
                    }),
                    cloudResource("aws_cloudfront_distribution", "distribution", {
                        enabled: true,
                        is_ipv6_enabled: true,
                        price_class: "PriceClass_All",

                        restrictions: barbe.asBlock([{
                            geo_restriction: barbe.asBlock([{
                                restriction_type: "none"
                            }])
                        }]),

                        origin: barbe.asBlock([
                            {
                                domain_name: barbe.asTraversal("aws_s3_bucket.assets.bucket_regional_domain_name"),
                                origin_id: "assets",
                                s3_origin_config: barbe.asBlock([{
                                    origin_access_identity: barbe.asTraversal("aws_cloudfront_origin_access_identity.assets_access_id.cloudfront_access_identity_path")
                                }])
                            },
                            {
                                domain_name: barbe.asFuncCall(
                                    "replace", 
                                    [
                                        barbe.asFuncCall(
                                            "replace", 
                                            [
                                                barbe.asTraversal("aws_function.origin-server.function_url"),
                                                "https://",
                                                ""
                                            ]
                                        ),
                                        "/",
                                        ""
                                    ]
                                ),
                                origin_id: "server",
                                custom_origin_config: barbe.asBlock([{
                                    http_port: 80,
                                    https_port: 443,
                                    origin_protocol_policy: "https-only",
                                    origin_ssl_protocols: ["TLSv1.2"]
                                }]),
                                custom_header: barbe.asBlock([{
                                    name: "x-origin-url",
                                    value: barbe.asTraversal("aws_function.origin-server.function_url")
                                }])
                            }
                        ]),

                        origin_group: barbe.asBlock([{
                            origin_id: "all",
                            member: barbe.asBlock([
                                {
                                    origin_id: "server"
                                },
                                {
                                    origin_id: "assets"
                                }
                            ]),
                            failover_criteria: barbe.asBlock([{
                                status_codes: [403, 404]
                            }])
                        }]),

                        default_cache_behavior: barbe.asBlock([{
                            allowed_methods: ["GET", "HEAD", "OPTIONS"],
                            cached_methods: ["GET", "HEAD"],
                            viewer_protocol_policy: "redirect-to-https",
                            target_origin_id: "all",
                            compress: true,

                            cache_policy_id: barbe.asTraversal("aws_cloudfront_cache_policy.next_js_default.id"),
                            origin_request_policy_id: barbe.asTraversal("data.aws_cloudfront_origin_request_policy.all_viewer.id"),

                            lambda_function_association: barbe.asBlock([{
                                event_type: "origin-request",
                                lambda_arn: barbe.asTraversal("aws_function.origin-request.qualified_arn"),
                                include_body: false
                            }]),
                        }]),

                        local serverBehavior(pattern) = {
                            path_pattern: pattern,
                            allowed_methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS", "DELETE"],
                            cached_methods: ["GET", "HEAD"],
                            viewer_protocol_policy: "redirect-to-https",
                            target_origin_id: "server",
                            compress: true,

                            cache_policy_id: barbe.asTraversal("data.aws_cloudfront_cache_policy.no_cache.id"),
                            origin_request_policy_id: barbe.asTraversal("data.aws_cloudfront_origin_request_policy.all_viewer.id"),

                            lambda_function_association: barbe.asBlock([{
                                event_type: "origin-request",
                                lambda_arn: barbe.asTraversal("aws_function.origin-request.qualified_arn"),
                                include_body: false
                            }]),
                        },
                        ordered_cache_behavior: barbe.asBlock([
                            // serverBehavior("/"),
                            serverBehavior("api/*"),
                            serverBehavior("_next/data/*"),
                            {
                                path_pattern: "_next/*",
                                allowed_methods: ["GET", "HEAD", "OPTIONS"],
                                cached_methods: ["GET", "HEAD", "OPTIONS"],
                                viewer_protocol_policy: "redirect-to-https",
                                target_origin_id: "assets",
                                compress: true,

                                cache_policy_id: barbe.asTraversal("aws_cloudfront_cache_policy.next_js_s3.id"),
                                response_headers_policy_id: barbe.asTraversal("aws_cloudfront_response_headers_policy.next_js_s3.id"),
                            }
                        ]),

                        aliases: domainNames,
                        viewer_certificate: barbe.asBlock([
                            if std.length(domainNames) == 0 then
                                {
                                    cloudfront_default_certificate: true
                                }
                            else if std.objectHas(dotDomain, "certificate_arn") then
                                {
                                    acm_certificate_arn: dotDomain.certificate_arn,
                                    ssl_support_method: "sni-only",
                                    minimum_protocol_version: "TLSv1.2_2021",
                                }
                            else if std.objectHas(dotDomain, "existing_certificate_domain") then
                                {
                                    acm_certificate_arn: barbe.asTraversal("data.aws_acm_certificate.imported_certificate.arn"),
                                    ssl_support_method: "sni-only",
                                    minimum_protocol_version: "TLSv1.2_2021",
                                }
                            else if std.objectHas(dotDomain, "certificate_domain_to_create") then
                                {
                                    acm_certificate_arn: barbe.asTraversal("aws_acm_certificate_validation.validation.certificate_arn"),
                                    ssl_support_method: "sni-only",
                                    minimum_protocol_version: "TLSv1.2_2021",
                                }
                            else if std.length(domainNames) > 1 then
                                error "<showuser>no certificate_domain_to_create, existing_certificate_domain or certificate_arn given with multiple domain names. The easy way to fix this is to provide a certificate_domain_to_create like '*.domain.com'</showuser>"
                            else
                                {
                                    acm_certificate_arn: barbe.asTraversal("aws_acm_certificate_validation.validation.certificate_arn"),
                                    ssl_support_method: "sni-only",
                                    minimum_protocol_version: "TLSv1.2_2021",
                                }
                        ])
                    }),
                    if std.length(domainNames) > 0 then
                        //TODO What if the user owns a domain that's not on AWS? (have ability to create route53 hosted zone + return the domain records)
                        [
                            cloudData("aws_route53_zone", "zone", {
                                name: dotDomain.zone
                            }),
                            [
                                cloudResource("aws_route53_record", "aws_http_api_domain_record", {
                                    zone_id: barbe.asTraversal("data.aws_route53_zone.zone.zone_id"),
                                    name: domainName,
                                    type: "CNAME",
                                    ttl: 300,
                                    records: [
                                        barbe.asTraversal("aws_cloudfront_distribution.distribution.domain_name")
                                    ]
                                })
                                for domainName in domainNames
                            ]
                        ],
                        if !std.objectHas(dotDomain, "certificate_arn") then
                            if std.objectHas(dotDomain, "existing_certificate_domain") then
                                cloudData("aws_acm_certificate", "imported_certificate", {
                                    domain: dotDomain.existing_certificate_domain,
                                    types: ["AMAZON_ISSUED"],
                                    most_recent: true
                                })
                            else if std.objectHas(dotDomain, "certificate_domain_to_create") then
                                acmCertificateResources({
                                    cloudResource: cloudResource,
                                    domain: dotDomain.certificate_domain_to_create,
                                    zone_id: barbe.asTraversal("data.aws_route53_zone.zone.zone_id"),
                                })
                            else if std.length(domainNames) == 1 then
                                acmCertificateResources({
                                    cloudResource: cloudResource,
                                    domain: domainNames[0],
                                    zone_id: barbe.asTraversal("data.aws_route53_zone.zone.zone_id"),
                                })
                ]
            )
        ])
    ],
    apply: [
        function(container) barbe.databags([
            local tfExecute = barbe.iterateBlocks(container, "aws_next_js", function(bag)
                {
                    Type: "terraform_execute",
                    Name: "aws_next_js_" + bag.Name,
                    Value: {
                        display_name: "Terraform apply - aws_next_js." + bag.Name,
                        mode: "apply",
                        dir: std.extVar("barbe_output_dir") + "/aws_next_js_" + bag.Name,
                    }
                }
            );
            local forImport = 
                if std.objectHas(container, "cr_[terraform]") then
                    barbe.flatten([
                        tfExecute,
                        emptyExecuteTemplate(container, state, "aws_next_js", "aws_next_js_created_tfstate")
                    ])
                else
                    tfExecute
                ;
            barbe.importComponent(
                container,
                "aws_next_js",
                "https://hub.barbe.app/barbe-serverless/terraform_execute/v0.1.0/.jsonnet",
                [],
                forImport
            ),
        ]),
        function(container) barbe.databags([
            if std.objectHas(container, "terraform_execute_output") then
                local forImport = barbe.iterateBlocks(container, "aws_next_js", function(bag)
                    local block = barbe.asVal(bag.Value);
                    local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                    local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                    {
                        Type: "aws_s3_sync_files",
                        Name: "aws_next_js_" + bag.Name,
                        Value: std.prune({
                            display_name: "Uploading Next.js files - " + bag.Name,
                            local outputs = barbe.asValArrayConst(container.terraform_execute_output["aws_next_js_" + bag.Name][0].Value),
                            bucket_name: [pair.value for pair in outputs if barbe.asStr(pair.key) == "assets_s3_bucket"][0],
                            delete: true,
                            dir: std.extVar("barbe_output_dir") + "/aws_next_js_" + bag.Name + "/static",
                            blob: ".",
                        })
                    }
                );
                barbe.importComponent(
                    container,
                    "aws_next_js",
                    "https://hub.barbe.app/anyfront/aws_s3_sync_files/v0.1.0/.jsonnet",
                    [],
                    forImport
                )
            ,
            if std.objectHas(container, "terraform_empty_execute_output") then
                [
                    {
                        Type: "barbe_state(delete_from_object)",
                        Name: "aws_next_js_created_tfstate",
                        Value: std.strReplace(name, "aws_next_js_created_tfstate_destroy_missing_", ""),
                    }
                    for name in std.objectFields(container.terraform_empty_execute_output)
                    if std.member(name, "aws_next_js_created_tfstate_destroy_missing_") && !std.objectHas(std.get(container, "aws_next_js", {}), name)
                ]
            ,
            {
                Name: "aws_cf_invalidate_credentials",
                Type: "aws_credentials_request",
                Value: {}
            }
        ]),
        function(container) barbe.databags([
            if std.objectHas(container, "terraform_execute_output") then
                barbe.iterateBlocks(container, "aws_next_js", function(bag)
                    local block = barbe.asVal(bag.Value);
                    local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                    local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                    local outputs = barbe.asValArrayConst(container.terraform_execute_output["aws_next_js_" + bag.Name][0].Value);
                    local cfDistribId = barbe.asStr([pair.value for pair in outputs if barbe.asStr(pair.key) == "cf_distrib"][0]);
                    local awsCredentials =
                    if std.get(std.get(container, "aws_credentials", {}), "aws_cf_invalidate_credentials", null) != null then
                        barbe.asVal(container.aws_credentials.aws_cf_invalidate_credentials[0].Value)
                    else
                        {
                            access_key_id: "",
                            secret_access_key: "",
                            session_token: "",
                        }
                    ;
                    {
                        Type: "buildkit_run_in_container",
                        Name: "aws_next_js_invalidate_" + bag.Name,
                        Value: {
                            no_cache: true,
                            display_name: "Invalidate CloudFront distribution - aws_next_js." + bag.Name,
                            dockerfile: |||
                                FROM amazon/aws-cli:%(aws_cli_version)s

                                ENV AWS_ACCESS_KEY_ID="%(access_key_id)s"
                                ENV AWS_SECRET_ACCESS_KEY="%(secret_access_key)s"
                                ENV AWS_SESSION_TOKEN="%(session_token)s"
                                ENV AWS_REGION="%(aws_region)s"
                                ENV AWS_PAGER=""

                                RUN aws cloudfront create-invalidation --distribution-id %(distrib_id)s --paths "/*"
                            ||| % {
                                //TODO version selection
                                aws_cli_version: "latest",
                                distrib_id: cfDistribId,

                                access_key_id: barbe.asStr(awsCredentials.access_key_id),
                                secret_access_key: barbe.asStr(awsCredentials.secret_access_key),
                                session_token: barbe.asStr(awsCredentials.session_token),
                                aws_region: std.get(env, "AWS_REGION", "us-east-1"),
                            },
                        }
                    }
                ),
        ])
    ],
    destroy: [
        function(container) barbe.databags([
            local forImport = barbe.iterateBlocks(container, "aws_next_js", function(bag)
                {
                    Type: "terraform_execute",
                    Name: "aws_next_js_destroy_" + bag.Name,
                    Value: {
                        display_name: "Terraform destroy - aws_next_js." + bag.Name,
                        mode: "destroy",
                        dir: std.extVar("barbe_output_dir") + "/aws_next_js_" + bag.Name,
                    }
                }
            );
            barbe.importComponent(
                container,
                "aws_next_js",
                "https://hub.barbe.app/barbe-serverless/terraform_execute/v0.1.0/.jsonnet",
                [],
                forImport,
            ),
        ]),
        function(container) barbe.databags([
            barbe.iterateBlocks(container, "aws_next_js", function(bag)
                {
                    Type: "barbe_state(delete_from_object)",
                    Name: "aws_next_js_created_tfstate",
                    Value: bag.Name,
                }
            ),
        ])
    ]
}])