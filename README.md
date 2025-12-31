# EdgeOne Pages Functions: Cloud Object Storage | COS

This example demonstrates how EdgeOne Pages Functions work with GitHub's automatic commit storage and build processes.

## Deploy

Live Demo: https://oss.nbcnm.cn

## Getting Started

First, run the development server:

```bash
edgeone pages dev
```

Open [http://localhost:8088](http://localhost:8088) with your browser to see the result.

For local dev, please refer to this link:[Edge One document](https://pages.edgeone.ai/document/product-introduction).

You can start editing the page by modifying `app/views/HomeView.vue`. The page auto-updates as you edit the file.

## Learn More

This project uses Vue3 + Vite.

- [Vue Documentation](https://vuejs.org/) - learn about Vue features and API.
- [Vite Documentation](https://vitejs.dev/guide/) - an interactive Vite tutorial.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).



## Env configuration

Create a `.env` file in the root directory and add the following environment variables:

```env
owner = your-github-username
repo = your-github-repo
branch = your-github-branch
token = your-github-token
```

GitHub Tokens: You can create a personal access token in your GitHub account settings. Ensure you grant the necessary repository access permissions. We recommend selecting "Fine-grained tokens," then choosing `"Actions"`,`"Contents"`, `"Metadata"`, `"Workflows"` and granting read and write permissions.

Or refer to this link: [Environment Variables](https://pages.edgeone.ai/document/build-guide#c51018ad-71af-43a6-83af-acbc3690c653),Then use `edgeone pages link` in your project to synchronize your configured environment variables to your local machine.


## Create edgeone pages

You can refer to this tutorial link: Import your Git repository address into EdgeOne Pages to create your first EdgeOne Pages site: [Tutorial](https://pages.edgeone.ai/document/importing-a-git-repository)