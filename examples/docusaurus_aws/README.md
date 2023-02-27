# AWS Next.js example

The only Anyfront-related file in this folder is `infra.hcl`.

This folder shows an example of a Docusaurus project deployed on GCP using anyfront. (this example project is from [jest](https://github.com/facebook/jest/tree/main/website))

Before you can deploy this example on your AWS account make sure you:
- Have AWS credentials on the computer running the deployment
- In `infra.hcl`, there is a few values you will need to update
```hcl
static_hosting "docusaurus" {
    domain {
        # the domain name you want the app to be under
        name = "docusaurus1.anyfront.dev"
    }
}
```

You can then run
```bash
sudo barbe apply infra.hcl
```

This will:
- Optionally create the S3 bucket to store the terraform and barbe state
- Build the Docusaurus app
- Create all the infrastructure needed to serve the website on various AWS services

Then to tear down all the infrastructure created
```bash
sudo barbe destroy infra.hcl
```

> Note: When destroying the template the first time most resources will be deleted but the terraform execution will fail. This is due to how Lambda@Edge deletions work: there is a background process that AWS has to run once it detects our Cloudfront distribution has been deleted, this might take a few minutes to an hour. You can re-run the `destroy` command after a while to finish the deletion