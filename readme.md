# 🐧 PenguinShop AWS CDK Workshop

Welcome to the **PenguinShop** workshop! This hands-on project will guide you through building a modern, production-grade CI/CD pipeline for a containerized Node.js application on AWS, using best practices and blue/green deployment strategies.

---

## 🚀 What Are We Building?

You will deploy a **Node.js Express "Hello World" app** (in `/app`) to AWS using:

- **AWS CDK** (TypeScript) for Infrastructure as Code
- **Amazon ECS Fargate** for container orchestration
- **Amazon ECR** for Docker image storage
- **Application Load Balancer (ALB)** for traffic routing
- **AWS CodePipeline & CodeBuild** for CI/CD
- **AWS Lambda** for blue/green traffic shifting
- **AWS Secrets Manager** for secure token storage

The architecture is modular, with separate stacks for core infrastructure, CI/CD pipeline, and reusable constructs for blue/green deployments.

---

## 📂 Project Structure
```
penguinshop/
├── app/                       
├── documentation/
│   └── application_elements.md
├── infra/
│   ├── lambda/
│   │   └── traffic-shift/
│   │       └── index.ts
│   └── lib/
│       ├── penguinshop-stack.ts
│       ├── penguinshop-pipeline-stack.ts
│       └── penguinshop-trafficshift-lambda.ts
├── app/                  
│   └── dockerfile
```

## 📖 Documentation

- [Application Elements](documentation/application_elements.md)
- [CI/CD Flow](documentation/application_flow.md)

---

## 🛠️ Prerequisites

- **AWS Account** with admin permissions
- **GitHub Account** (for source code and GitHub token)
- **Node.js** (v18+ recommended)
- **npm** (v8+ recommended)
- **AWS CLI** ([Install Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
- **AWS CDK** ([Install Guide](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html))
- **Docker** ([Install Guide](https://www.docker.com/products/docker-desktop))
- **Git** ([Install Guide](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git))

---

## 🔐 Setup: Secrets & Environment

1. **Create a GitHub Personal Access Token**  
   - Go to [GitHub Tokens](https://github.com/settings/tokens)
   - Generate a classic token (`ghp_...`) with `repo` and `workflow` scopes.

2. **Create a `.env` file in `/infra`**  
```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx AWS_ACCOUNT_ID=your-aws-account-id
AWS_REGION=us-east-1
```
**Note:** `/infra/.env` is git-ignored for security.

---

## 🏗️ Workshop Steps

### 1. **Clone the Repository**

```sh
git clone https://github.com/your-org/penguinshop.git
cd penguinshop
```
### 2. Install Dependencies
```
cd infra
npm install
```

### 3. Bootstrap CDK (first time only)
```
npx cdk bootstrap
```

### 4. Build the CDK Project
```
npm run build
```

### 5. Deploy Core Infrastructure
```
npx cdk deploy PenguinshopStack-dev
```

### 6. Deploy the CI/CD Pipeline
```
npx cdk deploy PenguinshopPipelineStack-dev
```

### 7. Push Your App Code to GitHub
```
Ensure /app and buildspec.yml are in your repo root.
Push to the main branch to trigger the pipeline.
```

Ensure /app and buildspec.yml are in your repo root.
Push to the main branch to trigger the pipeline.

### 8. Monitor the Pipeline
> Go to AWS Console → CodePipeline → penguinshop-cascade-pipeline
Watch the stages: Source → Build → Deploy

### 9. Access Your App
Find the ALB DNS name in the ECS service or CDK output.
```
Visit http://<ALB-DNS-NAME>/ for your Hello World app.
```

## 🏆 Production-Ready Best Practices
- Secrets are managed in AWS Secrets Manager and never committed.
- Infrastructure is fully reproducible via AWS CDK.
- CI/CD is automated and supports blue/green deployments.
- .env and sensitive files are git-ignored.

## ❓ Need Help?
See the documentation/ folder for deep dives and troubleshooting.
Open an issue or contact the workshop maintainers.
```
jportiz@ibm.com
```
Happy building! 🐧

