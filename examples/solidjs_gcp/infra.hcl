template {
    manifest = "anyfront/manifest.json"
}

static_hosting "my-solid-spa1" {
    platform = "gcp"
    
    # this is the GCP project in which the website will be deployed
    # this can be removed and a new project will be created for you.
    # if you do so, you still need to provide a project_id and in a state_store block: `state_store { gcs { project_id = "my-project" } }`
    google_cloud_project_id = "my-project"

    domain {
        # the domain name you want the app to be under
        name = "solid-spa1.barbe.app"
        # the name of the existing DNS zone on your AWS account
        zone = "barbe-app"
        zone_project = "barbe-website"
    }
}
