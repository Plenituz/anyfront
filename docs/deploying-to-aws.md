## Deploying to AWS using anyfront.dev

There are 2 ways to deploy to AWS using anyfront.dev:
- Zero configuration deployment: just provide your domain name and we'll do the rest
- For more complex project requirements (several domains, different build command, specific node version), you can deploy using a configuration file

> Bonus: if your project is on a public github repo, you can use the [CloudFormation template](https://hub.barbe.app/anyfront/try.cloudformation.yml) to deploy without installing anything. Deploy the template in your AWS account, then start the Codebuild project that was created

### Setting up AWS credentials

Unless you're using the CloudFormation template, you'll need to make sure your computer has AWS credentials available.

- If you already have the AWS CLI installed, you can run `aws configure`
- If you don't want to install the AWS CLI, you can create a file at `~/.aws/credentials` with the content:
```
[default]
aws_access_key_id = <your access key here>
aws_secret_access_key = <your secret key here>
```

If you're not sure where to get AWS credentials follow [this nice tutorial](https://www.youtube.com/watch?v=qmtDRmplMG4). Make sure the IAM credentials you provide have enough permissions to create all the resources needed by anyfront. The easiest way to do this is to use an IAM user with the `AdministratorAccess` policy attached.

### Hosted zones

The only thing anyfront doesn't create for you on AWS is the hosted zone on Route53. If you registered you domain with AWS, it was created by automatically. If you didnt you'll need to create it manually.

### Zero configuration deployment

You can use the zero configuration deployment if
- Your project builds without errors when running `npm install && npm run build` using the latest version of Node.js
- There is exactly one front end project in the current directory or any subdirectories where you run the deployment command

> Note: anyfront doesn't use your installed version of Node.js, everything is run in temporary containers behind the scene

If your project meets these requirements, you can deploy it with a single command:
```bash
# install barbe if not already installed
curl -fsSL https://hub.barbe.app/install.sh -o install-barbe.sh
sh install-barbe.sh

# cd to the root of your project
cd /path/to/project
sudo barbe apply anyfront/aws.hcl --env DOMAIN=my-domain.example.com
```

> [Why `sudo`?](./how-it-works.md#Docker-and-Buildkit)

That's it, you can watch anyfront run all the commands needed to deploy your app. Every time you make a change you can redeploy using the same command.

You can then destroy the deployment with:
```bash
sudo barbe destroy anyfront/aws.hcl --env DOMAIN=my-domain.example.com
```

If you run into any problem, reach out on [Discord](https://hub.barbe.app/discord), we're happy to help!


### Deploying with a configuration file

If you need more control over the deployment, you can use a configuration file. 

This is useful if you need to
- Deploy several apps
- Use a specific version of Node.js
- Run a different install/build command
- Use several domains for the same app
- Define more infrastructure using Terraform or [Barbe-serverless](https://github.com/Plenituz/barbe-serverless)

Create an `infra.hcl` file at the root of your project with this content:
```hcl
template {
    manifest = "anyfront/manifest.json"
}

anyfront "my-site" {
    platform = "aws"
    domain {
        name = "my-domain.example.com"
    }
}
```
You just reproduced the same configuration used by the "zero configuration deployment", but now you can mess with it.

Your deployment commands now become
```bash
# install barbe if not already installed
curl -fsSL https://hub.barbe.app/install.sh -o install-barbe.sh
sh install-barbe.sh

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
    platform = "aws"
    domain {
        name = "my-domain.example.com"
    }
}
```

The [`anyfront` block](./references/anyfront.md) block is handy because it automatically detects the framework you're using and configures the deployment accordingly. But sometimes it can't accurately detect it, or sometimes a static deployment works better. In these cases you can swap the `anyfront` block with a more specific one, like `aws_next_js` or `static_hosting`. You can find the list of examples [here](#examples)

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

Use several domains for the same app
```hcl
anyfront "my-site" {
    // ...
    domain {
        name = [
            "www.example.com",
            "example.com"
        ]
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
    s3 {}
}

anyfront "my-site" {
    platform = "aws"
    domain {
        name = "my-domain.example.com"
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
    platform = "aws"
    domain {
        name = "my-domain-${env.STAGE}.example.com"
        zone = "example.com"
    }
}
```
Then deploy with
```bash
sudo barbe apply infra.hcl --env STAGE=prod
```

> Note how we also edited the domain name to include the `STAGE` variable, otherwise the deployment would fail when we change the `STAGE` because the domain name would already be taken! Making our domain name configurable also made it so we have to provide a `zone` for the domain, otherwise anyfront wouldn't know which Route53 zone to use.

---

We also added `state_store` which is highly recommended if you start adding more resources. It automatically creates an S3 bucket to store your Terraform and Barbe state. You can [configure this further](https://github.com/Plenituz/barbe-serverless/blob/main/docs/references/state_store.md) to use an existing bucket/prefix if you want
```hcl
state_store {
    s3 {}
}
```

## Examples

- [Deploying a Next.js app](../examples/nextjs_aws/)
- [Deploying a React app](../examples/react_spa_aws/)
- [Deploying a Docusaurus app](../examples/docusaurus_aws/)
- [Deploying a SvelteKit app](../examples/sveltekit_aws/)
- [Deploying a Svelte app](../examples/svelte_spa_aws/)
- [Deploying a Vue app](../examples/vue_aws/)
- [Deploying a Solid app](../examples/solidjs_aws/)
