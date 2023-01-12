template {
  manifest = "../../manifest.json"
}

default {
  name_prefix = ["nextexport1-"]
}

state_store {
  s3 {}
}

static_hosting "my-site" {
    platform = "aws"

    build {
        # since `next build && next export` generates both a `.next` folder an a `out` folder
        # we help anyfront know that the `out` folder is the one that should be served
        build_output_dir = "out"
    }

    domain {
        # the domain name you want the app to be under
        name = "nextexport1.maplecone.com"
        # the name of the existing DNS zone on your AWS account
        zone = "maplecone.com"
    }
}
