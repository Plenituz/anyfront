local barbe = std.extVar("barbe");
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
project_id: an existing GCP project to use, if not provided a new one will be created
project_name: name of the project to create, only used if project_id is not provided
organization_id: only used if project_id is not provided, the organization to create the project in, maybe required depending on your GCP account
organization_domain: only used if project_id and organization_id are not provided, the organization domain to create the project in, maybe required depending on your GCP account
billing_account_name: only used if project_id is not provided, the display name of the billing account to use for the project, defaults to "My Billing Account"
billing_account_id: only used if project_id and billing_account_name are not provided, the id billing account to use for the project (`{billing_account_id}` or `billingAccounts/{billing_account_id}`)
gcp_region: region to use for the GCP project, default to us-central1
services_to_activate: list of google services to turn on for the project, as strings for example ["run.googleapis.com", "compute.googleapis.com"]
cloudResourceKindFactory: a function used to create cloud resources objects, should be (kind) => (type, name, value) => {databag}
*/
local generateGCPSetup(opt) =
    local cloudResource = opt.cloudResourceKindFactory("resource");
    local cloudData = opt.cloudResourceKindFactory("data");
    local cloudOutput = opt.cloudResourceKindFactory("output");
    local cloudProvider = opt.cloudResourceKindFactory("provider");

    barbe.flatten([
    cloudProvider(null, "google", {
        region: std.get(opt, "gcp_region", "us-central1"),
    }),
    if !std.objectHas(opt, "project_id") then
        [
            if std.objectHas(opt, "organization_id") then
                cloudData("google_organization", "google_org", {
                    organization: opt.organization_id,
                })
            else if std.objectHas(opt, "organization_domain") then
                cloudData("google_organization", "google_org", {
                    domain: opt.organization_domain,
                })
            else
                null
            ,
            cloudData("google_billing_account", "billing_account", {
                display_name:
                    if std.objectHas(opt, "billing_account_id") then
                        null
                    else if std.objectHas(opt, "billing_account_name") then
                        opt.billing_account_name
                    else
                        //this is the default name on GCP, if the user didnt change it we can use it
                        "My Billing Account"
                    ,
                billing_account:
                    if std.objectHas(opt, "billing_account_id") then
                        opt.billing_account_id
                    else
                        null
                    ,
                open: true,
            }),
            cloudResource("google_project", "project", {
                name: opt.project_name,
                project_id: opt.project_name,
                billing_account: barbe.asTraversal("data.google_billing_account.billing_account.id"),
                org_id:
                    if std.objectHas(opt, "organization_id") || std.objectHas(opt, "organization_domain") then
                        barbe.asTraversal("data.google_organization.google_org.org_id")
                    else
                        null
                ,
            }),
            cloudOutput(null, "project_name", {
                value: barbe.asFuncCall("replace", [
                    barbe.asTraversal("google_project.project.id"),
                    "projects/",
                    ""
                ]),
            }),
        ]
    else
        [
            cloudData("google_project", "project", {
                project_id: opt.project_id,
            }),
            cloudOutput(null, "project_name", {
                value: barbe.asFuncCall("replace", [
                    barbe.asTraversal("data.google_project.project.project_id"),
                    "projects/",
                    ""
                ]),
            }),
        ]
    ,
    if std.objectHas(opt, "services_to_activate") then
        [
            cloudResource("google_project_service", "api_" + std.strReplace(serviceName, ".", "_"), {
                project:
                    if !std.objectHas(opt, "project_id") then
                        barbe.asTraversal("google_project.project.project_id")
                    else
                        barbe.asTraversal("data.google_project.project.project_id"),
                service: serviceName,
                disable_dependent_services: false,
                disable_on_destroy: false,
                timeouts: barbe.asBlock([{
                    create: "30m",
                    update: "40m",
                }])
            })
            for serviceName in barbe.asValArrayConst(opt.services_to_activate)
        ]
]);

local mapGCPProjectSetupGenerate(container) =
    barbe.iterateBlocks(container, "gcp_project_setup", function(bag)
        local block = barbe.asVal(bag.Value);
        [
            generateGCPSetup(std.prune({
                cloudResourceKindFactory: cloudResourceAbstractFactory("gcp_project_setup_" + bag.Name, "gcp_project_setup_" + bag.Name),
                project_name: std.get(block, "project_name", null),
                project_id: std.get(block, "project_id", null),
                organization_id: std.get(block, "organization_id", null),
                organization_domain: std.get(block, "organization_domain", null),
                folder_id: std.get(block, "folder_id", null),
                billing_account_name: std.get(block, "billing_account_name", null),
                billing_account_id: std.get(block, "billing_account_id", null),
                gcp_region: std.get(block, "gcp_region", null),
                services_to_activate: std.get(block, "services_to_activate", null),
            })),

            //copy over the terraform block if any to keep the state storage and stuff
            if std.objectHas(container, "cr_[terraform]") then
                local tfBlock = barbe.visitTokens(
                    container["cr_[terraform]"][""][0].Value,
                    function(token)
                        if token.Type == "literal_value" && std.isString(token.Value) && std.length(std.findSubstr(".tfstate", token.Value)) > 0 then
                            {
                                Type: "literal_value",
                                Meta: std.get(token, "Meta", null),
                                Value: std.strReplace(token.Value, ".tfstate", "_gcp_project_setup_" + bag.Name + ".tfstate"),
                            }
                        else
                            false
                ) + {
                    Meta: { sub_dir: "gcp_project_setup_" + bag.Name }
                };
                [{
                    Name: "gcp_project_setup_" + bag.Name,
                    Type: "cr_[terraform(gcp_project_setup_" + bag.Name + ")]",
                    Value: tfBlock,
                },
                {
                    Type: "barbe_state(put_in_object)",
                    Name: "gcp_project_setup_created_tfstate",
                    Value: {
                        [bag.Name]: tfBlock,
                    },
                }],
        ])
    ;

