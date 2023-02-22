template {
    manifest = "anyfront/manifest.json:dev"
}

default {
    name_prefix = "anyfront-${replace(env.DOMAIN, ".", "-")}-"
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
