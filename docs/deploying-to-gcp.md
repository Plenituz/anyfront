## Deploying to GCP using anyfront.dev

There are 2 ways to deploy to GCP using anyfront.dev:
- Zero configuration deployment: just provide your domain and project informations, and we'll do the rest
- For more complex project requirements (different build command, specific node version, auto-creating a GCP project), you can deploy using a configuration file

### Setting up GCP credentials

Before deploying to GCP, you'll need to make sure your computer has GCP credentials available.

- If you already have the `gcloud` CLI installed, you can run `gcloud auth application-default login`
- If you don't want to install `gcloud`, Barbe will take you through a similar browser-based authentication process when you run the deployment command

### Zero configuration deployment

You can use the zero configuration deployment if
- Your project builds without errors when running `npm install && npm run build` using the latest version of Node.js
- There is exactly one front end project in the current directory or any subdirectories where you run the deployment command
- You already have an existing GCP project where you want to deploy your app

> Note: anyfront doesn't use your installed version of Node.js, everything is run in temporary containers behind the scene

If your project meets these requirements, you can deploy it with a single command:
```bash
# install barbe if not already installed
curl -fsSL https://hub.barbe.app/install.sh | sh -

# cd to the root of your project
cd /path/to/project
sudo barbe apply anyfront/gcp.hcl \
    --eng PROJECT_ID=my-project \
    --env DOMAIN=my-domain.example.com \
    --env ZONE=example-com \
    --env ZONE_PROJECT=dns-project
```

> Note: `ZONE_PROJECT` is the project id that contains the DNS zone for your domain (specified in `ZONE`)

> [Why `sudo`?](./how-it-works.md#Docker-and-Buildkit)

That's it, you can watch anyfront run all the commands needed to deploy your app. Every time you make a change you can redeploy using the same command.

You can then destroy the deployment with:
```bash
sudo barbe destroy anyfront/gcp.hcl \
    --eng PROJECT_ID=my-project \
    --env DOMAIN=my-domain.example.com \
    --env ZONE=example-com \
    --env ZONE_PROJECT=dns-project
```

If you run into any problem, reach out on [Discord](https://hub.barbe.app/discord), we're happy to help!


### Deploying with a configuration file

If you need more control over the deployment process, you can use a configuration file.

This is useful if you need to
- Have a GCP project created automatically for you
- Deploy several apps
- Use a specific version of Node.js
- Run a different install/build command
- Define more infrastructure using Terraform


Create an `infra.hcl` file at the root of your project with this content:
```hcl
template {
    manifest = "anyfront/manifest.json"
}

anyfront "my-site" {
    platform = "gcp"
    domain {
        name = "my-domain.example.com"
        zone = "example-com"
        zone_project = "dns-project"
    }
}
```

You just reproduced the zero configuration deployment, except this time a GCP project will be created automatically for you

Your deployment commands now become
```bash
# install barbe if not already installed
curl -fsSL https://hub.barbe.app/install.sh | sh -

# deploy you app
sudo barbe apply infra.hcl

# destroy your app
sudo barbe destroy infra.hcl
```

Let's understand what's going on here:

`template` tells barbe that we want to use the anyfront template, if you're curious learn more [here](./how-it-works.md#barbe)
```hcl
template {
    manifest = "anyfront/manifest.json"
}
```

The [`anyfront` block](./references/anyfront.md) is what represents the deployment of your app. This is where you can configure everything we've mentioned before.
```hcl
anyfront "my-site" {
    platform = "gcp"
    domain {
        name = "my-domain.example.com"
        zone = "example-com"
        zone_project = "dns-project"
    }
}
```

The [`anyfront` block](./references/anyfront.md) block is handy because it automatically detects the framework you're using and configures the deployment accordingly. But sometimes it can't accurately detect it, or sometimes a static deployment works better. In these cases you can swap the `anyfront` block with a more specific one, like `gcp_next_js` or `static_hosting`. You can find the list of examples [here](#examples)

For now let's see a few things you can do with the [`anyfront` block](./references/anyfront.md):

Use a specific version of Node.js
```hcl
anyfront "my-site" {
    // ...
    build {
        nodejs_version = "14"
    }
}
```

Use a different install/build command
```hcl
anyfront "my-site" {
    // ...
    build {
        install_command = "yarn && node fetchSupporters.js"
        build_command = "yarn build"
    }
}
```

If you run into any problem, reach out on [Discord](https://hub.barbe.app/discord), we're happy to help!

--- 

### Going deeper

Let's update our `infra.hcl` file to be able to deploy several environments (production, staging, etc)
```hcl
# infra.hcl
template {
    manifest = "anyfront/manifest.json"
}

default {
    name_prefix = "prod-"
}

state_store {
    gcs {}
}

anyfront "my-site" {
    platform = "gcp"
    domain {
        name = "my-domain.example.com"
        zone = "example-com"
        zone_project = "dns-project"
    }
}
```

We added a `default` block with a `name_prefix`. As it's name implies, `name_prefix` is used to prefix all the resource names created by anyfront. This means creating a new environment is as simple as changing the `name_prefix`
```hcl
default {
    name_prefix = "staging-"
}
```

You can also make it so the `name_prefix` is configurable
```hcl 
default {
    name_prefix = "${env.STAGE}-"
}

anyfront "my-site" {
    platform = "gcp"
    domain {
        name = "my-domain-${env.STAGE}.example.com"
        zone = "example-com"
        zone_project = "dns-project"
    }
}
```
Then deploy with
```bash
sudo barbe apply infra.hcl --env STAGE=prod
```

> Note how we also edited the domain name to include the `STAGE` variable, otherwise the deployment would fail when we change the `STAGE` because the domain name would already be taken!

---

We also added `state_store` which is highly recommended if you start adding more resources. It automatically creates an GCS bucket to store your Terraform and Barbe state. You can [configure this further](https://github.com/Plenituz/barbe-serverless/blob/main/docs/references/state_store.md) to use an existing bucket/prefix if you want
```hcl
state_store {
    gcs {}
}
```

## How GCP projects are handled

By default, all the GCP compatible blocks (`gcp_next_js`, `anyfront`, etc) will create a new project automatically based on your `name_prefix` in the `default` block. There is nothing wrong with using the auto-generated projects as long as you understand that it will be automatically deleted when you **delete the block** or `destroy` the stack.

If you already have a project where you want to deploy your resources, all the GCP compatible blocks support having a `project_id` argument (you can put it on the `default` block as well). In this case the project is never deleted by Anyfront, but Anyfront will enable some APIs on the project as needed.

For all the DNS/domain name related stuff, Anyfront assumes that you already registered the domain and have a DNS zone in one of your GCP projects. This is why you'll have to provide the `zone` (the name of the zone) and `zone_project` (the GCP project in which the zone is) arguments in the `domain` block.

## Examples

- [Deploying a Next.js app](../examples/nextjs_gcp/)
- [Deploying a React app](../examples/react_spa_gcp/)
- [Deploying a Docusaurus app](../examples/docusaurus_gcp/)
- [Deploying a Svelte app](../examples/svelte_spa_gcp/)
- [Deploying a Vue app](../examples/vue_gcp/)
- [Deploying a Solid app](../examples/solidjs_gcp/)