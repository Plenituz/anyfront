template {
  manifest = "../../manifest.json"
}

default {
    name_prefix = ["my-company-${env.STAGE}-"]
}

aws_next_js "my-site" {
    domain {
        # Note the conditional operator:
        # if STAGE is prod, domain name will be nextapp1.anyfront.dev
        # otherwise it will be nextapp1-${STAGE}.anyfront.dev
        name = "nextapp1${env.STAGE == "prod" ? "" : "-${env.STAGE}"}.anyfront.dev"
        zone = "anyfront.dev"
    }
}
