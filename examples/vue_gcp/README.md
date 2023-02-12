# GCP Vue3 Single Page App example

The only Anyfront-related file in this folder is `infra.hcl`.

This folder shows an example of a static Vue project deployed on GCP using anyfront. (this example project is from [vue3-realworld-example-app](https://github.com/mutoe/vue3-realworld-example-app))

Before you can deploy this example on your GCP account make sure you:
- Have GCP credentials on the computer running the deployment
- In `infra.hcl`, there is a few values you will need to update
```hcl
# this is the GCP project in which the website will be deployed
# this can be removed and a new project will be created for you.
# if you do so, you still need to provide a project_id in the state_store block below
project_id = "my-project"

# the domain name you want the app to be under
domain_name = "vue-spa1.barbe.app"
# the name of the existing DNS zone on your GCP account
domain_zone_name = "barbe-app"
# the project id in which the DNS zone above is
domain_project_id = "barbe-website"
```

You can then run
```bash
sudo barbe apply infra.hcl
```

This will:
- Optionally create the GCS bucket to store the terraform and barbe state
- Optionally create and setup a GCP project
- Build the Vue app
- Create and upload an image containing the Next.js build to GCP
- Create all the infrastructure needed to serve the website on various GCP services

> Note: SSL Certificate creation can take several minutes on GCP, arm yourself with patience!

Then to tear down all the infrastructure created
```bash
sudo barbe destroy infra.hcl
```