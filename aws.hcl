template {
    manifest = "anyfront/manifest.json"
}

anyfront env.NAME {
    platform = "aws"

    domain {
        name = env.DOMAIN
        zone = env.ZONE
    }
}
