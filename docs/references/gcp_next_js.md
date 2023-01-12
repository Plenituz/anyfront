# gcp_next_js

This module builds and deploys a Next.js application on GCP

> For Next.js static websites generated using `next build && next export`, see [static_hosting](./static_hosting.md) for a cheaper and faster hosting

---

### Example usage

#### A Next.js application on GCP
```hcl
gcp_next_js "my-site" {
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

#### A Next.js application on GCP, on an existing project
```hcl
gcp_next_js "my-site" {
    project_id = "my-project"
    organization_id = "my-organization"

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

---

### Argument reference

`copy_from`: (Optional, string) Name of the `default` block to inherit from, if not provided the unnamed `default` block is used

`name_prefix`: (Optional, string) Prefix appended to the resource names

`project_id`: (Optional, string) The ID of the GCP project to use. If not provided, a new project will be created automatically based on `name_prefix`

`organization_id`: (Optional, string) The ID of the GCP organization to use. If not provided, the default organization will be used. Overrides `organization_domain`

`organization_domain`: (Optional, string) The domain of the GCP organization to use. If not provided, the default organization will be used

`billing_account_id`: (Optional, string) The ID of the GCP billing account to use. If not provided, the default billing account will be used (`My Billing Account`). Overrides `billing_account_name`

`billing_account_name`: (Optional, string) The name of the GCP billing account to use. If not provided, the default billing account will be used (`My Billing Account`)

`region`: (Optional, string) The region in which the origin will be. Defaults to `us-central1`

`app_dir`: (Optional, string) The directory containing the Next.js application. Defaults to the current directory. This is a shorthand for `build.app_dir`

`nodejs_version`: (Optional, string) The version of Node.js to use to build and serve the application. Defaults to `16`. This is a shorthand for `build.nodejs_version`

`build`: (Optional, block) Block to configure the building of your application

`domain`: (Optional, block) Block to configure the domain name of your site

---

`build` block attributes:

&nbsp;&nbsp;&nbsp;&nbsp;`disabled`: (Optional, boolean) If set to `true`, the build step will be skipped. Defaults to `false`. If `true`, `build_output_dir` must be provided

&nbsp;&nbsp;&nbsp;&nbsp;`app_dir`: (Optional, string) The directory containing the Next.js application. Defaults to the current directory. Overrides `app_dir` on the parent block

&nbsp;&nbsp;&nbsp;&nbsp;`install_cmd`: (Optional, string) The command to run to install dependencies. Defaults to `npm install`

&nbsp;&nbsp;&nbsp;&nbsp;`build_cmd`: (Optional, string) The command to run to build your application. Defaults to `npm run build`

&nbsp;&nbsp;&nbsp;&nbsp;`build_output_dir`: (Optional, string) The path to the folder containing the files to upload. If not provided, anyfront will try to detect it automatically by looking at which files get created when running `build_cmd`

&nbsp;&nbsp;&nbsp;&nbsp;`nodejs_version`: (Optional, string) The version of Node.js to use to build and serve the application. Defaults to `16`. Overrides `nodejs_version` on the parent block

---

`domain` block attributes:

&nbsp;&nbsp;&nbsp;&nbsp;`name`: (Optional, string) The domain name of your site. If not provided, your site will be accessible in HTTP only via the load balancer's IP

&nbsp;&nbsp;&nbsp;&nbsp;`zone`: (Optional, string) The name of the DNS zone to use. You also need to provide `zone_project`. Example: `example-com` for `example.com`

&nbsp;&nbsp;&nbsp;&nbsp;`zone_project`: (Optional, string) The name of the GCP project containing the DNS zone