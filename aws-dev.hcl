template {
    manifest = "anyfront/manifest.json:dev"
}

default {
    name_prefix = "anyfront-${replace(env.DOMAIN, ".", "-")}-"
}

state_store {
    s3 {}
}

anyfront "site" {
    platform = "aws"

    domain {
        name = env.DOMAIN
    }
}
