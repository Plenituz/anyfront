template {
    manifest = "anyfront/manifest.json"
}

default {
    # this is the GCP project in which the website will be deployed
    # this can be removed and a new project will be created for you.
    # if you do so, you still need to provide a project_id in the state_store block below
    project_id = "my-project"

    # the domain name you want the app to be under
    domain_name = "svelte-spa1.barbe.app"
    # the name of the existing DNS zone on your GCP account
    domain_zone_name = "barbe-app"
    # the project id in which the DNS zone above is
    domain_project_id = "barbe-website"

    name_prefix = "svelte-spa1-"
}

state_store {
    gcp {
        # If you remove `project_id` from the default block,
        # you must specify an existing project in which to create the state bucket
        # project_id = "my-state-project"
    }
}

static_hosting "my-site" {
    platform = "gcp"

    domain {
        name = default.domain_name
        zone = default.domain_zone_name
        zone_project = default.domain_project_id
    }
}
