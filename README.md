# Anyfront: Deploy any front-end web application on any cloud platform with minimal configuration

**Anyfront orchestrates tools like terraform, docker and other CLIs to simplify deploying web applications on cloud platforms.**

All commands are run in containers, so the only installation you need is [barbe and docker](https://github.com/Plenituz/barbe/blob/main/docs/installation.md). 

Anyfront will:
- Run your build (`npm/yarn build`, etc) in a container, so if it works on your computer it works anywhere
- Generate all the files necessary for deployment (Terraform, container images)
- Run the deployment commands, in containers as well, creating infrastructure on your chosen cloud platform

## At a glance

Deploying Next.js on GCP
```hcl
gcp_next_js "my-next-app-gcp" {
    domain {
        # the domain name you want the app to be under
        name = "my-next-app.example.com"
        # the name of the existing DNS zone on your GCP account
        zone = "example-com"
        # the project id in which the DNS zone above is
        zone_project = "dns-project"
    }
}
```

Deploying Next.js on AWS
```hcl
aws_next_js "my-next-app-aws" {
    domain {
        # the domain name you want the app to be under
        name = "my-next-app.example.com"
        # the name of the existing DNS zone on your AWS account
        zone = "example.com"
    }
}
```

Deploying a single page app or static website on GCP
```hcl
static_hosting "my-react-app-gcp" {
    platform = "gcp"

    domain {
        # the domain name you want the app to be under
        name = "react-spa.example.com"
        # the name of the existing DNS zone on your GCP account
        zone = "example-com"
        # the project id in which the DNS zone above is
        zone_project = "dns-project"
    }
}
```

Deploying a single page app or static website on AWS
```hcl
static_hosting "my-react-app-aws" {
    platform = "aws"

    domain {
        # the domain name you want the app to be under
        name = "react-spa.example.com"
        # the name of the existing DNS zone on your AWS account
        zone = "example.com"
    }
}
```

### Currently supported platforms and frameworks

|            | AWS | GCP |
|------------|-----|-----|
| React SPA  | [✓](examples/react_spa_aws/)   | [✓](examples/react_spa_gcp/)   |
| Next.js    | [✓](examples/nextjs_aws/)   | [✓](examples/nextjs_gcp/)   |
| Svelte SPA | [✓](examples/svelte_spa_aws/)   | [✓](examples/svelte_spa_gcp/)   |
| Vue SPA    | ✓*  | ✓*  |

> Items marked with `*` don't have example projects yet. Find all the examples under [`examples`](examples/)

> Feel free to create/upvote an issue for your favorite framework/platform so we can prioritize it


## Getting started

1. Install [barbe and docker](https://github.com/Plenituz/barbe/blob/main/docs/installation.md)
2. Create an `infra.hcl` file at the root of your project, this is an example for Next.js on AWS (for other frameworks details may change, see [examples](examples/))
```hcl
template {
    manifest = "https://hub.barbe.app/anyfront/manifest/v0.1.0/.json"
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
# sudo may be required depending on your docker setup
[sudo] barbe apply infra.hcl
```
4. Barbe/anyfront will do the rest, the first deployment usually takes a little longer, grab a drink!


### Interested?

Checkout the [docs](docs/README.md) and the [examples](examples/).

You can also learn more about what you can do with Barbe in general:
 - [Barbe-serverless getting started](https://github.com/Plenituz/barbe-serverless/blob/main/docs/getting-started.md)
 - [`default` blocks](https://github.com/Plenituz/barbe-serverless/blob/main/docs/default-blocks.md)
 - [Integrating existing projects](https://github.com/Plenituz/barbe-serverless/blob/main/docs/integrating-existing-projects.md)