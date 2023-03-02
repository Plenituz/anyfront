<p align="center">
    <a href="https://anyfront.dev/">
        <img src="./anyfront-logo.png" width="150"/>
    </a>
</p>
<p align="center">
Deploy any front-end on any cloud platform
</p>

---

Anyfront simplifies deploying web applications on AWS and GCP


Deploy from your terminal
```bash
curl -fsSL https://hub.barbe.app/install.sh | sh -

# deploy to AWS
cd /path/to/project
sudo barbe apply anyfront/aws.hcl --env DOMAIN=my-domain.example.com

# deploy to GCP
cd /path/to/project
sudo barbe apply anyfront/gcp.hcl \
    --eng PROJECT_ID=my-project \
    --env DOMAIN=my-domain.example.com \
    --env ZONE=example-com \
    --env ZONE_PROJECT=dns-project
```

Or deploy a public github repo on your AWS account with our [quick start CloudFormation template](https://hub.barbe.app/anyfront/try.cloudformation.yml)

Quick start guides:
- [Guide to deploying on AWS](./docs/deploying-to-aws.md)
- [Guide to deploying on GCP](./docs/deploying-to-gcp.md)

### Currently supported platforms and frameworks

|                           | AWS                          | GCP                          |
|---------------------------|------------------------------|------------------------------|
| Any static website        | [✓](docs/static-websites.md) | [✓](docs/static-websites.md) |
| React SPA                 | [✓](docs/static-websites.md) | [✓](docs/static-websites.md) |
| Docusaurus                | [✓](docs/static-websites.md) | [✓](docs/static-websites.md) |
| Next.js                   | [✓](examples/nextjs_aws/)    | [✓](examples/nextjs_gcp/)    |
| Svelte SPA                | [✓](docs/static-websites.md) | [✓](docs/static-websites.md) |
| SvelteKit                 | [✓](examples/sveltekit_aws/) | 🔜                           |
| Vue SPA                   | [✓](docs/static-websites.md) | [✓](docs/static-websites.md) |
| SolidJS SPA               | [✓](docs/static-websites.md) | [✓](docs/static-websites.md) |
| Any containerized website | 🔜                           | 🔜                           |
| SolidStart                | 🔜                           | 🔜                           |
| Astro                     | 🔜                           | 🔜                           |
| Qwik                      | 🔜                           | 🔜                           |


> [Create/thumbs up an issue](https://github.com/Plenituz/anyfront/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement) for your favorite framework/platform so we can prioritize it

---
### Need some help? Reach out on [Discord](https://hub.barbe.app/discord)!