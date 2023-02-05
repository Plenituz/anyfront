# Anyfront: Deploy any front-end web application on any cloud platform with minimal configuration

**Anyfront orchestrates tools like terraform, docker and other CLIs to simplify deploying web applications on cloud platforms.**

### Anyfront is meant to be used without prior knowledge, **you don't need to know Terraform to use it!**

Anyfront will:
- Run your build (`npm/yarn build`, `docker build`, etc)
- Generate all the files necessary for deployment (Terraform, container images)
- Run the deployment commands, creating infrastructure on your chosen cloud platform

All that in one command, without you needing to know anything about AWS, GCP or Terraform. You don't even need to have their CLI installed.

Anyfront makes it really easy to deploy your website but also:
- Is always up-to-date, the infrastructure templates will evolve overtime to keep up with the latest best practices, you don't have to touch anything to get the latest improvements
- Is portable, the deployments can run on any machine with a container runtime, no dependencies to install

Interested? Need some help? Reach out on [Discord](https://discord.gg/6Cwa6A8nF8)!

## 2 minutes getting started

1. Install [barbe](docs/getting-started.md). 
```bash
curl -fsSL https://hub.barbe.app/install.sh -o install-barbe.sh
sh install-barbe.sh
```
2. Create an `infra.hcl` file at the root of your project, this is an example for Next.js on AWS (see [examples](examples/) for other frameworks)
```hcl
template {
    manifest = "https://hub.barbe.app/anyfront/manifest/latest/.json"
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
sudo barbe apply infra.hcl
```
4. Barbe/anyfront will do the rest, the first deployment usually takes a little longer, grab a drink!
5. Want more details? Click [here](docs/getting-started.md)

## At a glance

Here are some configuration snippets showing how easy it is to configure the deployment of various projects. See [Getting Started](docs/getting-started.md) for more details

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

> We'll add more examples, platforms (Azure) and frameworks (Solid, SvelteKit, ...) as we go. Feel free to create/upvote an issue for your favorite framework/platform so we can prioritize it. 


### Interested?

Checkout the [detailed getting started](docs/getting-started.md), [docs](docs/README.md) and the [examples](examples/).

Reach out on [Discord](https://discord.gg/6Cwa6A8nF8)!

You can also learn more about what you can do with Barbe in general:
 - [Barbe-serverless getting started](https://github.com/Plenituz/barbe-serverless/blob/main/docs/getting-started.md)
 - [`default` blocks](https://github.com/Plenituz/barbe-serverless/blob/main/docs/default-blocks.md)
 - [Integrating existing projects](https://github.com/Plenituz/barbe-serverless/blob/main/docs/integrating-existing-projects.md)