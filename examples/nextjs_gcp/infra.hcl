template {
  manifest = "anyfront/manifest.json"
}

default {
    # name_prefix is prepended to all resources created by this template
    name_prefix = "nextapp1-${env.STAGE}-"
}

gcp_next_js "my-site" {
    # this is the GCP project in which the website will be deployed
    # this can be removed and a new project will be created for you.
    # if you do so, you still need to provide a project_id and in a state_store block: `state_store { gcs { project_id = "my-project" } }`
    project_id = "my-project"

    domain {
        # the domain name you want the app to be under
        name = "nextapp1${env.STAGE == "prod" ? "" : "-${env.STAGE}"}.barbe.app"
        # the name of the existing DNS zone on your GCP account
        zone = "barbe-app"
        # the project id in which the DNS zone above is
        zone_project = "barbe-website"
    }
}

