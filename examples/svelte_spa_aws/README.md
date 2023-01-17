# AWS Svelte Single Page App example

The only Anyfront-related file in this folder is `infra.hcl`.

This folder shows an example of a static svelte project deployed on AWS using anyfront. (this example project is from [pocketbase](https://github.com/pocketbase/site))

Before you can deploy this example on your AWS account make sure you:
- Have AWS credentials on the computer running the deployment
- In `infra.hcl`, there is a few values you will need to update
```hcl
domain {
    # the domain name you want the app to be under
    name = "svelte-spa1.maplecone.com"
    # the name of the existing DNS zone on your AWS account
    zone = "maplecone.com"
}
```

You can then run
```bash
# sudo might or might not be necessary depending on your docker setup
sudo barbe apply infra.hcl
```

This will:
- Optionally create the S3 bucket to store the terraform and barbe state
- Build the Svelte app
- Create all the infrastructure needed to serve the website on various AWS services

> Note: Cloudfront creation take several minutes, sometimes up to 10 minutes, arm yourself with patience!

Then to tear down all the infrastructure created
```bash
sudo barbe destroy infra.hcl
```

> Note: When destroying the template the first time most resources will be deleted but the terraform execution will fail. This is due to how Lambda@Edge deletions work: there is a background process that AWS has to run once it detects our Cloudfront distribution has been deleted, this might take a few minutes to an hour. You can re-run the `destroy` command after a while to finish the deletion