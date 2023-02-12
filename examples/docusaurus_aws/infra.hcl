template {
    manifest = "anyfront/manifest.json"
}

static_hosting "docusaurus" {
    platform = "aws"

    build {
        # these commands are specific to the jest website example
        # if you don't provide a install_cmd and build_cmd,
        # the defaults are `npm install` and `npm run build`,
        # which will work for most docusaurus projects
        install_cmd = "yarn && node fetchSupporters.js"
        build_cmd = "yarn build"
    }

    domain {
        name = "docusaurus1.anyfront.dev"
    }
}