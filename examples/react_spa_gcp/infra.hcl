template {
    manifest = "anyfront/manifest.json"
}

default {
    name_prefix = "react-spa1-"
}

static_hosting "my-react-spa" {
    platform = "gcp"

    # this is the GCP project in which the website will be deployed
    # this can be removed and a new project will be created for you.
    # if you do so, you still need to provide a project_id and in a state_store block: `state_store { gcs { project_id = "my-project" } }`
    google_cloud_project_id = "my-project"

    build {
        # This example project doesn't build with the latest version of nodejs
        # fortunately, it's super easy to change the version being used
        nodejs_version = "16"
    }

    domain {
        # the domain name you want the app to be under
        name = "react-spa1.barbe.app"
        # the name of the existing DNS zone on your GCP account
        zone = "barbe-app"
        # the project id in which the DNS zone above is
        zone_project = "barbe-website"
    }
}
