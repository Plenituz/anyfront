# anyfront

This component automatically looks in the current directory and all it's sub directories until it finds a `package.json` with a supported front end framework. It then uses the appropriate component to deploy the app.

> An error will be returned if more than one `package.json` with a supported framework is detected, you can use `app_dir` to tell `anyfront` to restrict it's search to a given directory.


---

### Example usage

#### Deploying on AWS
```hcl
anyfront "my-site" {
    platform = "aws"
    domain {
        name = "my-app.example.com"
    }
}
```

#### Deploying on GCP
```hcl
anyfront "my-site" {
    platform = "gcp"
    domain {
        name = "my-app.example.com"
        zone = "example-com"
        zone_project = "domains-project"
    }
}
```

---

### Argument reference

`copy_from`: (Optional, string) Name of the `default` block to inherit from, if not provided the unnamed `default` block is used

`name_prefix`: (Optional, string) Prefix appended to the resource names

`platform`: (Required, string) The platform to deploy to. Valid values are `aws` and `gcp`

`app_dir`: (Optional, string) The directory containing the application to deploy. Defaults to the current directory. This directory and it's sub directories will be searched for a `package.json` with a supported framework

---

This block a bit special: it's role is to be an abstraction for other blocks like `aws_next_js` or `gcp_next_js`. Therefore all other attributes you pass to it are relayed as-is to the internal component. You can refer to them here:
- [aws_next_js](aws_next_js.md)
- [gcp_next_js](gcp_next_js.md)
- [static_hosting](static_hosting.md)
- [aws_sveltekit](aws_sveltekit.md)