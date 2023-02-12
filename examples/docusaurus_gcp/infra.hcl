template {
    manifest = "anyfront/manifest.json"
}

static_hosting "docusaurus" {
    platform = "gcp"

    # this is the GCP project in which the website will be deployed
    # this can be removed and a new project will be created for you.
    # if you do so, you still need to provide a project_id and in a state_store block: `state_store { gcs { project_id = "my-project" } }`
    google_cloud_project_id = "my-project"

    build {
        # these commands are specific to the jest website example
        # if you don't provide a install_cmd and build_cmd,
        # the defaults are `npm install` and `npm run build`,
        # which will work for most docusaurus projects
        install_cmd = "yarn && node fetchSupporters.js"
        build_cmd = "yarn build"
    }

    domain {
        # the domain name you want the app to be under
        name = "docusaurus1.barbe.app"
        # the name of the existing DNS zone on your GCP account
        zone = "barbe-app"
        # the project id in which the DNS zone above is
        zone_project = "barbe-website"
    }
}