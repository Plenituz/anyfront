template {
    manifest = "anyfront/manifest.json"
}

default {
    name_prefix = "anyfront-${replace(env.DOMAIN, ".", "-")}-"
    project_id = env.PROJECT_ID
}

state_store {
    gcs {}
}

anyfront "site" {
    platform = "gcp"

    domain {
        name = env.DOMAIN
        zone = env.ZONE
        zone_project = env.ZONE_PROJECT
    }
}
