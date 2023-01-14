template {
  manifest = "../../manifest.json"
}

default {
  name_prefix = ["nextapp1-"]
}

state_store {
  s3 {}
}

aws_next_js "my-site" {
    domain {
        # the domain name you want the app to be under
        name = "nextapp1.maplecone.com"
        # the name of the existing DNS zone on your AWS account
        zone = "maplecone.com"
    }
}

