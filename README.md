# Anyfront: Deploy any front-end web application on any cloud platform in 1 click

**Anyfront orchestrates tools like terraform, docker and other CLIs to simplify deploying web applications on cloud platforms.**

### Anyfront is meant to be used without prior knowledge, **you don't need to know Terraform to use it!**

Anyfront will:
- Run your build (`npm/yarn build`, `docker build`, etc)
- Generate all the files necessary for deployment (Terraform, container images)
- Run the deployment commands, creating infrastructure on your chosen cloud platform

All that in one command, without you needing to know anything about AWS, GCP or Terraform. You don't even need to have their CLI installed.

Anyfront makes it really easy to deploy your website but also:
- Is always up-to-date, the infrastructure templates will evolve overtime to keep up with the latest best practices, you don't have to touch anything to get the latest improvements and cost savings from AWS/GCP
- Is portable, the deployments can run on any machine with a container runtime, no dependencies to install

Interested? Need some help? Reach out on [Discord](https://hub.barbe.app/discord)!

## 2 minutes getting started

1. Install [barbe](docs/getting-started.md). 
```bash
curl -fsSL https://hub.barbe.app/install.sh -o install-barbe.sh
sh install-barbe.sh
```
2. If your project works when doing `npm install` and `npm run build`, you can deploy it without any configuration:
```bash
# deploying on AWS from a git repository
barbe apply anyfront/git-aws.hcl \
    --env DOMAIN=my-domain.example.com \
    --env GIT_URL=https://github.com/owner/repo

# deploying on GCP from a git repository
barbe apply anyfront/git-gcp.hcl \
    --env DOMAIN=my-domain.example.com \
    --env GIT_URL=https://github.com/owner/repo \
    --env ZONE=example-com \
    --env ZONE_PROJECT=dns-project

# deploying on AWS from a local directory
cd /path/to/project
barbe apply anyfront/aws.hcl --env DOMAIN=my-domain.example.com

# deploying on GCP from a local directory
cd /path/to/project
barbe apply anyfront/gcp.hcl \
    --env DOMAIN=my-domain.example.com \
    --env ZONE=example-com \
    --env ZONE_PROJECT=dns-project
```
3. Sit back, the first deployment usually takes a little longer, grab a drink!
4. For some projects, you may want to configure more things, like the Node.js version, adding extra build steps (`node getSecrets.js` or whatever). To learn more head to the [Getting Started](docs/getting-started.md)

## At a glance

You can deploy with our pre-configured templates as shown above or configure your own deployment.

Here are some configuration snippets showing how easy it is to configure the deployment of various projects. See [Getting Started](docs/getting-started.md) for more details

Deploying Next.js on GCP or AWS (this could be done with the pre-configured templates)
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
aws_next_js "my-next-app-aws" {
    domain {
        # the domain name you want the app to be under
        name = "my-next-app.example.com"
        # the name of the existing DNS zone on your AWS account
        zone = "example.com"
    }
}
```

Running a script before the build
```hcl
static_hosting "my-react-app-gcp" {
    platform = "gcp"

    build {
        build_cmd = "node getSecrets.js && npm run build"
    }
}
```

Change the version of Node.js being used to build you app
```hcl
static_hosting "my-react-app-gcp" {
    platform = "gcp"

    build {
        nodejs_version = "14"
    }
}
```

### Currently supported platforms and frameworks

|             | AWS | GCP |
|-------------|-----|-----|
| Any static website | ✓ | ✓ |
| React SPA   | [✓](examples/react_spa_aws/)   | [✓](examples/react_spa_gcp/)   |
| Docusaurus  | [✓](examples/docusaurus_aws/)   | [✓](examples/docusaurus_gcp/)   |
| Next.js     | [✓](examples/nextjs_aws/)   | [✓](examples/nextjs_gcp/)   |
| Svelte SPA  | [✓](examples/svelte_spa_aws/)   | [✓](examples/svelte_spa_gcp/)   |
| SvelteKit   | [✓](examples/sveltekit_aws/) | 🔜 |
| Vue SPA     | [✓](examples/vue_aws/)  | [✓](examples/vue_gcp/)  |
| SolidJS SPA | [✓](examples/solidjs_aws/)  | [✓](examples/solidjs_gcp/)  |
| Any containerized website | 🔜 | 🔜 |
| SolidStart  | 🔜 | 🔜 |

| Astro       | 🔜 | 🔜 |

> We'll add more examples, platforms and frameworks as we go. Feel free to create/upvote an issue for your favorite framework/platform so we can prioritize it.

### Interested?

Checkout the [detailed getting started](docs/getting-started.md), [docs](docs/README.md) and the [examples](examples/).

Need help? Reach out on [Discord](https://hub.barbe.app/discord)!