# Getting started

## What's that Barbe you keep talking about?

[Barbe](https://github.com/Plenituz/barbe) is a platform/engine that make building tools like Anyfront easier. Anyfront is built as collection of templates that are interpreted by Barbe to generate a bunch of Terraform configs, zip files, Docker images, and run a bunch of commands.

Anyfront is one of the first member of a family of cloud infrastructure tools that we're building on top of Barbe.

## First steps

1. Install [barbe and docker](https://github.com/Plenituz/barbe/blob/main/docs/installation.md)
2. Create an `infra.hcl` file at the root of your project (for other frameworks details may change, see [examples](examples/))
```hcl
template {
    # this tells barbe that we want to use the anyfront template
    manifest = "https://hub.barbe.app/anyfront/manifest/v0.1.1/.json"
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
You will want to update the domain name, and the name of the block to match your app. The name of the block is used derive several S3 bucket names, so it should be fairly unique.

3. Run the deployment
```bash
# sudo may be required depending on your docker setup
[sudo] barbe apply infra.hcl
```
This will generate files in the `barbe_dist` directory, and execute the commands needed to deploy your app. You can delete the directory once the deployment is done, keeping it just makes the next deployments faster if you're tinkering. Commands are run in isolated containers locally, this is why you don't need to install even Terraform.

4. Barbe/anyfront will do the rest, the first deployment usually takes a little longer, grab a drink!

## Going deeper

The example above is the simplest possible way to deploy your app. But what if you want several deployment of our website, like a staging and prod environment?

You can do that within the same template by using `name_prefix` and the `default` block.

> Care! Adding a `name_prefix` will change where your Terraform state is stored, so if you already deployed the example above, make sure to destroy it first: `barbe destroy infra.hcl`

Let's add the a `default` block and a `name_prefix`

```hcl
template {
    manifest = "https://hub.barbe.app/anyfront/manifest/v0.1.1/.json"
}

default {
    # this will be prepended to the names of all resources deployed.
    # you can change this to create dev/testing environments
    name_prefix = ["my-company-prod-"]
}

aws_next_js "my-site" {
    domain {
        name = "nextapp1.anyfront.dev"
        zone = "anyfront.dev"
    }
}
```

If you were to deploy this template, it would create a completely new website with all resources prefixed with `my-company-prod-`. But let's make it more dynamic by pulling the value of the name prefix from an environment variable `STAGE`, this way you can easily deploy to different environments without having to change the template. Notice how we also use the variable value to change the domain name, otherwise the deployment would fail as the domain already exists.

> Once you add a `name_prefix`, the bucket created to store your Terraform state will be name `${name_prefix}-state-store`, so make sure the name_prefix you use is fairly unique because S3 bucket names are global.

```hcl
template {
    manifest = "https://hub.barbe.app/anyfront/manifest/v0.1.1/.json"
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
```

Deploy it with
```bash
# sudo may be required depending on your docker setup
[sudo] env STAGE="staging" barbe apply infra.hcl
```

To destroy the staging environment, run
```bash
# sudo may be required depending on your docker setup
[sudo] env STAGE="staging" barbe destroy infra.hcl
```

## What's next?

You can use any regular Terraform resource in your `infra.hcl` file, in addition to [all the blocks provided by anyfront](references/README.md) and [barbe-serverless](https://github.com/Plenituz/barbe-serverless/blob/main/docs/references/README.md). barbe-serverless, just like anyfront, is a collection of barbe templates. It orchestrates all the tools necessary to deploy serverless applications on AWS.

If you're not familiar with HCL or Terraform, you can take inspiration from the [examples](examples/).

You can find more information about all the non-website-hosting related blocks on the [barbe-serverless docs](https://github.com/Plenituz/barbe-serverless/tree/main/docs)
- [Understanding the `default` block](https://github.com/Plenituz/barbe-serverless/blob/main/docs/default-blocks.md)
- [List of all the barbe-serverless blocks](https://github.com/Plenituz/barbe-serverless/blob/main/docs/references/README.md)

> If you plan on using GCP, take a look at the [GCP details](gcp-details.md) article to understand how projects are handled