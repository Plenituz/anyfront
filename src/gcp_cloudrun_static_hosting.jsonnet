local barbe = std.extVar("barbe");
local state = std.extVar("state");
local container = std.extVar("container");
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

/*
name_prefix: prefix for the name of the resources
region: region to create the resources in
project_name: gcp project name
image_name: name of the image to use, should be an image stored on gcp's image store
domain: optional, domain name to use for the ssl certificate/domain of the load balancer
dns_zone: optional, dns zone to use for the domain of the load balancer
cloudResourceKindFactory: a function used to create cloud resources objects, should be (kind) => (type, name, value) => {databag}
*/
local gcpCloudrunStaticHosting(opt) =
    local cloudResource = opt.cloudResourceKindFactory("resource");
    local cloudData = opt.cloudResourceKindFactory("data");
    local cloudOutput = opt.cloudResourceKindFactory("output");
    local cloudVariable = opt.cloudResourceKindFactory("variable");
    local cloudProvider = opt.cloudResourceKindFactory("provider");
    [
    cloudVariable(null, "gcp_project", {
        type: barbe.asTraversal("string")
    }),
    cloudProvider(null, "google", {
        region: opt.region,
        project: barbe.asTraversal("var.gcp_project")
    }),
    cloudResource("google_cloud_run_service", "cloudrun", {
        name: barbe.appendToTemplate(opt.name_prefix, ["cloudrun-srv"]),
        location: opt.region,
        autogenerate_revision_name: true,
        template: barbe.asBlock([{
            spec: barbe.asBlock([{
                containers: barbe.asBlock([{
                    image: barbe.asTemplate([
                        "gcr.io/",
                        opt.project_name,
                        "/",
                        opt.image_name,
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
         name: barbe.appendToTemplate(opt.name_prefix, ["lb-ip"])
     }),
     cloudResource("google_compute_region_network_endpoint_group", "lb_epgroup", {
         project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
         name: barbe.appendToTemplate(opt.name_prefix, ["lb-neg"]),
         region: opt.region,
         network_endpoint_type: "SERVERLESS",
         cloud_run: barbe.asBlock([{
             service: barbe.asTraversal("google_cloud_run_service.cloudrun.name")
         }])
     }),
     cloudResource("google_compute_backend_service", "lb_backend", {
        project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
        name: barbe.appendToTemplate(opt.name_prefix, ["lb-backend"]),
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
         name: barbe.appendToTemplate(opt.name_prefix, ["lb-urlmap"]),
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
     cloudResource("google_compute_target_https_proxy", "lb_target_https", {
        project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
        name: barbe.appendToTemplate(opt.name_prefix, ["https-proxy"]),
        url_map: barbe.asTraversal("google_compute_url_map.lb_urlmap.id"),
        ssl_certificates:
            if std.objectHas(opt, "domain") then
                [barbe.asTraversal("google_compute_managed_ssl_certificate.lb_ssl_cert.name")]
            else
                []
    }),
    cloudResource("google_compute_global_forwarding_rule", "lb_forwarding", {
        project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
        name: barbe.appendToTemplate(opt.name_prefix, ["lb-forwarding"]),
        load_balancing_scheme: "EXTERNAL_MANAGED",
        target: barbe.asTraversal("google_compute_target_https_proxy.lb_target_https.id"),
        ip_address: barbe.asTraversal("google_compute_global_address.lb_ip.id"),
        port_range: "443"
    }),
    cloudResource("google_compute_url_map", "lb_https", {
        project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
        name: barbe.appendToTemplate(opt.name_prefix, ["lb-https-urlmap"]),

        default_url_redirect: barbe.asBlock([{
            redirect_response_code: "MOVED_PERMANENTLY_DEFAULT",
            https_redirect: true,
            strip_query: false,
        }])
    }),
    cloudResource("google_compute_target_http_proxy", "lb_target_http", {
        project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
        name: barbe.appendToTemplate(opt.name_prefix, ["http-proxy"]),
        url_map: barbe.asTraversal("google_compute_url_map.lb_https.id")
    }),
    cloudResource("google_compute_global_forwarding_rule", "lb_http_forwarding", {
        project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
        name: barbe.appendToTemplate(opt.name_prefix, ["http-forwarding"]),
        target: barbe.asTraversal("google_compute_target_http_proxy.lb_target_http.id"),
        ip_address: barbe.asTraversal("google_compute_global_address.lb_ip.id"),
        port_range: "80"
    }),
    cloudOutput(null, "load_balancer_ip_addr", {
        value: barbe.asTraversal("google_compute_global_address.lb_ip.address")
    }),
    cloudOutput(null, "load_balancer_url_map", {
        value: barbe.asTraversal("google_compute_url_map.lb_urlmap.name")
    }),
    cloudOutput(null, "cloudrun_service_name", {
        value: barbe.asTraversal("google_cloud_run_service.cloudrun.name")
    }),
    if std.objectHas(opt, "domain") then
        [
            cloudResource("google_compute_managed_ssl_certificate", "lb_ssl_cert", {
                project: barbe.asTraversal("google_cloud_run_service.cloudrun.project"),
                name: barbe.appendToTemplate(opt.name_prefix, ["lb-ssl-cert"]),
                managed: barbe.asBlock([{
                    domains: [opt.domain]
                }])
            }),
            cloudResource("google_dns_record_set", "lb_dns", {
                project: std.get(opt, "dns_zone_project", barbe.asTraversal("google_cloud_run_service.cloudrun.project")),
                name: opt.domain,
                type: "A",
                ttl: 300,
                managed_zone: opt.dns_zone,
                rrdatas: [barbe.asTraversal("google_compute_global_address.lb_ip.address")]
            }),
        ]
];


/*
name: name of the image, must be a plain string
buildDir: directory where the build files are located, relative to current dir
gcpAccessToken: google access token to login with docker
gcpProjectName: project name to use on GCP
rootObject: the default file, typically index.html
*/
local buildGCPNginxImage(opt) = [
    {
        Type: "buildkit_run_in_container",
        Name: opt.name + "_build_gcp_img",
        Value: {
            local listerGo = |||
                package main

                import (
                	"bytes"
                	"os"
                	"path"
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

                func writeLocation(nginxConf *strings.Builder, file string, line string) {
                	nginxConf.WriteString("     location /")
                	nginxConf.WriteString(file)
                	nginxConf.WriteString(" {")
                	nginxConf.WriteString(l)
                	nginxConf.WriteString("          ")
                	nginxConf.WriteString(line)
                	nginxConf.WriteString(l)
                	nginxConf.WriteString("     }")
                	nginxConf.WriteString(l)
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
                	filesMap := make(map[string]struct{})
                	for _, file := range files {
                		filesMap[file] = struct{}{}
                	}

                	nginxConf := strings.Builder{}
                	for i, file := range files {
                		if file == "lister.go" {
                			continue
                		}
                		if i != 0 {
                			nginxConf.WriteString("     ")
                		}
                		if strings.HasSuffix(file, ".html") {
                			nginxConf.WriteString("location /")
                			nginxConf.WriteString(file)
                			nginxConf.WriteString(" {}")
                			nginxConf.WriteString(l)

                			if strings.HasSuffix(file, "index.html") {
                				indexNameNoExt := strings.TrimSuffix(file, ".html")
                				// /docs/index.html -> /docs/index
                				writeLocation(&nginxConf, indexNameNoExt, "try_files ^ /"+file+" =404;")
                				// /docs/index/ -> /docs/index
                				writeLocation(&nginxConf, indexNameNoExt+"/", "return 301 /"+indexNameNoExt+";")

                                parent := path.Dir(file)
                                _, ok1 := filesMap[parent]
                                _, ok2 := filesMap[parent+".html"]
                                if parent != "." && !ok1 && !ok2 {
                					// /docs -> /docs/index.html
                					writeLocation(&nginxConf, parent, "try_files ^ /"+file+" =404;")
                					// /docs/ -> /docs
                					writeLocation(&nginxConf, parent+"/", "return 301 /"+parent+";")
                				}
                			} else {
                				anyNoExt := strings.TrimSuffix(file, ".html")
                				// /docs/any -> /docs/any.html
                				writeLocation(&nginxConf, anyNoExt, "try_files ^ /"+file+" =404;")
                				// /docs/any/ -> /docs/any
                				writeLocation(&nginxConf, anyNoExt+"/", "return 301 /"+anyNoExt+";")
                			}
                		} else {
                			nginxConf.WriteString("location /")
                			nginxConf.WriteString(file)
                			nginxConf.WriteString(" {}")
                			nginxConf.WriteString(l)
                		}
                	}

                	dockerfileContent, err := os.ReadFile("nginx.conf")
                	if err != nil {
                		return err
                	}

                	dockerfileContent = bytes.ReplaceAll(dockerfileContent, []byte("{{LOCATIONS}}"), []byte(nginxConf.String()))
                	return os.WriteFile("nginx.conf", dockerfileContent, 0644)
                }
            |||,
            local nginxConf = |||
                server {
                     listen 8080;
                     server_name localhost;
                     root /etc/nginx/html/;
                     index %(root_object)s;
                     absolute_redirect off;

                     location / {
                        rewrite ^(.*)$ /%(root_object)s last;
                     }

                     {{LOCATIONS}}

                     gzip on;
                     gzip_vary on;
                     gzip_min_length 10240;
                     gzip_proxied expired no-cache no-store private auth;
                     gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml;
                     gzip_disable "MSIE [1-6]\.";
                }
            ||| % {
                root_object: barbe.asStr(std.get(opt, "rootObject", "index.html")),
            },
            local deployedDockerfile = |||
                FROM nginx:alpine

                COPY __barbe_tmp/nginx.conf /etc/nginx/conf.d/default.conf
                RUN cat /etc/nginx/conf.d/default.conf

                COPY . /etc/nginx/html/
                RUN rm -rf /etc/nginx/html/__barbe_tmp

                ENV PORT 8080
                ENV HOST 0.0.0.0
                EXPOSE 8080

                RUN ls -la /etc/nginx/html/
                CMD sh -c "nginx -g 'daemon off;'"
            |||,
            dockerfile: |||
                FROM golang:1.18-alpine AS builder

                COPY --from=src ./%(build_dir)s /src
                WORKDIR /src

                RUN printf %(nginx_conf)s > nginx.conf
                RUN printf %(lister_go)s > lister.go
                RUN go run lister.go

                FROM docker

                RUN echo "%(access_token)s" | docker login -u oauth2accesstoken --password-stdin https://gcr.io

                COPY --from=src ./%(build_dir)s /src
                WORKDIR /src
                COPY --from=builder /src/nginx.conf ./__barbe_tmp/nginx.conf

                RUN printf %(deployed_dockerfile)s > ./__barbe_tmp/Dockerfile

                RUN --mount=type=ssh,id=docker.sock,target=/var/run/docker.sock docker build -f __barbe_tmp/Dockerfile -t gcr.io/%(gcp_project_name)s/%(img_name)s .
                RUN --mount=type=ssh,id=docker.sock,target=/var/run/docker.sock docker push gcr.io/%(gcp_project_name)s/%(img_name)s

                RUN touch tmp
            ||| % {
                gcp_project_name: opt.gcpProjectName,
                img_name: opt.name,
                node_version: "16",
                build_dir: opt.buildDir,
                access_token: barbe.asStr(opt.gcpAccessToken),
                nginx_conf: std.escapeStringJson(nginxConf),
                deployed_dockerfile: std.escapeStringJson(deployedDockerfile),
                lister_go: std.escapeStringJson(listerGo),
            },
            no_cache: true,
            exported_file: "tmp",
            display_name: "Image build - gcp_cloudrun_static_hosting." + opt.name,
        }
    }
];

barbe.pipelines([
   {
        generate: [
            function(container) barbe.databags([
                barbe.iterateBlocks(container, "gcp_cloudrun_static_hosting", function(bag)
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
                                            Value: std.strReplace(token.Value, ".tfstate", "_gcp_cr_static_hosting" + bag.Name + ".tfstate"),
                                        }
                                    else
                                        false
                            ) + {
                                Meta: { sub_dir: "gcp_cr_static_hosting_" + bag.Name }
                            };
                            [{
                                Name: "gcp_cr_static_hosting_" + bag.Name,
                                Type: "cr_[terraform(gcp_cr_static_hosting_" + bag.Name + ")]",
                                Value: tfBlock,
                            },
                            {
                                Type: "barbe_state(put_in_object)",
                                Name: "gcp_cloudrun_static_hosting_created_tfstate",
                                Value: {
                                    [bag.Name]: tfBlock,
                                },
                            }]
                        else
                            null
                        ,
                        gcpCloudrunStaticHosting(std.prune({
                            cloudResourceKindFactory: cloudResourceAbstractFactory("gcp_cr_static_hosting_" + bag.Name, "gcp_cr_static_hosting_" + bag.Name),
                            name_prefix: barbe.appendToTemplate(namePrefix, [bag.Name + "-"]),
                            region: std.get(fullBlock, "region", "us-central1"),
                            project_name: barbe.asTraversal("var.gcp_project"),
                            image_name: barbe.appendToTemplate(namePrefix, ["sh-", bag.Name]),
                            domain: std.get(fullBlock, "domain", null),
                            dns_zone: std.get(fullBlock, "dns_zone", null),
                            dns_zone_project: std.get(fullBlock, "dns_zone_project", null),
                        })),
                        gcpProjectSetup(bag.Name, fullBlock, namePrefix)
                    ]
                ),
                local forImport = barbe.iterateBlocks(container, "gcp_cloudrun_static_hosting", function(bag)
                    local block = barbe.asVal(bag.Value);
                    local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                    local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                    local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                    gcpProjectSetup(bag.Name, fullBlock, namePrefix)
                );
                barbe.importComponent(
                    container,
                    "gcp_cloudrun_static_hosting",
                    "https://hub.barbe.app/anyfront/gcp_project_setup/v0.1.0/.jsonnet",
                    ["cr_[terraform]"],
                    forImport
                ),
            ])
        ],
        apply: [
            function(container) barbe.databags([
                local forImport = barbe.iterateBlocks(container, "gcp_cloudrun_static_hosting", function(bag)
                    local block = barbe.asVal(bag.Value);
                    local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                    local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                    local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                    gcpProjectSetup(bag.Name, fullBlock, namePrefix)
                );
                barbe.importComponent(
                    container,
                    "gcp_cloudrun_static_hosting",
                    "https://hub.barbe.app/anyfront/gcp_project_setup/v0.1.0/.jsonnet",
                    ["cr_[terraform]"],
                    forImport
                ),
                {
                    Name: "gcp_cloudrun_static_hosting_credentials",
                    Type: "gcp_token_request",
                    Value: {}
                },
            ]),
            function(container) barbe.databags([
                barbe.iterateBlocks(container, "gcp_cloudrun_static_hosting", function(bag)
                    local block = barbe.asVal(bag.Value);
                    local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                    local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                    local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                    local gcpAccessToken = barbe.asStr(barbe.asVal(container.gcp_token.gcp_cloudrun_static_hosting_credentials[0].Value).access_token);

                    if std.objectHas(container, "gcp_project_setup_output") && std.objectHas(container.gcp_project_setup_output, bag.Name) then
                        local gcpSetupProjectName = barbe.asStr(barbe.asVal(container.gcp_project_setup_output[bag.Name][0].Value).project_name);
                        buildGCPNginxImage(std.prune({
                            name: barbe.asStr(barbe.appendToTemplate(namePrefix, ["sh-", bag.Name])),
                            buildDir: barbe.asStr(fullBlock.build_dir),
                            gcpAccessToken: gcpAccessToken,
                            gcpProjectName: gcpSetupProjectName,
                            rootObject: std.get(fullBlock, "root_object", null),
                        }))
                ),
                local tfExecute = barbe.iterateBlocks(container, "gcp_cloudrun_static_hosting", function(bag)
                    if std.objectHas(container, "gcp_project_setup_output") && std.objectHas(container.gcp_project_setup_output, bag.Name) then
                        local gcpSetupProjectName = barbe.asStr(barbe.asVal(container.gcp_project_setup_output[bag.Name][0].Value).project_name);
                        {
                            Type: "terraform_execute",
                            Name: "gcp_cloudrun_static_hosting_apply_" + bag.Name,
                            Value: {
                                display_name: "Terraform apply - gcp_cloudrun_static_hosting." + bag.Name,
                                mode: "apply",
                                dir: std.extVar("barbe_output_dir") + "/gcp_cr_static_hosting_" + bag.Name,
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
                            emptyExecuteTemplate(container, state, "gcp_cloudrun_static_hosting", "gcp_cloudrun_static_hosting_created_tfstate")
                        ])
                    else
                        tfExecute
                    ;
                barbe.importComponent(
                    container,
                    "gcp_cloudrun_static_hosting",
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
                            Name: "gcp_cloudrun_static_hosting_created_tfstate",
                            Value: std.strReplace(name, "gcp_cloudrun_static_hosting_created_tfstate_destroy_missing_", ""),
                        }
                        for name in std.objectFields(container.terraform_empty_execute_output)
                        if std.member(name, "gcp_cloudrun_static_hosting_created_tfstate_destroy_missing_") && !std.objectHas(std.get(container, "gcp_cloudrun_static_hosting", {}), name)
                    ],
                if std.objectHas(container, "terraform_execute_output") then
                    barbe.iterateBlocks(container, "gcp_cloudrun_static_hosting", function(bag)
                        local block = barbe.asVal(bag.Value);
                        local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                        local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                        local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                        local outputs = barbe.asValArrayConst(container.terraform_execute_output["gcp_cloudrun_static_hosting_apply_" + bag.Name][0].Value);
                        local cloudrunServiceName = barbe.asStr([pair.value for pair in outputs if barbe.asStr(pair.key) == "cloudrun_service_name"][0]);
                        local urlMapName = barbe.asStr([pair.value for pair in outputs if barbe.asStr(pair.key) == "load_balancer_url_map"][0]);
                        local gcpAccessToken = barbe.asStr(barbe.asVal(container.gcp_token.gcp_cloudrun_static_hosting_credentials[0].Value).access_token);
                        if std.objectHas(container, "gcp_project_setup_output") && std.objectHas(container.gcp_project_setup_output, bag.Name) then
                            local gcpSetupProjectName = barbe.asStr(barbe.asVal(container.gcp_project_setup_output[bag.Name][0].Value).project_name);
                            {
                                Type: "buildkit_run_in_container",
                                Name: "gcp_cloudrun_static_hosting_invalidate_" + bag.Name,
                                Value: {
                                    display_name: "Invalidate CDN - gcp_cloudrun_static_hosting." + bag.Name,
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
                                        img_name: barbe.asStr(barbe.appendToTemplate(namePrefix, ["sh-", bag.Name])),
                                        url_map_name: urlMapName,
                                        gcp_access_token: gcpAccessToken,
                                    },
                                }
                            }
                    )
            ])
        ],
        destroy: [
            function(container) barbe.databags([
                local forImport = barbe.iterateBlocks(container, "gcp_cloudrun_static_hosting", function(bag)
                    local block = barbe.asVal(bag.Value);
                    local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                    local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                    local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
                    gcpProjectSetup(bag.Name, fullBlock, namePrefix)
                );
                barbe.importComponent(
                    container,
                    "gcp_cloudrun_static_hosting",
                    "https://hub.barbe.app/anyfront/gcp_project_setup/v0.1.0/.jsonnet",
                    ["cr_[terraform]"],
                    forImport
                ),
            ]),
            function(container) barbe.databags([
                local forImport = barbe.iterateBlocks(container, "gcp_cloudrun_static_hosting", function(bag)
                    if std.objectHas(container, "gcp_project_setup_output") && std.objectHas(container.gcp_project_setup_output, bag.Name) then
                        local gcpSetupProjectName = barbe.asStr(barbe.asVal(container.gcp_project_setup_output[bag.Name][0].Value).project_name);
                        {
                            Type: "terraform_execute",
                            Name: "gcp_cloudrun_static_hosting_destroy_" + bag.Name,
                            Value: {
                                display_name: "Terraform destroy - gcp_cloudrun_static_hosting." + bag.Name,
                                mode: "destroy",
                                dir: std.extVar("barbe_output_dir") + "/gcp_cr_static_hosting_" + bag.Name,
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
                    "gcp_cloudrun_static_hosting",
                    "https://hub.barbe.app/barbe-serverless/terraform_execute/v0.1.0/.jsonnet",
                    [],
                    forImport
                ),
            ]),
            function(container) barbe.databags([
                barbe.iterateBlocks(container, "gcp_cloudrun_static_hosting", function(bag)
                    {
                        Type: "barbe_state(delete_from_object)",
                        Name: "gcp_cloudrun_static_hosting_created_tfstate",
                        Value: bag.Name,
                    }
                ),
            ])
        ]
    }
])