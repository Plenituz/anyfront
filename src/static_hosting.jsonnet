local barbe = std.extVar("barbe");
local container = std.extVar("container");
local globalDefaults = barbe.compileDefaults(container, "");

local computeBagBuildHash(bag) =
    local block = barbe.asVal(bag.Value);
    local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
    local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
    local dotBuild = barbe.asVal(barbe.mergeTokens(std.get(fullBlock, "build", barbe.asSyntax([])).ArrayConst));
    std.md5(
        barbe.asVal(std.get(dotBuild, "disabled", barbe.asSyntax(false))) +
        barbe.asStr(std.get(dotBuild, "nodejs_version", "null")) +
        barbe.asStr(std.get(dotBuild, "build_dir", "null")) +
        barbe.asStr(std.get(dotBuild, "build_output_dir", "null")) + 
        barbe.asStr(std.get(dotBuild, "install_cmd", "null")) +
        barbe.asStr(std.get(dotBuild, "build_cmd", "null"))
    )
;

local generateSubBags(container) = barbe.iterateBlocks(container, "static_hosting", function(bag)
    local block = barbe.asVal(bag.Value);
    local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
    local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
    local dotGcpProject = barbe.asVal(barbe.mergeTokens(std.get(fullBlock, "google_cloud_project", barbe.asSyntax([])).ArrayConst));
    local dotDomain = barbe.asVal(barbe.mergeTokens(std.get(fullBlock, "domain", barbe.asSyntax([])).ArrayConst));
    local platform = barbe.asStr(std.get(fullBlock, "platform", "aws"));
    local buildMap = {
        [bag.Name]: computeBagBuildHash(bag)
        for bag in barbe.iterateBlocks(container, "static_hosting", function(bag) bag)
    };
    local buildOutputDir = barbe.asStr(container.frontend_build_output[buildMap[bag.Name]][0].Value);
    [
        if platform == "gcp" then
            [
                {
                    Name: bag.Name,
                    Type: "gcp_cloudrun_static_hosting",
                    Value: {
                        root_object: std.get(fullBlock, "root_object", null),
                        region: std.get(fullBlock, "region", "us-central1"),
                        project_id: std.get(dotGcpProject, "project_id", std.get(fullBlock, "google_cloud_project_id", null)),
                        organization_id: std.get(dotGcpProject, "organization_id", null),
                        organization_domain: std.get(dotGcpProject, "organization_domain", null),
                        billing_account_name: std.get(dotGcpProject, "billing_account_name", null),
                        billing_account_id: std.get(dotGcpProject, "billing_account_id", null),
                        domain:
                            if std.objectHas(dotDomain, "name") then
                                barbe.appendToTemplate(dotDomain.name, [barbe.asSyntax(".")])
                            else
                                null
                            ,
                        dns_zone: std.get(dotDomain, "zone", null),
                        dns_zone_project: std.get(dotDomain, "zone_project", null),
                        build_dir: buildOutputDir,
                    }
                },
            ]
        else if platform == "aws" then
            [
                {
                    Name: bag.Name,
                    Type: "aws_cloudfront_static_hosting",
                    Value: {
                        root_object: std.get(fullBlock, "root_object", null),
                        region: std.get(fullBlock, "region", "us-east-1"),
                        zone: std.get(dotDomain, "zone", null),
                        domain_names:
                            if std.objectHas(dotDomain, "name") then
                                assert std.objectHas(dotDomain, "zone") : "domain.zone is required if domain.name is set";
                                [dotDomain.name]
                            else
                                null
                            ,
                        certificate_domain_to_create: std.get(dotDomain, "name", null),
                        build_dir: buildOutputDir,
                    }
                }
            ]
        else
            error "<showuser>Unknown platform '" + platform + "'</showuser>"
    ]
);

local deploySteps = function(container) barbe.databags(
    local mix = generateSubBags(container);
    [
        barbe.importComponent(
            container,
            "static_hosting",
            "https://hub.barbe.app/anyfront/gcp_cloudrun_static_hosting/v0.1.0/.jsonnet",
            ["default", "cr_[terraform]", "gcp_project_setup_output"],
            [bag for bag in barbe.flatten(mix) if bag.Type == "gcp_cloudrun_static_hosting"]
        ),
        barbe.importComponent(
            container,
            "static_hosting",
            "https://hub.barbe.app/anyfront/aws_cloudfront_static_hosting/v0.1.0/.jsonnet",
            ["default", "cr_[terraform]"],
            [bag for bag in barbe.flatten(mix) if bag.Type == "aws_cloudfront_static_hosting"]
        ),
    ]
);

