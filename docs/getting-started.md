# Getting started


1. Install [barbe and docker](https://github.com/Plenituz/barbe/blob/main/docs/installation.md)
2. Create an `infra.hcl` file at the root of your project (for other frameworks details may change, see [examples](examples/))
```hcl
template {
    manifest = "https://hub.barbe.app/anyfront/manifest/v0.1.0/.json"
}

default {
    # this will be prepended to the names of all resources deployed.
    # you can change this to create dev/testing environments
    name_prefix = ["nextapp1-"]
}

# This tell barbe where to store your terraform and barbe state files
state_store {
    s3 {}
}

aws_next_js "my-site" {
    domain {
        # the domain name you want the app to be under
        name = "nextapp1.anyfront.dev"
        # the name of the existing DNS zone on your AWS account
        zone = "anyfront.dev"
    }
}
```
3. Run the deployment
```bash
barbe apply infra.hcl --output dist
```
4. Barbe/anyfront will do the rest, the first deployment usually takes a little longer, grab a drink!


If you're not familiar with HCL or Terraform, you can take inspiration from the [examples](examples/).

If you are however, you can use any regular Terraform resources in your `infra.hcl` file, in addition to all the blocks provided by anyfront and [barbe-serverless](https://github.com/Plenituz/barbe-serverless). barbe-serverless, just like anyfront, orchestrates all the tools necessary to deploy serverless applications, the block `state_store` is a good example of this, it is part of barbe-serverless and handles creating your state store bucket and configuring the terraform backend.

You can find more information about all the non-website-hosting related blocks on the [barbe-serverless docs](https://github.com/Plenituz/barbe-serverless/tree/main/docs)
- [Understanding the default block](https://github.com/Plenituz/barbe-serverless/blob/main/docs/default-blocks.md)
- [List of all the barbe-serverless blocks](https://github.com/Plenituz/barbe-serverless/blob/main/docs/references/README.md)

> If you plan on using GCP, take a look at the [GCP details](gcp-details.md) article to understand how projects are handled