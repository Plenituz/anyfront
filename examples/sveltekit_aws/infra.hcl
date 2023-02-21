template {
  manifest = "anyfront/manifest.json"
}

default {
  name_prefix = "sveltekit1-"
}

aws_sveltekit "my-site" {
    domain {
        # the domain name you want the app to be under
        name = "sveltekit1.anyfront.dev"
    }
}