barbe.pipelines([
   {
        generate: [
            function(container) barbe.databags([
                mapGCPProjectSetupGenerate(container),
                barbe.iterateBlocks(container, "gcp_project_setup", function(bag)
                    # if it's already in the state it means the project setup is already deployed
                    if std.objectHas(state, "gcp_project_setup_created") && std.objectHas(state.gcp_project_setup_created, bag.Name) then
                        {
                            Type: "gcp_project_setup_output",
                            Name: bag.Name,
                            Value: {
                                project_name: state.gcp_project_setup_created[bag.Name],
                            }
                        }
                )
            ]),
        ],
        apply: [
            function(container) barbe.databags(
                local tfExecute = barbe.iterateBlocks(container, "gcp_project_setup", function(bag)
                    # if it's already in the state it means the project setup is already deployed
                    if !std.objectHas(state, "gcp_project_setup_created") || !std.objectHas(state.gcp_project_setup_created, bag.Name) then
                        {
                            Type: "terraform_execute",
                            Name: "gcp_setup_" + bag.Name,
                            Value: {
                                display_name: "Terraform apply - gcp_project_setup." + bag.Name,
                                mode: "apply",
                                dir: std.extVar("barbe_output_dir") + "/gcp_project_setup_" + bag.Name,
                            }
                        }
                    else { Type: "", Name: "", Value: {} }
                );
                [
                    local forImport = 
                        if std.objectHas(container, "cr_[terraform]") then
                            barbe.flatten([
                                tfExecute,
                                emptyExecuteTemplate(container, state, "gcp_project_setup", "gcp_project_setup_created_tfstate")
                            ])
                        else
                            tfExecute;
                    barbe.importComponent(
                        container,
                        "gcp_project_setup",
                        "https://hub.barbe.app/barbe-serverless/terraform_execute/v0.1.0/.jsonnet",
                        [],
                        forImport
                    ),
                ]
            ),
            function(container) barbe.databags([
                if std.objectHas(container, "terraform_execute_output") then
                    barbe.iterateBlocks(container, "gcp_project_setup", function(bag)
                        if std.objectHas(container.terraform_execute_output, "gcp_setup_" + bag.Name) then
                            local projectName = barbe.asVal(barbe.asVal(container.terraform_execute_output["gcp_setup_" + bag.Name][0].Value)[0]).value;
                            [
                                {
                                    Type: "barbe_state(put_in_object)",
                                    Name: "gcp_project_setup_created",
                                    Value: {
                                        [bag.Name]: projectName,
                                    },
                                },
                                {
                                    Type: "gcp_project_setup_output",
                                    Name: bag.Name,
                                    Value: {
                                        project_name: projectName,
                                    }
                                }
                            ],
                    )
                ,
                if std.objectHas(container, "terraform_empty_execute_output") then
                    [
                        [
                            {
                                Type: "barbe_state(delete_from_object)",
                                Name: "gcp_project_setup_created_tfstate",
                                Value: std.strReplace(name, "gcp_project_setup_created_tfstate_destroy_missing_", ""),
                            },
                            {
                                Type: "barbe_state(delete_from_object)",
                                Name: "gcp_project_setup_created",
                                Value: std.strReplace(name, "gcp_project_setup_created_tfstate_destroy_missing_", ""),
                            }
                        ]
                        for name in std.objectFields(container.terraform_empty_execute_output)
                        if std.member(name, "gcp_project_setup_created_tfstate_destroy_missing_") && !std.objectHas(std.get(container, "gcp_project_setup", {}), name)
                    ]
            ])
        ],
        destroy: [
            function(container) barbe.databags([
                barbe.iterateBlocks(container, "gcp_project_setup", function(bag)
                    if std.objectHas(state, "gcp_project_setup_created") && std.objectHas(state.gcp_project_setup_created, bag.Name) then
                        {
                            Type: "gcp_project_setup_output",
                            Name: bag.Name,
                            Value: {
                                project_name: state.gcp_project_setup_created[bag.Name],
                            }
                        }
                ),

                local forImport = barbe.iterateBlocks(container, "gcp_project_setup", function(bag)
                    if std.objectHas(state, "gcp_project_setup_created") && std.objectHas(state.gcp_project_setup_created, bag.Name) then
                        {
                            Type: "terraform_execute",
                            Name: "gcp_setup_destroy_" + bag.Name,
                            Value: {
                                display_name: "Terraform destroy - gcp_project_setup." + bag.Name,
                                mode: "destroy",
                                dir: std.extVar("barbe_output_dir") + "/gcp_project_setup_" + bag.Name
                            }
                        }
                    else { Type: "", Name: "", Value: {} }
                );
                barbe.importComponent(
                    container,
                    "gcp_project_setup",
                    "https://hub.barbe.app/barbe-serverless/terraform_execute/v0.1.0/.jsonnet",
                    [],
                    forImport
                ),
            ]),
            function(container) barbe.databags([
                barbe.iterateBlocks(container, "gcp_project_setup", function(bag)
                    [{
                        Type: "barbe_state(delete_from_object)",
                        Name: "gcp_project_setup_created_tfstate",
                        Value: bag.Name,
                    },
                    {
                        Type: "barbe_state(delete_from_object)",
                        Name: "gcp_project_setup_created",
                        Value: bag.Name,
                    }]
                ),
            ])
        ]
   }
])