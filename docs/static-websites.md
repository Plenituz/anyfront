# Hosting a static website

### What's a static website?

A static website is a website that doesn't need a backend to run. It's just a bunch of HTML/CSS/JS files that are served by a web server. This is what comes out by default when building a project with frameworks like React or Vue. Because of how simple this is, it's the cheapest and most performant way to host a website.

Here are a few examples of static websites:
- A Next.js app that you build using `next export`
- A regular React, Vue, Svelte, Solid app
- A Docusaurus website

Here are a few examples of websites that are not static:
- A Next.js app that you build using `next build`
- A SvelteKit, SolidStart, Remix app


With anyfront, you can deploy a static website to AWS or GCP using the [`static_hosting` block](../references/static_hosting.md)
```hcl
static_hosting "my-site" {
    platform = "aws"
    domain {
        name = "my-domain.example.com"
    }
}
```

Examples:
- [Docusaurus on AWS](../../examples/docusaurus_aws/)
- [Docusaurus on GCP](../../examples/docusaurus_gcp/)
- [React SPA on AWS](../../examples/react_spa_aws/)
- [React SPA on GCP](../../examples/react_spa_gcp/)