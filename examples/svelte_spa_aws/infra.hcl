template {
  manifest = "anyfront/manifest.json"
}

default {
  name_prefix = "svelte-spa1-"
}

state_store {
  s3 {}
}

static_hosting "my-site" {
    platform = "aws"

    domain {
        # the domain name you want the app to be under
        name = "svelte-spa1.anyfront.dev"
    }
}
