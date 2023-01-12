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
            display_name: "Terraform destroy - gcp_next_js." + name,
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

local gcpProjectSetup(bagName, fullBlock, namePrefix) = {
    Name: bagName,
    Type: "gcp_project_setup",
    Value: {
        project_id: std.get(fullBlock, "project_id", null),
        project_name: barbe.appendToTemplate(namePrefix, [bagName]),
        organization_id: std.get(fullBlock, "organization_id", null),
        organization_domain: std.get(fullBlock, "organization_domain", null),
        billing_account_name: std.get(fullBlock, "billing_account_name", null),
        billing_account_id: std.get(fullBlock, "billing_account_id", null),
        services_to_activate: [
            "run.googleapis.com",
            "compute.googleapis.com",
            "dns.googleapis.com",
        ],
    }
};

barbe.pipelines([{
    generate: [
        function(container) barbe.databags([
            barbe.iterateBlocks(container, "gcp_next_js", function(bag)
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                local dotBuild = barbe.asVal(barbe.mergeTokens(std.get(fullBlock, "build", barbe.asSyntax([])).ArrayConst));
                local dotDomain = barbe.asVal(barbe.mergeTokens(std.get(fullBlock, "domain", barbe.asSyntax([])).ArrayConst));
                local cloudResourceKindFactory = cloudResourceAbstractFactory("gcp_next_js_" + bag.Name, "gcp_next_js_" + bag.Name);
                local cloudResource = cloudResourceKindFactory("resource");
                local cloudData = cloudResourceKindFactory("data");
                local cloudOutput = cloudResourceKindFactory("output");
                local cloudProvider = cloudResourceKindFactory("provider");
                local cloudVariable = cloudResourceKindFactory("variable");
                [
                    if std.extVar("barbe_command") != "destroy" && !barbe.asVal(std.get(dotBuild, "disabled", barbe.asSyntax(false))) then
                        {
                            Type: "buildkit_run_in_container",
                            Name: "gcp_next_js_" + bag.Name,
                            Value: {
                                display_name: "Next.js build - " + bag.Name,
                                excludes: [
                                    "**/node_modules",
                                    "node_modules",
                                ],
                                dockerfile: |||
                                    # https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile
                                    # Rebuild the source code only when needed
                                    FROM node:%(node_version)s-alpine AS builder
                                    RUN apk add --no-cache libc6-compat

                                    WORKDIR /app
                                    COPY --from=src ./%(app_dir)s .
                                    
                                    ENV NEXT_TELEMETRY_DISABLED 1
                                    RUN %(install_cmd)s
                                    RUN %(build_cmd)s

                                    # Production image, copy all the files and run next
                                    FROM scratch
                                    WORKDIR /app

                                    COPY --from=builder /app/public ./public
                                    COPY --from=builder /app/.next/standalone ./
                                    COPY --from=builder /app/.next/static ./.next/static
                                ||| % {
                                    node_version: barbe.asStr(std.get(dotBuild, "nodejs_version", std.get(fullBlock, "nodejs_version", "16"))),
                                    app_dir: barbe.asStr(std.get(dotBuild, "app_dir", std.get(fullBlock, "app_dir", "."))),
                                    install_cmd: barbe.asStr(std.get(dotBuild, "install_cmd", "npm install")),
                                    build_cmd: barbe.asStr(std.get(dotBuild, "build_cmd", "npm run build")),
                                },
                                exported_files: {
                                    ".": "gcp_next_js_" + bag.Name + "/build",
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
                                        Value: std.strReplace(token.Value, ".tfstate", "_gcp_next_js_" + bag.Name + ".tfstate"),
                                    }
                                else
                                    false
                        ) + {
                            Meta: { sub_dir: "gcp_next_js_" + bag.Name }
                        };
                        [{
                            Name: "gcp_next_js_" + bag.Name,
                            Type: "cr_[terraform(gcp_next_js_" + bag.Name + ")]",
                            Value: tfBlock,
                        },
                        {

                            Type: "barbe_state(put_in_object)",
                            Name: "gcp_next_js_created_tfstate",
                            Value: {
                                [bag.Name]: tfBlock,
                            },
                        }]
                    else
                        null
                    ,
                    cloudVariable(null, "gcp_project", {
                        type: barbe.asTraversal("string")
                    }),
                    cloudProvider(null, "google", {
                        region: std.get(fullBlock, "region", "us-central1"),
                        project: barbe.asTraversal("var.gcp_project")
                    }),
                    cloudResource("google_cloud_run_service", "cloudrun", {
                        name: barbe.appendToTemplate(namePrefix, [bag.Name + "-cloudrun-srv"]),
                        location: std.get(fullBlock, "region", "us-central1"),
                        autogenerate_revision_name: true,
                        template: barbe.asBlock([{
                            spec: barbe.asBlock([{
                                containers: barbe.asBlock([{
                                    image: barbe.asTemplate([
                                        "gcr.io/",
                                        barbe.asTraversal("var.gcp_project"),
                                        "/",
                                        barbe.asStr(barbe.appendToTemplate(namePrefix, ["next-", bag.Name])),
                                        ":latest",
                                    ])
                                }]),
                            }])
                        }]),
                        traffic: barbe.asBlock([{
                            percent: 100,
                            latest_revision: true
                        }])
                    }),
                    cloudData("google_iam_policy", "noauth", {
                        binding: barbe.asBlock([{
                            role: "roles/run.invoker",
                            members: ["allUsers"]
                        }])
                    }),
                    cloudResource("google_cloud_run_service_iam_policy", "noauth", {
                        location: barbe.asTraversal("google_cloud_run_service.cloudrun.location"),
                        service: barbe.asTraversal("google_cloud_run_service.cloudrun.name"),
                        project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                        policy_data: barbe.asTraversal("data.google_iam_policy.noauth.policy_data")
                    }),
                    cloudResource("google_compute_global_address", "lb_ip",  {
                        project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                        name: barbe.appendToTemplate(namePrefix, [bag.Name + "-lb-ip"])
                    }),
                    cloudResource("google_compute_region_network_endpoint_group", "lb_epgroup", {
                        project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                        name: barbe.appendToTemplate(namePrefix, [bag.Name + "-lb-neg"]),
                        region: std.get(fullBlock, "region", "us-central1"),
                        network_endpoint_type: "SERVERLESS",
                        cloud_run: barbe.asBlock([{
                            service: barbe.asTraversal("google_cloud_run_service.cloudrun.name")
                        }])
                    }),
                    cloudResource("google_compute_backend_service", "lb_backend", {
                        project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                        name: barbe.appendToTemplate(namePrefix, [bag.Name + "-lb-backend"]),
                        load_balancing_scheme: "EXTERNAL_MANAGED",
                        enable_cdn: true,

                        backend: barbe.asBlock([{
                            balancing_mode: "UTILIZATION",
                            capacity_scaler: 0.85,
                            group: barbe.asTraversal("google_compute_region_network_endpoint_group.lb_epgroup.id")
                        }]),
                        cdn_policy: barbe.asBlock([{
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
                        project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                        name: barbe.appendToTemplate(namePrefix, [bag.Name + "-lb-urlmap"]),
                        default_service: barbe.asTraversal("google_compute_backend_service.lb_backend.id"),

                        path_matcher: barbe.asBlock([{
                            name: "allpaths",
                            default_service: barbe.asTraversal("google_compute_backend_service.lb_backend.id"),
                            route_rules: barbe.asBlock([{
                                priority: 1,
                                url_redirect: barbe.asBlock([{
                                    https_redirect: true,
                                    redirect_response_code: "MOVED_PERMANENTLY_DEFAULT",
                                }])
                            }])
                        }])
                    }),
                    if std.objectHas(dotDomain, "name") then
                        [
                            cloudResource("google_compute_target_https_proxy", "lb_target_https", {
                                project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                                name: barbe.appendToTemplate(namePrefix, [bag.Name + "-https-proxy"]),
                                url_map: barbe.asTraversal("google_compute_url_map.lb_urlmap.id"),
                                ssl_certificates: [barbe.asTraversal("google_compute_managed_ssl_certificate.lb_ssl_cert.name")]
                            }),
                            cloudResource("google_compute_global_forwarding_rule", "lb_forwarding", {
                                project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                                name: barbe.appendToTemplate(namePrefix, [bag.Name + "-lb-forwarding"]),
                                load_balancing_scheme: "EXTERNAL_MANAGED",
                                target: barbe.asTraversal("google_compute_target_https_proxy.lb_target_https.id"),
                                ip_address: barbe.asTraversal("google_compute_global_address.lb_ip.id"),
                                port_range: "443"
                            }),
                            cloudResource("google_compute_url_map", "lb_redirect_to_https", {
                                project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                                name: barbe.appendToTemplate(namePrefix, [bag.Name + "-lb-redirect-to-https-urlmap"]),

                                default_url_redirect: barbe.asBlock([{
                                    redirect_response_code: "MOVED_PERMANENTLY_DEFAULT",
                                    https_redirect: true,
                                    strip_query: false,
                                }])
                            }),
                            cloudResource("google_compute_target_http_proxy", "lb_target_http", {
                                project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                                name: barbe.appendToTemplate(namePrefix, [bag.Name + "-http-proxy"]),
                                url_map: barbe.asTraversal("google_compute_url_map.lb_redirect_to_https.id")
                            }),
                            cloudResource("google_compute_global_forwarding_rule", "lb_http_forwarding", {
                                project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                                name: barbe.appendToTemplate(namePrefix, [bag.Name + "-http-forwarding"]),
                                target: barbe.asTraversal("google_compute_target_http_proxy.lb_target_http.id"),
                                ip_address: barbe.asTraversal("google_compute_global_address.lb_ip.id"),
                                port_range: "80"
                            }),
                        ]
                    else 
                        [
                            cloudResource("google_compute_target_http_proxy", "lb_target_http", {
                                project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                                name: barbe.appendToTemplate(namePrefix, [bag.Name + "-http-proxy"]),
                                url_map: barbe.asTraversal("google_compute_url_map.lb_urlmap.id")
                            }),
                            cloudResource("google_compute_global_forwarding_rule", "lb_http_forwarding", {
                                project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                                name: barbe.appendToTemplate(namePrefix, [bag.Name + "-http-forwarding"]),
                                load_balancing_scheme: "EXTERNAL_MANAGED",
                                target: barbe.asTraversal("google_compute_target_http_proxy.lb_target_http.id"),
                                ip_address: barbe.asTraversal("google_compute_global_address.lb_ip.id"),
                                port_range: "80"
                            }),
                        ]
                    ,
                    cloudOutput(null, "load_balancer_ip_addr", {
                        value: barbe.asTraversal("google_compute_global_address.lb_ip.address")
                    }),
                    cloudOutput(null, "load_balancer_url_map", {
                        value: barbe.asTraversal("google_compute_url_map.lb_urlmap.name")
                    }),
                    cloudOutput(null, "cloudrun_service_name", {
                        value: barbe.asTraversal("google_cloud_run_service.cloudrun.name")
                    }),
                    if std.objectHas(dotDomain, "name") then
                        [
                            cloudResource("google_compute_managed_ssl_certificate", "lb_ssl_cert", {
                                project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                                name: barbe.appendToTemplate(namePrefix, [bag.Name + "-lb-ssl-cert"]),
                                managed: barbe.asBlock([{
                                    domains: [barbe.appendToTemplate(dotDomain.name, [barbe.asSyntax(".")])]
                                }])
                            }),
                            cloudResource("google_dns_record_set", "lb_dns", {
                                project: std.get(dotDomain, "zone_project", barbe.asTraversal("google_cloud_run_service.cloudrun.project")),
                                name: barbe.appendToTemplate(dotDomain.name, [barbe.asSyntax(".")]),
                                type: "A",
                                ttl: 300,
                                managed_zone: dotDomain.zone,
                                rrdatas: [barbe.asTraversal("google_compute_global_address.lb_ip.address")]
                            }),
                        ]
                ]
            ),
            local forImport = barbe.iterateBlocks(container, "gcp_next_js", function(bag)
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                gcpProjectSetup(bag.Name, fullBlock, namePrefix)
            );
            barbe.importComponent(
                container,
                "gcp_next_js",
                "https://hub.barbe.app/anyfront/gcp_project_setup/v0.1.0/.jsonnet",
                ["cr_[terraform]"],
                forImport
            ),
        ])
    ],
    apply: [
        function(container) barbe.databags([
            local forImport = barbe.iterateBlocks(container, "gcp_next_js", function(bag)
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                gcpProjectSetup(bag.Name, fullBlock, namePrefix)
            );
            barbe.importComponent(
                container,
                "gcp_next_js",
                "https://hub.barbe.app/anyfront/gcp_project_setup/v0.1.0/.jsonnet",
                ["cr_[terraform]"],
                forImport
            ),
            {
                Name: "gcp_next_js_credentials",
                Type: "gcp_token_request",
                Value: {}
            },
        ]),
        function(container) barbe.databags([
            barbe.iterateBlocks(container, "gcp_next_js", function(bag)
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                local dotBuild = barbe.asVal(barbe.mergeTokens(std.get(fullBlock, "build", barbe.asSyntax([])).ArrayConst));
                local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                local gcpAccessToken = barbe.asStr(barbe.asVal(container.gcp_token.gcp_next_js_credentials[0].Value).access_token);

                if std.objectHas(container, "gcp_project_setup_output") && std.objectHas(container.gcp_project_setup_output, bag.Name) then
                    local gcpSetupProjectName = barbe.asStr(barbe.asVal(container.gcp_project_setup_output[bag.Name][0].Value).project_name);
                    {
                        Type: "buildkit_run_in_container",
                        Name: bag.Name + "_gcp_next_js",
                        Value: {
                            local deployedDockerfile = |||
                                # https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile
                                FROM node:%(node_version)s-alpine
                                WORKDIR /app

                                ENV NODE_ENV production
                                ENV NEXT_TELEMETRY_DISABLED 1

                                COPY . .

                                EXPOSE 8080
                                ENV PORT 8080
                                CMD ["node", "server.js"]
                            ||| % {
                                node_version: barbe.asStr(std.get(dotBuild, "nodejs_version", std.get(fullBlock, "nodejs_version", "16"))),
                            },
                            dockerfile: |||
                                FROM docker

                                RUN echo "%(access_token)s" | docker login -u oauth2accesstoken --password-stdin https://gcr.io

                                COPY --from=src ./%(build_dir)s /src
                                WORKDIR /src

                                RUN mkdir __barbe_tmp
                                RUN printf %(deployed_dockerfile)s > ./__barbe_tmp/Dockerfile

                                RUN --mount=type=ssh,id=docker.sock,target=/var/run/docker.sock docker build -f __barbe_tmp/Dockerfile -t gcr.io/%(gcp_project_name)s/%(img_name)s .
                                RUN --mount=type=ssh,id=docker.sock,target=/var/run/docker.sock docker push gcr.io/%(gcp_project_name)s/%(img_name)s

                                RUN touch tmp
                            ||| % {
                                gcp_project_name: gcpSetupProjectName,
                                img_name: barbe.asStr(barbe.appendToTemplate(namePrefix, ["next-", bag.Name])),
                                build_dir: std.extVar("barbe_output_dir") + "/gcp_next_js_" + bag.Name + "/build",
                                access_token: gcpAccessToken,
                                deployed_dockerfile: std.escapeStringJson(deployedDockerfile),
                            },
                            no_cache: true,
                            exported_file: "tmp",
                            display_name: "Image build - gcp_next_js." + bag.Name,
                        }
                    }
            ),
        ]),
        function(container) barbe.databags([
            local tfExecute = barbe.iterateBlocks(container, "gcp_next_js", function(bag)
                if std.objectHas(container, "gcp_project_setup_output") && std.objectHas(container.gcp_project_setup_output, bag.Name) then
                    local gcpSetupProjectName = barbe.asStr(barbe.asVal(container.gcp_project_setup_output[bag.Name][0].Value).project_name);
                    {
                        Type: "terraform_execute",
                        Name: "gcp_next_js_apply_" + bag.Name,
                        Value: {
                            display_name: "Terraform apply - gcp_next_js." + bag.Name,
                            mode: "apply",
                            dir: std.extVar("barbe_output_dir") + "/gcp_next_js_" + bag.Name,
                            variable_values: [{
                                key: "gcp_project",
                                value: gcpSetupProjectName
                            }]
                        }
                    }
                else { Type: "", Name: "", Value: {} }
            );
            local forImport = 
                if std.objectHas(container, "cr_[terraform]") then
                    barbe.flatten([
                        tfExecute,
                        emptyExecuteTemplate(container, state, "gcp_next_js", "gcp_next_js_created_tfstate")
                    ])
                else 
                    tfExecute;
            barbe.importComponent(
                container,
                "gcp_next_js",
                "https://hub.barbe.app/barbe-serverless/terraform_execute/v0.1.0/.jsonnet",
                [],
                forImport
            ),
        ]),
        function(container) barbe.databags([
            if std.objectHas(container, "terraform_empty_execute_output") then
                [
                    {
                        Type: "barbe_state(delete_from_object)",
                        Name: "gcp_next_js_created_tfstate",
                        Value: std.strReplace(name, "gcp_next_js_created_tfstate_destroy_missing_", ""),
                    }
                    for name in std.objectFields(container.terraform_empty_execute_output)
                    if std.member(name, "gcp_next_js_created_tfstate_destroy_missing_") && !std.objectHas(std.get(container, "gcp_next_js", {}), name)
                ],
            if std.objectHas(container, "terraform_execute_output") then
                barbe.iterateBlocks(container, "gcp_next_js", function(bag)
                    local block = barbe.asVal(bag.Value);
                    local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                    local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                    local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                    local outputs = barbe.asValArrayConst(container.terraform_execute_output["gcp_next_js_apply_" + bag.Name][0].Value);
                    local cloudrunServiceName = barbe.asStr([pair.value for pair in outputs if barbe.asStr(pair.key) == "cloudrun_service_name"][0]);
                    local urlMapName = barbe.asStr([pair.value for pair in outputs if barbe.asStr(pair.key) == "load_balancer_url_map"][0]);
                    local gcpAccessToken = barbe.asStr(barbe.asVal(container.gcp_token.gcp_next_js_credentials[0].Value).access_token);
                    if std.objectHas(container, "gcp_project_setup_output") && std.objectHas(container.gcp_project_setup_output, bag.Name) then
                        local gcpSetupProjectName = barbe.asStr(barbe.asVal(container.gcp_project_setup_output[bag.Name][0].Value).project_name);
                        {
                            Type: "buildkit_run_in_container",
                            Name: "gcp_next_js_invalidate_" + bag.Name,
                            Value: {
                                display_name: "Invalidate CDN - gcp_next_js." + bag.Name,
                                no_cache: true,
                                dockerfile: |||
                                    FROM google/cloud-sdk:%(gcp_sdk_version)s

                                    ENV CLOUDSDK_AUTH_ACCESS_TOKEN="%(gcp_access_token)s"
                                    ENV CLOUDSDK_CORE_DISABLE_PROMPTS=1

                                    RUN gcloud run deploy %(service_name)s --image gcr.io/%(gcp_project_name)s/%(img_name)s --project %(gcp_project_name)s --region %(gcp_region)s --quiet
                                    RUN gcloud beta compute url-maps invalidate-cdn-cache %(url_map_name)s --path "/*" --project %(gcp_project_name)s --async --quiet
                                ||| % {
                                    //TODO version selection
                                    gcp_sdk_version: "slim",
                                    service_name: cloudrunServiceName,
                                    gcp_region: barbe.asStr(std.get(fullBlock, "region", "us-central1")),
                                    gcp_project_name: gcpSetupProjectName,
                                    img_name: barbe.asStr(barbe.appendToTemplate(namePrefix, ["next-", bag.Name])),
                                    url_map_name: urlMapName,
                                    gcp_access_token: gcpAccessToken,
                                },
                            }
                        }
                ),
        ])
    ],
    destroy: [
        function(container) barbe.databags([
            //we re-create the gcp_project_setup blocks to avoid requiring the calling component
            //to pass them in between the generate and apply phases
            local forImport = barbe.iterateBlocks(container, "gcp_next_js", function(bag)
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                gcpProjectSetup(bag.Name, fullBlock, namePrefix)
            );
            barbe.importComponent(
                container,
                "gcp_next_js",
                "https://hub.barbe.app/anyfront/gcp_project_setup/v0.1.0/.jsonnet",
                ["cr_[terraform]"],
                forImport
            ),
        ]),
        function(container) barbe.databags([
            local forImport = barbe.iterateBlocks(container, "gcp_next_js", function(bag)
                if std.objectHas(container, "gcp_project_setup_output") && std.objectHas(container.gcp_project_setup_output, bag.Name) then
                    local gcpSetupProjectName = barbe.asStr(barbe.asVal(container.gcp_project_setup_output[bag.Name][0].Value).project_name);
                    {
                        Type: "terraform_execute",
                        Name: "gcp_next_js_destroy_" + bag.Name,
                        Value: {
                            display_name: "Terraform destroy - gcp_next_js." + bag.Name,
                            mode: "destroy",
                            dir: std.extVar("barbe_output_dir") + "/gcp_next_js_" + bag.Name,
                            variable_values: [{
                                key: "gcp_project",
                                value: gcpSetupProjectName
                            }]
                        }
                    }
                else { Type: "", Name: "", Value: {} }
            );
            barbe.importComponent(
                container,
                "gcp_next_js",
                "https://hub.barbe.app/barbe-serverless/terraform_execute/v0.1.0/.jsonnet",
                [],
                forImport
            ),
        ]),
        function(container) barbe.databags([
            barbe.iterateBlocks(container, "gcp_next_js", function(bag)
                {
                    Type: "barbe_state(delete_from_object)",
                    Name: "gcp_next_js_created_tfstate",
                    Value: bag.Name,
                }
            ),
        ])
    ]
}])