template {
  manifest = "../../manifest.json"
}

default {
  name_prefix = ["react-spa1-"]
}

state_store {
  s3 {}
}

static_hosting "my-site" {
    platform = "aws"

    build {
        # This example project doesn't build with the latest version of nodejs
        # fortunately, it's super easy to change the version being used
        nodejs_version = "16"
    }

    domain {
        # the domain name you want the app to be under
        name = "react-spa1.maplecone.com"
        # the name of the existing DNS zone on your AWS account
        zone = "maplecone.com"
    }
}
