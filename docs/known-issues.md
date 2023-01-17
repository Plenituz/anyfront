# Known issues:

- Deleting/destroying a static_hosting block on GCP sometimes doesn't do anything (sorry! as a workaround you can manually delete in the GCP console: cloud run, load balancing, cloud DNS, or manually run `terraform destroy` in the directory created by `barbe generate/apply`)
- Not defining an explicit `state_store` but having a `default` block with a `name_prefix` will cause the root directory's terraform backend to refer a non-existing bucket. To workaround this, you can explicitly define a `state_store`, only if you're using non-anyfront blocks though
- Destroying a `aws_next_js` block without having run either `apply` or `generate` before will cause the `barbe destroy` command to fail. To workaround this, you can run `barbe generate` before destroying `barbe destroy`