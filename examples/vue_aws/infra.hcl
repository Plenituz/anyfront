template {
    manifest = "anyfront/manifest.json"
}

static_hosting "my-vue-spa1" {
    platform = "aws"

    domain {
        # the domain name you want the app to be under
        name = "vue-spa1.anyfront.dev"
        # the name of the existing DNS zone on your AWS account
        zone = "anyfront.dev"
    }
}
