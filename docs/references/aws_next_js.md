# aws_next_js

This module builds and deploys a Next.js application on AWS

> For Next.js static websites generated using `next build && next export`, see [static_hosting](./static_hosting.md) for a cheaper and faster hosting

---

### Example usage

#### A Next.js application on AWS
```hcl
aws_next_js "my-site" {
    domain {
        # the domain name you want the app to be under
        name = "my-next-app.example.com"
        # the name of the existing DNS zone on your AWS account
        zone = "example.com"
}
```

---

### Argument reference

`copy_from`: (Optional, string) Name of the `default` block to inherit from, if not provided the unnamed `default` block is used

`name_prefix`: (Optional, string) Prefix appended to the resource names

`region`: (Optional, string) The region in which the origin will be. Defaults to `us-east-1`

`app_dir`: (Optional, string) The directory containing the Next.js application. Defaults to the current directory. This is a shorthand for `build.app_dir`

`nodejs_version`: (Optional, string) The version of Node.js to use to build and serve the application. The Node.js version selected must be supported by Lambda@Edge. Defaults to `16`. This is a shorthand for `build.nodejs_version`

`build`: (Optional, block) Block to configure the building of your application

`domain`: (Optional, block) Block to configure the domain name of your site

---

`build` block attributes:

&nbsp;&nbsp;&nbsp;&nbsp;`disabled`: (Optional, boolean) If set to `true`, the build step will be skipped. Defaults to `false`. If `true`, `build_output_dir` must be provided

&nbsp;&nbsp;&nbsp;&nbsp;`app_dir`: (Optional, string) The directory containing the Next.js application. Defaults to the current directory. Overrides `app_dir` on the parent block

&nbsp;&nbsp;&nbsp;&nbsp;`install_cmd`: (Optional, string) The command to run to install dependencies. Defaults to `npm install`

&nbsp;&nbsp;&nbsp;&nbsp;`build_cmd`: (Optional, string) The command to run to build your application. Defaults to `npm run build`

&nbsp;&nbsp;&nbsp;&nbsp;`build_output_dir`: (Optional, string) The path to the folder containing the files to upload. If not provided, anyfront will try to detect it automatically by looking at which files get created when running `build_cmd`

&nbsp;&nbsp;&nbsp;&nbsp;`nodejs_version`: (Optional, string) The version of Node.js to use to build and serve the application. The Node.js version selected must be supported by Lambda@Edge. Defaults to `16`. Overrides `nodejs_version` on the parent block

---

`domain` block attributes:

&nbsp;&nbsp;&nbsp;&nbsp;`name`: (Optional, string) The domain name of your site. If not provided, your site will be accessible in HTTP only via the load balancer's IP

&nbsp;&nbsp;&nbsp;&nbsp;`zone`: (Optional, string) The name of the Route53 zone to use. Example: `example.com`

&nbsp;&nbsp;&nbsp;&nbsp;`certificate_arn`: (Optional, string) The ARN of the ACM certificate to use for HTTPS. If not provided, a certificate will be created for you with the exact domain name of your site

&nbsp;&nbsp;&nbsp;&nbsp;`existing_certificate_domain`: (Optional, string) The domain name of an existing ACM certificate to use for HTTPS, for example `*.example.com`. If not provided, a certificate will be created for you with the exact domain name of your site

&nbsp;&nbsp;&nbsp;&nbsp;`certificate_domain_to_create`: (Optional, string) The domain name of a new ACM certificate to create for HTTPS, for example `*.example.com`. If not provided, a certificate will be created for you with the exact domain name of your site