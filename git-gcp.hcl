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

git_clone "user_repo" {
    uri = env.GIT_URL
}

anyfront "site" {
    platform = "gcp"
    app_dir = git_clone.user_repo.dir

    domain {
        name = env.DOMAIN
        zone = env.ZONE
        zone_project = env.ZONE_PROJECT
    }
}
