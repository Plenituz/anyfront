# How it works

This article is about explaining how anyfront is made and what it does for you.

## Barbe

[Barbe](https://github.com/Plenituz/barbe) is a platform/engine that makes building tools like Anyfront easier. It's like a CDK but for any vendor. Anyfront is a collection of templates that are interpreted by Barbe to generate a bunch of Terraform configs, zip files, Docker images, and run commands.

To deploy your website you install Barbe, and use the URL to the Anyfront manifest `anyfront/manifest.json`
```hcl
template {
    # \/ this is the URL to the manifest of anyfront \/
    manifest = "anyfront/manifest.json"
}
```

The manifest contains a list of components. Each component is a little script that runs in a sandbox and returns to barbe the instructions of what to do with blocks like "aws_next_js".

## Docker and Buildkit

One of the thing that makes anyfront and barbe very powerful is it's usage of Buildkit. Buildkit is a way to run short lived containers, mostly known for being used by Docker to build images, but it can be used to run any command in a container.

This is how anyfront can build your app using a node version that's different from the one you have installed, or deploy your infrastructure using terraform without you having to install anything.

This is also why you need to run barbe with sudo: Buildkit relies on a container runtime (like Docker), which most people have setup to require sudo.

### Why is this good?

Using buildkit and barbe in combination comes with a lot of benefits, for example:
- Builds are reproducible, you can run the same build on any machine and get the same result, without having to install (appart from a container runtime)
- Because of the separation between your configuration and the definition of components, your infrastructure will always be up to date, even if you don't update your configuration, anyfront will update the implementation of each block as cloud platforms release new services
- With the component model of barbe, it is really easy to create plugins for existing blocks or create new blocks to integrate existing/custom toolchains

## So what does anyfront do?

Here are a few things anyfront does for you, using the tools mentioned above:
- Build your front end project, in a container
- Generate all the infrastructure needed to deploy your app, as human readable Terraform templates
- Build any Docker images needed to deploy your app, for example an Nginx image with your static files for Google Cloud Run
- Run Terraform, in a container
- Run any other commands to invalidate CDN caches, deploy new version of images, etc.

