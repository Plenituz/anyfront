template {
  manifest = "anyfront/manifest.json"
}

static_hosting "my-react-spa-site" {
    platform = "aws"

    build {
        # This example project doesn't build with the latest version of nodejs
        # fortunately, it's super easy to change the version being used
        nodejs_version = "16"
    }

    domain {
        # the domain name you want the app to be under
        name = "react-spa1.anyfront.dev"
    }
}
