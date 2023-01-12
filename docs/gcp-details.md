# How GCP projects are handled

By default, all the GCP compatible blocks will create a new project automatically based on your `name_prefix` in the `default` block. There is nothing wrong with using the auto-generated projects as long as you understand that it will be automatically deleted when you delete the block or `destroy` the stack.

If you already have a project where you want to deploy your resources, all the GCP compatible blocks support having a `project_id` argument. In this case the project is never deleted by Anyfront, but Anyfront will enable some APIs on the project as needed.

For all the DNS/domain name related stuff, Anyfront currently assumes that you already registered the domain and have a DNS zone in one of your GCP projects. This is why you'll have to provide the `zone` (the name of the zone) and `zone_project` (the GCP project in which the zone is) arguments in the `domain` block.