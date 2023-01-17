local barbe = std.extVar("barbe");
local state = std.extVar("state");
local container = std.extVar("container");
local env = std.extVar("env");
local globalDefaults = barbe.compileDefaults(container, "");

local cloudResourceAbstractFactory(dir, id) =
    function(kind)
    function(type, name, value)
        barbe.cloudResourceRaw(dir, id, kind, type, name, value);

local emptyExecuteTemplate(container, state, containerKeyName, stateKeyName) = [
    {
        Type: "terraform_empty_execute",
        Name: stateKeyName + "_destroy_missing_" + name,
        Value: {
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


//TODO split domain registration out of this (keep ssl certificate in it tho?) domain_registration block ?
//TODO determine if a certificate under *.domain.com exists and use it in existing_certificate_comain otgherwise use certificate_domain_to_create
/*
this only creates the deployment resources,
the build has to be handled before and the deploy has to be handled after (order doesnt really matter)

name: bag name
name_prefix: template string name prefix
root_object: the index.html, defaults to index.html
zone: the domain zone name, required
region: the aws region, required
domain_names: optional, the domain names to use. If more than one is
certificate_domain_to_create: optional, the domain name of the ACM certificate that will be created. usesul when several domains are given to provide "*.domain.com" as certificate
existing_certificate_comain: optional, the domain of an existing certificate on the account, can use wildcards, overrides existing_certificate_comain
certificate_arn: optional, the certificate arn to use, overrides certificateDomain and certificate_domain_to_create
cloudResourceKindFactory: a function used to create cloud resources objects, should be (kind) => (type, name, value) => {databag}
*/
local staticFileDistribAWS(opt) =
    local cloudResource = opt.cloudResourceKindFactory("resource");
    local cloudData = opt.cloudResourceKindFactory("data");
    local cloudOutput = opt.cloudResourceKindFactory("output");
    local cloudProvider = opt.cloudResourceKindFactory("provider");
    local domainNames = barbe.asVal(std.get(opt, "domain_names", barbe.asSyntax([])));
    [
    assert std.objectHas(opt, "name_prefix") : "staticWebsiteAWS name_prefix must be set";
    cloudProvider(null, "aws", {
        region: opt.region,
    }),
    cloudResource("aws_s3_bucket", "origin", {
        bucket: barbe.appendToTemplate(opt.name_prefix, [barbe.asSyntax("origin")]),
        force_destroy: true,
    }),
    cloudOutput(null, "static_hosting_s3_bucket", {
        value: barbe.asTraversal("aws_s3_bucket.origin.id")
    }),
    cloudResource("aws_s3_bucket_acl", "origin_acl", {
         bucket: barbe.asTraversal("aws_s3_bucket.origin.id"),
         acl: "private"
    }),
    cloudResource("aws_s3_bucket_cors_configuration", "origin_cors", {
         bucket: barbe.asTraversal("aws_s3_bucket.origin.id"),
         cors_rule: barbe.asBlock([{
             allowed_headers: ["*"],
             allowed_methods: ["GET"],
             allowed_origins: ["*"],
             max_age_seconds: 3000
         }])
     }),
     cloudResource("aws_cloudfront_origin_access_identity", "origin_access_id", {
        comment: barbe.asTemplate([
            "origin access identity for ",
            barbe.appendToTemplate(opt.name_prefix, [barbe.asSyntax("origin")])
        ])
    }),
    cloudData("aws_iam_policy_document", "origin_policy", {
          statement: barbe.asBlock([
              {
                  actions: ["s3:GetObject"],
                  resources: [
                      barbe.asTemplate([
                          barbe.asTraversal("aws_s3_bucket.origin.arn"),
                          "/*"
                      ])
                  ],
                  principals: barbe.asBlock([{
                      type: "AWS",
                      identifiers: [
                          barbe.asTraversal("aws_cloudfront_origin_access_identity.origin_access_id.iam_arn")
                      ],
                  }]),
              },
              {
                  actions: ["s3:ListBucket"],
                  resources: [
                      barbe.asTraversal("aws_s3_bucket.origin.arn"),
                  ],
                  principals: barbe.asBlock([{
                      type: "AWS",
                      identifiers: [
                          barbe.asTraversal("aws_cloudfront_origin_access_identity.origin_access_id.iam_arn")
                      ],
                  }]),
              }
          ])
      }),
    cloudResource("aws_s3_bucket_policy", "origin_policy", {
        bucket: barbe.asTraversal("aws_s3_bucket.origin.id"),
        policy: barbe.asTraversal("data.aws_iam_policy_document.origin_policy.json")
    }),
    cloudOutput(null, "static_hosting_cf_distrib", {
        value: barbe.asTraversal("aws_cloudfront_distribution.distribution.id")
    }),
    cloudData("aws_cloudfront_cache_policy", "caching_optimized", {
        name: "Managed-CachingOptimized",
    }),
    cloudResource("aws_cloudfront_distribution", "distribution", {
         local rootObj = std.get(opt, "root_object", "index.html"),

         enabled: true,
         default_root_object: rootObj,
         is_ipv6_enabled: true,
         price_class: "PriceClass_All",

         restrictions: barbe.asBlock([{
             geo_restriction: barbe.asBlock([{
                 restriction_type: "none"
             }])
         }]),

         origin: barbe.asBlock([{
             domain_name: barbe.asTraversal("aws_s3_bucket.origin.bucket_regional_domain_name"),
             origin_id: "bucket",
             s3_origin_config: barbe.asBlock([{
                 origin_access_identity: barbe.asTraversal("aws_cloudfront_origin_access_identity.origin_access_id.cloudfront_access_identity_path")
             }])
         }]),

         default_cache_behavior: barbe.asBlock([{
            allowed_methods: ["GET", "HEAD", "OPTIONS"],
            cached_methods: ["GET", "HEAD"],
            target_origin_id: "bucket",
            viewer_protocol_policy: "redirect-to-https",
            compress: true,

            cache_policy_id: barbe.asTraversal("data.aws_cloudfront_cache_policy.caching_optimized.id"),

            lambda_function_association: barbe.asBlock([{
                event_type: "origin-request",
                lambda_arn: barbe.asTraversal("aws_function.origin-request.qualified_arn"),
                include_body: false
            }]),
         }]),

         custom_error_response: barbe.asBlock([{
             error_caching_min_ttl: 0,
             error_code: 404,
             response_code: 200,
             response_page_path: barbe.appendToTemplate(barbe.asSyntax("/"), [rootObj])
         }]),

         aliases: domainNames,
         viewer_certificate: barbe.asBlock([
             if std.length(domainNames) == 0 then
                 {
                     cloudfront_default_certificate: true
                 }
             else if std.objectHas(opt, "certificate_arn") then
                 {
                     acm_certificate_arn: opt.certificate_arn,
                     ssl_support_method: "sni-only",
                     minimum_protocol_version: "TLSv1.2_2021",
                 }
             else if std.objectHas(opt, "existing_certificate_domain") then
                 {
                     acm_certificate_arn: barbe.asTraversal("data.aws_acm_certificate.imported_certificate.arn"),
                     ssl_support_method: "sni-only",
                     minimum_protocol_version: "TLSv1.2_2021",
                 }
             else if std.objectHas(opt, "certificate_domain_to_create") then
                 {
                     acm_certificate_arn: barbe.asTraversal("aws_acm_certificate_validation.validation.certificate_arn"),
                     ssl_support_method: "sni-only",
                     minimum_protocol_version: "TLSv1.2_2021",
                 }
             else if std.length(domainNames) > 1 then
                 error "<showuser>no certificate_domain_to_create, existing_certificate_domain or certificate_arn given with multiple domain names. The easy way to fix this is to provide a certificate_domain_to_create like '*.domain.com'</showuser>"
             else
                 {
                     acm_certificate_arn: barbe.asTraversal("data.aws_acm_certificate.imported_certificate.arn"),
                     ssl_support_method: "sni-only",
                     minimum_protocol_version: "TLSv1.2_2021",
                 }
         ])
     }),

    if std.length(domainNames) > 0 then
        //TODO What if the user owns a domain that's not on AWS? (have ability to create route53 hosted zone + return the domain records)
        [
            cloudData("aws_route53_zone", "zone", {
                name: opt.zone
            }),
            [
                cloudResource("aws_route53_record", "cf_distrib_domain_record", {
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
        if !std.objectHas(opt, "certificate_arn") then
            if std.objectHas(opt, "existing_certificate_domain") then
                cloudData("aws_acm_certificate", "imported_certificate", {
                    domain: opt.existing_certificate_domain,
                    types: ["AMAZON_ISSUED"],
                    most_recent: true
                })
            else if std.objectHas(opt, "certificate_domain_to_create") then
                acmCertificateResources({
                    cloudResource: cloudResource,
                    domain: opt.certificate_domain_to_create,
                    zone_id: barbe.asTraversal("data.aws_route53_zone.zone.zone_id"),
                })
            else if std.length(domainNames) == 1 then
                acmCertificateResources({
                    cloudResource: cloudResource,
                    domain: domainNames[0],
                    zone_id: barbe.asTraversal("data.aws_route53_zone.zone.zone_id"),
                })
];

barbe.pipelines([{
    generate: [
        function(container) barbe.databags([
            barbe.iterateBlocks(container, "aws_cloudfront_static_hosting", function(bag)
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                
                if std.extVar("barbe_command") != "destroy" then
                    {
                        Type: "buildkit_run_in_container",
                        Name: "aws_cloudfront_static_hosting_gen_origin_req_" + bag.Name,
                        Value: {
                            local baseScriptJs = |||
                                const locations = {
                                    {{LOCATIONS}}
                                }

                                exports.handler = (event, context, callback) => {
                                    const request = event.Records[0].cf.request;
                                    const headers = request.headers;

                                    if(request.uri.substring(1) in locations) {
                                        callback(null, request);
                                        return
                                    }

                                    if (request.uri === "/") {
                                        request.uri = "/%(root_object)s";
                                    }

                                    if (request.uri.endsWith("/")) {
                                        const redirectResponse = {
                                            status: '301',
                                            statusDescription: 'Moved Permanently',
                                            headers: {
                                                'location': [{
                                                    key: 'Location',
                                                    value: request.uri.substring(0, request.uri.length - 1),
                                                }],
                                                'cache-control': [{
                                                    key: 'Cache-Control',
                                                    value: "max-age=3600"
                                                }],
                                            },
                                        };
                                        callback(null, redirectResponse)
                                        return
                                    }

                                    if (!request.uri.endsWith(".html")) {
                                        (() => {
                                            //receiving something like /docs

                                            let toFind = request.uri.substring(1)
                                            if (toFind in locations) {
                                                return
                                            }

                                            // trying file "docs.html"
                                            toFind += ".html"
                                            if (toFind in locations) {
                                                request.uri = "/" + toFind
                                                return
                                            }

                                            // trying file "docs/index.html"
                                            toFind = toFind.substring(0, toFind.length - ".html".length)
                                            toFind += "/index.html"
                                            if (toFind in locations) {
                                                request.uri = "/" + toFind
                                                return
                                            }
                                            console.log("not found for object request: '" + request.uri + "'")
                                        })()
                                    }

                                    callback(null, request);
                                };
                            ||| % {
                                root_object: barbe.asStr(std.get(fullBlock, "root_object", "index.html"))
                            },
                            local listerGo = |||
                                package main

                                import (
                                    "bytes"
                                    "os"
                                    "path/filepath"
                                    "strings"
                                )

                                //this is here cause the escaping mecanism of jsonnet doesnt work properly
                                const l = "\\n"

                                func main() {
                                    err := listAllFiles()
                                    if err != nil {
                                        panic(err)
                                    }
                                }

                                func listAllFiles() error {
                                    var files []string
                                    err := filepath.WalkDir(".", func(path string, d os.DirEntry, err error) error {
                                        if err != nil {
                                            return err
                                        }
                                        if !d.IsDir() {
                                            files = append(files, path)
                                        }
                                        return nil
                                    })
                                    if err != nil {
                                        return err
                                    }

                                    output := strings.Builder{}
                                    for i, file := range files {
                                        if file == "lister.go" || file == "origin_request.js" {
                                            continue
                                        }
                                        if i != 0 {
                                            output.WriteString("    ")
                                        }
                                        output.WriteString("\"")
                                        output.WriteString(file)
                                        output.WriteString("\": true")
                                        if i != len(files)-1 {
                                            output.WriteString(",")
                                            output.WriteString(l)
                                        }
                                    }

                                    template, err := os.ReadFile("origin_request.js")
                                    if err != nil {
                                        return err
                                    }

                                    template = bytes.ReplaceAll(template, []byte("{{LOCATIONS}}"), []byte(output.String()))
                                    return os.WriteFile("origin_request.js", template, 0644)
                                }
                            |||,
                            no_cache: true,
                            display_name: "λ Codegen - aws_cloudfront_static_hosting." + bag.Name,
                            dockerfile: |||
                                FROM golang:1.18-alpine AS builder

                                COPY --from=src ./%(build_dir)s /src
                                WORKDIR /src

                                RUN printf %(base_script)s > origin_request.js
                                RUN printf %(lister_go)s > lister.go
                                RUN go run lister.go
                            ||| % {
                                build_dir: barbe.asStr(fullBlock.build_dir),
                                base_script: std.escapeStringJson(baseScriptJs),
                                lister_go: std.escapeStringJson(listerGo),
                            },
                            exported_file: {
                                "origin_request.js": "aws_cf_static_hosting_" + bag.Name + "/origin_request.js",
                            }
                        }
                    }
            )
        ]),
        function(container) barbe.databags([
            barbe.iterateBlocks(container, "aws_cloudfront_static_hosting", function(bag)
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));

                [
                    if std.objectHas(container, "cr_[terraform]") then
                        local tfBlock = barbe.visitTokens(
                            container["cr_[terraform]"][""][0].Value,
                            function(token)
                                if token.Type == "literal_value" && std.isString(token.Value) && std.length(std.findSubstr(".tfstate", token.Value)) > 0 then
                                    {
                                        Type: "literal_value",
                                        Meta: std.get(token, "Meta", null),
                                        Value: std.strReplace(token.Value, ".tfstate", "_aws_cf_static_hosting_" + bag.Name + ".tfstate"),
                                    }
                                else
                                    false
                        ) + {
                            Meta: { sub_dir: "aws_cf_static_hosting_" + bag.Name }
                        };
                        [{
                            Name: "aws_cf_static_hosting_" + bag.Name,
                            Type: "cr_[terraform(aws_cf_static_hosting_" + bag.Name + ")]",
                            Value: tfBlock,
                        },
                        {

                            Type: "barbe_state(put_in_object)",
                            Name: "aws_cf_static_hosting_created_tfstate",
                            Value: {
                                [bag.Name]: tfBlock,
                            },
                        }]
                    else
                        null
                    ,
                    staticFileDistribAWS(std.prune({
                        name: bag.Name,
                        cloudResourceKindFactory: cloudResourceAbstractFactory("aws_cf_static_hosting_" + bag.Name, "aws_cf_static_hosting_" + bag.Name),
                        region: std.get(fullBlock, "region", std.get(env, "AWS_REGION", "us-east-1")),
                        name_prefix: barbe.appendToTemplate(namePrefix, [bag.Name + "-"]),
                        root_object: std.get(fullBlock, "root_object", null),
                        zone: std.get(fullBlock, "zone", null),
                        domain_names: std.get(fullBlock, "domain_names", null),
                        certificate_domain_to_create: std.get(fullBlock, "certificate_domain_to_create", null),
                    })),
                    barbe.importComponent(
                        container,
                        "aws_cloudfront_static_hosting_aws_iam_" + bag.Name,
                        "https://hub.barbe.app/barbe-serverless/aws_iam/v0.1.0/.jsonnet",
                        [],
                        [{
                            Type: "aws_iam_lambda_role",
                            Name: "default",
                            Value: {
                                cloudresource_dir: "aws_cf_static_hosting_" + bag.Name,
                                assumable_by: ["edgelambda.amazonaws.com", "lambda.amazonaws.com"],
                                name_prefix: [barbe.appendToTemplate(namePrefix, [bag.Name + "-"])],
                            }
                        }]
                    ),
                    barbe.importComponent(
                        container,
                        "aws_cloudfront_static_hosting_aws_lambda_" + bag.Name,
                        "https://hub.barbe.app/barbe-serverless/aws_lambda/v0.1.0/.jsonnet",
                        [],
                        [{
                            Type: "aws_function",
                            Name: "origin-request",
                            Value: {
                                cloudresource_dir: "aws_cf_static_hosting_" + bag.Name,
                                cloudresource_id: "aws_cf_static_hosting_" + bag.Name,
                                package: [{
                                    file_map: {
                                        "*": "origin_request.js"
                                    },
                                    include: [
                                        std.extVar("barbe_output_dir") + "/aws_cf_static_hosting_" + bag.Name + "/origin_request.js"
                                    ]
                                }],
                                handler: "origin_request.handler",
                                runtime: "nodejs16.x",
                                timeout: 30,
                                name_prefix: [barbe.appendToTemplate(namePrefix, [bag.Name + "-"])],
                            }
                        }]
                    )
                ]
            )
        ])
    ],
    apply: [
        function(container) barbe.databags([
            local tfExecute = barbe.iterateBlocks(container, "aws_cloudfront_static_hosting", function(bag)
                {
                    Type: "terraform_execute",
                    Name: "aws_cloudfront_static_hosting_" + bag.Name,
                    Value: {
                        display_name: "Terraform apply - aws_cloudfront_static_hosting." + bag.Name,
                        mode: "apply",
                        dir: std.extVar("barbe_output_dir") + "/aws_cf_static_hosting_" + bag.Name,
                    }
                }
            );
            local forImport = 
                if std.objectHas(container, "cr_[terraform]") then
                    barbe.flatten([
                        tfExecute,
                        emptyExecuteTemplate(container, state, "aws_cloudfront_static_hosting", "aws_cf_static_hosting_created_tfstate")
                    ])
                else
                    tfExecute
                ;
            barbe.importComponent(
                container,
                "aws_cloudfront_static_hosting",
                "https://hub.barbe.app/barbe-serverless/terraform_execute/v0.1.0/.jsonnet",
                [],
                forImport
            ),
        ]),
        function(container) barbe.databags([
            local forImport = barbe.iterateBlocks(container, "aws_cloudfront_static_hosting", function(bag)
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                {
                    Type: "aws_s3_sync_files",
                    Name: "sync_" + bag.Name,
                    Value: std.prune({
                        display_name: "Uploading files to S3 - " + bag.Name,
                        local outputs = barbe.asValArrayConst(container.terraform_execute_output["aws_cloudfront_static_hosting_" + bag.Name][0].Value),
                        bucket_name: [pair.value for pair in outputs if barbe.asStr(pair.key) == "static_hosting_s3_bucket"][0],
                        delete: true,
                        blob: fullBlock.build_dir,
                    })
                }
            );
            barbe.importComponent(
                container,
                "aws_cloudfront_static_hosting",
                "https://hub.barbe.app/anyfront/aws_s3_sync_files/v0.1.0/.jsonnet",
                [],
                forImport
            ),
            if std.objectHas(container, "terraform_empty_execute_output") then
                [
                    {
                        Type: "barbe_state(delete_from_object)",
                        Name: "aws_cf_static_hosting_created_tfstate",
                        Value: std.strReplace(name, "aws_cf_static_hosting_created_tfstate_destroy_missing_", ""),
                    }
                    for name in std.objectFields(container.terraform_empty_execute_output)
                    if std.member(name, "aws_cf_static_hosting_created_tfstate_destroy_missing_") && !std.objectHas(std.get(container, "aws_cloudfront_static_hosting", {}), name)
                ]
            ,
            {
                Name: "aws_cf_invalidate_credentials",
                Type: "aws_credentials_request",
                Value: {}
            }
        ]),
        function(container) barbe.databags([
            barbe.iterateBlocks(container, "aws_cloudfront_static_hosting", function(bag)
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                    local outputs = barbe.asValArrayConst(container.terraform_execute_output["aws_cloudfront_static_hosting_" + bag.Name][0].Value);
                    local cfDistribId = barbe.asStr([pair.value for pair in outputs if barbe.asStr(pair.key) == "static_hosting_cf_distrib"][0]);
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
                    Name: "aws_cf_static_hosting_invalidate_" + bag.Name,
                    Value: {
                        no_cache: true,
                        display_name: "Invalidate CloudFront distribution - aws_cloudfront_static_hosting." + bag.Name,
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
            local forImport = barbe.iterateBlocks(container, "aws_cloudfront_static_hosting", function(bag)
                {
                    Type: "terraform_execute",
                    Name: "aws_cloudfront_static_hosting_destroy_" + bag.Name,
                    Value: {
                        display_name: "Terraform destroy - aws_cloudfront_static_hosting." + bag.Name,
                        mode: "destroy",
                        dir: std.extVar("barbe_output_dir") + "/aws_cf_static_hosting_" + bag.Name,
                    }
                }
            );
            barbe.importComponent(
                container,
                "aws_cloudfront_static_hosting",
                "https://hub.barbe.app/barbe-serverless/terraform_execute/v0.1.0/.jsonnet",
                [],
                forImport
            ),
        ]),
        function(container) barbe.databags([
            barbe.iterateBlocks(container, "aws_cloudfront_static_hosting", function(bag)
                {
                    Type: "barbe_state(delete_from_object)",
                    Name: "aws_cf_static_hosting_created_tfstate",
                    Value: bag.Name,
                }
            ),
        ])
    ]
}])