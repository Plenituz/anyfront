# aws_sveltekit

This module builds and deploys a SvelteKit application on AWS

> For Svelte single page apps, or statically generated SvelteKit apps see [static_hosting](./static_hosting.md) for a cheaper and faster hosting

> Anyfront will override any `adapter` you have configured in your `svelte.config.js` file, but you do need a `svelte.config.js` file in your project root

---

### Example usage

#### A SvelteKit application on AWS
```hcl
aws_sveltekit "my-site" {
    domain {
        # the domain name you want the app to be under
        name = "my-next-app.example.com"
    }
}
```

---

### Argument reference

`copy_from`: (Optional, string) Name of the `default` block to inherit from, if not provided the unnamed `default` block is used

`name_prefix`: (Optional, string) Prefix appended to the resource names

`region`: (Optional, string) The region in which the origin will be. Defaults to `us-east-1`

`app_dir`: (Optional, string) The directory containing the SvelteKit application. Defaults to the current directory. This is a shorthand for `build.app_dir`

`nodejs_version`: (Optional, string) The version of Node.js to use to build and serve the application. The Node.js version selected must be supported by Lambda@Edge. Defaults to `16`. This is a shorthand for `build.nodejs_version`

`nodejs_version_tag`: (Optional, string) The tag of the Node.js docker image to use to build the application. Defaults to `-slim`. This is a shorthand for `build.nodejs_version_tag`

`build`: (Optional, block) Block to configure the building of your application

`domain`: (Optional, block) Block to configure the domain name of your site

---

`build` block attributes:

&nbsp;&nbsp;&nbsp;&nbsp;`disabled`: (Optional, boolean) If set to `true`, the build step will be skipped. Defaults to `false`. If `true`, `build_output_dir` must be provided

&nbsp;&nbsp;&nbsp;&nbsp;`app_dir`: (Optional, string) The directory containing the Next.js application. Defaults to the current directory. Overrides `app_dir` on the parent block

&nbsp;&nbsp;&nbsp;&nbsp;`install_cmd`: (Optional, string) The command to run to install dependencies. Defaults to `npm install`

&nbsp;&nbsp;&nbsp;&nbsp;`build_cmd`: (Optional, string) The command to run to build your application. Defaults to `npm run build`

&nbsp;&nbsp;&nbsp;&nbsp;`nodejs_version`: (Optional, string) The version of Node.js to use to build and serve the application. The Node.js version selected must be supported by Lambda@Edge. Defaults to `16`. Overrides `nodejs_version` on the parent block

&nbsp;&nbsp;&nbsp;&nbsp;`nodejs_version_tag`: (Optional, string) The tag of the Node.js docker image to use to build the application. Defaults to `-slim`. Overrides `nodejs_version_tag` on the parent block
---

`domain` block attributes:

&nbsp;&nbsp;&nbsp;&nbsp;`name` or `names`: (Optional, string or string array) The domain name(s) of your site. If not provided, your site will be accessible via the Cloudfront distribution's URL

&nbsp;&nbsp;&nbsp;&nbsp;`use_alias`: (Optional, boolean) If set to true the Route53 record will be an alias record. By defaults anyfront determines if an alias is needed automatically

&nbsp;&nbsp;&nbsp;&nbsp;`zone`: (Optional, string) The name of the Route53 zone to use. Example: `example.com`. Required if the component cannot determine the name of the zone from the domain name (for example, if you are using a variable or conditional in the domain name)

&nbsp;&nbsp;&nbsp;&nbsp;`certificate_arn`: (Optional, string) The ARN of the ACM certificate to use for HTTPS. If not provided, a certificate will be created for you with the exact domain name(s) of your site

&nbsp;&nbsp;&nbsp;&nbsp;`existing_certificate_domain`: (Optional, string) The domain name of an existing ACM certificate to use for HTTPS, for example `*.example.com`. If not provided, a certificate will be created for you with the exact domain name(s) of your site

&nbsp;&nbsp;&nbsp;&nbsp;`certificate_domain_to_create`: (Optional, string) The domain name of a new ACM certificate to create for HTTPS, for example `*.example.com`. If not provided, a certificate will be created for you with the exact domain name(s) of your site
