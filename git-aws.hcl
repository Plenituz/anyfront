template {
    manifest = "anyfront/manifest.json"
}

default {
    name_prefix = "anyfront-${replace(env.DOMAIN, ".", "-")}-"
}

state_store {
    s3 {}
}

git_clone "user_repo" {
    uri = env.GIT_URL
}

anyfront "site" {
    platform = "aws"
    app_dir = git_clone.user_repo.dir

    domain {
        name = env.DOMAIN
    }
}