barbe.pipelines([{
    pre_generate: [function(container) barbe.databags([
        barbe.iterateBlocks(container, "static_hosting", function(bag)
            local block = barbe.asVal(bag.Value);
            local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
            local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
            local namePrefix = barbe.concatStrArr(std.get(fullBlock, "name_prefix", barbe.asSyntax([""])));
            local platform = barbe.asStr(std.get(fullBlock, "platform", "aws"));
            local dotGcpProject = barbe.asVal(barbe.mergeTokens(std.get(fullBlock, "google_cloud_project", barbe.asSyntax([])).ArrayConst));
            [
                if platform == "gcp" then
                    if !std.objectHas(container, "state_store") then
                        {
                            Name: "",
                            Type: "state_store",
                            Value: {
                                name_prefix: [
                                    if !std.objectHas(fullBlock, "name_prefix") then
                                        barbe.appendToTemplate(namePrefix, [bag.Name + "-"])
                                    else
                                        namePrefix
                                ],
                                gcs: barbe.asBlock([{
                                    project_id: std.get(dotGcpProject, "project_id", std.get(fullBlock, "google_cloud_project_id", null)),
                                }])
                            }
                        }
                    else []
                else if platform == "aws" then
                    if !std.objectHas(container, "state_store") then
                        {
                            Name: "",
                            Type: "state_store",
                            Value: {
                                name_prefix: [
                                    if !std.objectHas(fullBlock, "name_prefix") then
                                        barbe.appendToTemplate(namePrefix, [bag.Name + "-"])
                                    else
                                        namePrefix
                                ],
                                s3: barbe.asBlock([{}])
                            }
                        }
                    else []
                else
                    error "<showuser>Unknown platform '" + platform + "'</showuser>"
            ]
        )
    ])],
    generate: [
        function(container) barbe.databags(
            local staticHostingBags = barbe.iterateBlocks(container, "static_hosting", function(bag) bag);
            local buildHashes = std.set([computeBagBuildHash(bag) for bag in staticHostingBags]);
            local buildHashBags = {
                [hash]: [bag for bag in staticHostingBags if computeBagBuildHash(bag) == hash][0]
                for hash in buildHashes
            };
            local mix = [
                local bag = buildHashBags[hash];
                local block = barbe.asVal(bag.Value);
                local blockDefaults = barbe.makeBlockDefault(container, globalDefaults, block);
                local fullBlock = barbe.asVal(barbe.mergeTokens([barbe.asSyntax(blockDefaults), bag.Value]));
                local dotBuild = barbe.asVal(barbe.mergeTokens(std.get(fullBlock, "build", barbe.asSyntax([])).ArrayConst));

                if std.extVar("barbe_command") == "destroy" then
                    {
                        Name: hash,
                        Type: "frontend_build_output",
                        Value: ""
                    }
                else if !barbe.asVal(std.get(dotBuild, "disabled", barbe.asSyntax(false))) then
                    {
                        Name: hash,
                        Type: "frontend_build",
                        Value: {
                            nodejs_version: std.get(dotBuild, "nodejs_version", "18"),
                            build_dir: std.get(dotBuild, "build_dir", null),
                            build_output_dir: std.get(dotBuild, "build_output_dir", null),
                            install_cmd: std.get(dotBuild, "install_cmd", null),
                            build_cmd: std.get(dotBuild, "build_cmd", null),
                            environment: std.get(dotBuild, "environment", null),
                        }
                    }
                else
                    assert std.objectHas(dotBuild, "build_output_dir") : "<showuser>if build is disabled, build_output_dir must be specified</showuser>";
                    {
                        Name: hash,
                        Type: "frontend_build_output",
                        Value: dotBuild.build_output_dir
                    }
                for hash in buildHashes
            ];
            [
                [bag for bag in mix if bag.Type == "frontend_build_output"],
                barbe.importComponent(
                    container,
                    "static_hosting",
                    "https://hub.barbe.app/anyfront/frontend_build/v0.1.0/.jsonnet",
                    [],
                    [bag for bag in mix if bag.Type == "frontend_build"]
                ),
            ]
        ),
        deploySteps
    ],
    apply: [deploySteps],
    destroy: [deploySteps]
}])
