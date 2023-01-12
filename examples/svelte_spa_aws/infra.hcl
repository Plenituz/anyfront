template {
  manifest = "../../manifest.json"
}

default {
  name_prefix = ["svelte-spa1-"]
}

state_store {
  s3 {}
}

static_hosting "my-site" {
    platform = "aws"

    domain {
        # the domain name you want the app to be under
        name = "svelte-spa1.maplecone.com"
        # the name of the existing DNS zone on your AWS account
        zone = "maplecone.com"
    }
}
