# static_hosting

Makes a collection a static files available to be fetched all over the world behind a CDN. "Static files" means this is a great choice for any application that do not require some code to run for each request, for example: create-react-app (or any) single page applications, simple svelte applications, websites generated with Gatsby/Hugo/etc

This block works out of the box for all frameworks that:
- Generate "index.html" files for each route. Meaning a request to `/abc` is automatically serving the file at `/abc/index.html`
- Generate HTML files named after each route. Meaning a request to `/abc` is automatically serving the file `/abc.html`

For both these scenarios, doing a request directly to `/abc/index.html` or `/abc.html`, or any other file that actually exists (javascript, images, etc) will also work

This block handles:
- Building your application
- Creating infrastructure for global CDN delivery
- Uploading your files to the cloud, invalidating the CDN


This is a multiplatform block, it currently supports:
- AWS
- GCP

Notes:
- Not providing a domain name on GCP will make your site HTTP only
- There is currently a bug where when running the `destroy` command, static_hosting blocks with the platform GCP do not get deleted
- The current AWS implementation requires a Cloudfront update for each deployment, which take several minutes, this cost is for a slight decrease in cache miss request time

---

### Example usage

#### A react application on AWS that needs a specific version of node to build
```hcl
static_hosting "my-site" {
    platform = "aws"

    build {
        nodejs_version = "16"
    }

    domain {
        name = "react-spa1.maplecone.com"
        zone = "maplecone.com"
    }
}
```

#### A react application on GCP, providing some details for the GCP project to use
```hcl
static_hosting "my-site" {
    platform = "gcp"

    # if not provided, a new project will be created automatically based on name_prefix
    google_cloud_project {
        project_id = "my-project"
        # optional
        organization_id = "my-org"
    }

    domain {
        name = "mysite.example.com"
        # these are not optional
        zone = "example-com"
        zone_project = "dns-project"
    }
}
```

#### Hosting an exported Next.js application (`next build && next export`)
```hcl
static_hosting "my-site" {
    platform = "aws"

    build {
        # since `next build && next export` generates both a `.next` folder an a `out` folder
        # we help anyfront know that the `out` folder is the one that should be served
        build_output_dir = "out"
    }

    domain {
        name = "nextexport1.maplecone.com"
        zone = "maplecone.com"
    }
}
```

#### Disabling the build to deploy static files that you provide
```hcl
static_hosting "my-site" {
    platform = "aws"

    build {
        # we disabled the build since we want to provide our own files
        disabled = true
        # then we indicate the folder containing the files to upload/serve
        build_output_dir = "path/from/project/root"
    }

    domain {
        name = "my-site.maplecone.com"
        zone = "maplecone.com"
    }
}
```

#### Overriding the install and build commands
```hcl
static_hosting "my-site" {
    platform = "aws"

    build {
        # by default, if a yarn.lock file exists, anyfront will automatically use yarn, but if you want to force it
        install_cmd = "yarn install"

        # any command can be used
        build_cmd = "node build.js"

        # anyfront will try to detect where your build files end up, 
        # if it can't you might have to specify the path yourself
        # build_output_dir = "path/from/project/root"
    }

    domain {
        name = "my-site.maplecone.com"
        zone = "maplecone.com"
    }
}
```


### Argument reference

#### Arguments for all platforms

`copy_from`: (Optional, string) Name of the `default` block to inherit from, if not provided the unnamed `default` block is used

`name_prefix`: (Optional, string) Prefix appended to the resource names

`platform`: (Required, string) The platform to deploy to. Currently supported: `aws`, `gcp`

`root_object`: (Optional, string) The default object to serve when requesting the path `/`

`region`: (Optional, string) The region in which the origin will be. This doesn't matter too much as the site is behind a CDN on all platforms. Defaults to `us-east-1` on AWS and `us-central1` on GCP

`build`: (Optional, block) Block to configure the building of your application

`domain`: (Optional, block) Block to configure the domain name of your site


#### GCP only Arguments

`google_cloud_project_id`: (Optional, string) The ID of the GCP project to use. If not provided, a new project will be created automatically based on `name_prefix`. This is a shorthand for `google_cloud_project.project_id`

`google_cloud_project`: (Optional, block) Block to configure the GCP project to use, overrides `google_cloud_project_id` if provided

---

`build` block attributes:

&nbsp;&nbsp;&nbsp;&nbsp;`disabled`: (Optional, boolean) If set to `true`, the build step will be skipped. Defaults to `false`. If `true`, `build_output_dir` must be provided

&nbsp;&nbsp;&nbsp;&nbsp;`install_cmd`: (Optional, string) The command to run to install dependencies. Defaults to `npm install` if a `package-lock.json` file is found, `yarn install` if a `yarn.lock` file is found, and `npm install` otherwise

&nbsp;&nbsp;&nbsp;&nbsp;`build_cmd`: (Optional, string) The command to run to build your application. Defaults to `npm run build` if a `package-lock.json` file is found, `yarn build` if a `yarn.lock` file is found, and `npm run build` otherwise

&nbsp;&nbsp;&nbsp;&nbsp;`build_output_dir`: (Optional, string) The path to the folder containing the files to upload. If not provided, anyfront will try to detect it automatically by looking at which files get created when running `build_cmd`

&nbsp;&nbsp;&nbsp;&nbsp;`nodejs_version`: (Optional, string) The version of node to use when building your application. Defaults to `18`

&nbsp;&nbsp;&nbsp;&nbsp;`environment`: (Optional, Object or block) Key-value pairs of environment variables to set when running `install_cmd` and `build_cmd`

---

`domain` block attributes:

&nbsp;&nbsp;&nbsp;&nbsp;`name`: (Optional, string) The domain name of your site. If not provided, your site will be accessible via either the Cloudfront URL or the GCP load balancer's IP

&nbsp;&nbsp;&nbsp;&nbsp;`zone`: (Optional, string) The name DNS zone to use. On GCP you also need to provide `zone_project`. Example: `example-com` for `example.com` on GCP, `example.com` for `example.com` on AWS

&nbsp;&nbsp;&nbsp;&nbsp;`zone_project`: (Optional, string) The name of the GCP project containing the DNS zone. Only required on GCP


---

`google_cloud_project` block attributes:

&nbsp;&nbsp;&nbsp;&nbsp;`project_id`: (Optional, string) The ID of the GCP project to use. If not provided, a new project will be created automatically based on `name_prefix`

&nbsp;&nbsp;&nbsp;&nbsp;`organization_id`: (Optional, string) The ID of the GCP organization to use. If not provided, the default organization will be used. Overrides `organization_domain`

&nbsp;&nbsp;&nbsp;&nbsp;`organization_domain`: (Optional, string) The domain of the GCP organization to use. If not provided, the default organization will be used

&nbsp;&nbsp;&nbsp;&nbsp;`billing_account_id`: (Optional, string) The ID of the GCP billing account to use. If not provided, the default billing account will be used (`My Billing Account`). Overrides `billing_account_name`

&nbsp;&nbsp;&nbsp;&nbsp;`billing_account_name`: (Optional, string) The name of the GCP billing account to use. If not provided, the default billing account will be used (`My Billing Account`)