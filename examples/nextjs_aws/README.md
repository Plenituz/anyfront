# AWS Next.js example

The only Anyfront-related file in this folder is `infra.hcl`.

This folder shows an example of a Next.js project deployed on AWS using anyfront. (this example project is from [open-next](https://github.com/serverless-stack/open-next/tree/main/example)).

This example also shows how to use environment variables to create multiple environments (dev, staging, prod, etc.) with the same config file.

Before you can deploy this example on your AWS account make sure you:
- Have AWS credentials on the computer running the deployment
- In `infra.hcl`, there is a few values you will need to update
```hcl
aws_next_js "my-site" {
    domain {
        # the domain name you want the app to be under
        name = "nextapp1.anyfront.dev"
        # the name of the existing DNS zone on your AWS account
        zone = "anyfront.dev"
    }
}
```

You can then run
```bash
sudo barbe apply infra.hcl --env STAGE=prod
```

This will:
- Optionally create the S3 bucket to store the terraform and barbe state
- Build the Next.js app
- Create all the infrastructure needed to serve the website on various AWS services

Then to tear down all the infrastructure created
```bash
sudo barbe destroy infra.hcl --env STAGE=prod
```

> Note: When destroying the template the first time most resources will be deleted but the terraform execution will fail. This is due to how Lambda@Edge deletions work: there is a background process that AWS has to run once it detects our Cloudfront distribution has been deleted, this might take a few minutes to an hour. You can re-run the `destroy` command after a while to finish the deletion