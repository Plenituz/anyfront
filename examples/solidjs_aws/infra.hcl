template {
  manifest = "anyfront/manifest.json"
}

static_hosting "my-solid-spa-site" {
    platform = "aws"

    domain {
        # the domain name you want the app to be under
        name = "solid-spa1.anyfront.dev"
    }
}
