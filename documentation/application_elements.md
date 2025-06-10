# Explanation of the elements

## What are we building?

You are building a modern, automated deployment pipeline for a containerized application on AWS, with blue/green deployment support, using AWS CDK, ECS Fargate, ALB, Lambda, and CodePipeline. The stacks are modular: one for core infra, one for CI/CD, and a reusable construct for blue/green traffic shifting.

### Folder structure:
```
penguinshop/
├── app/                        # (Your application source code)
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
├── app/                  # (Usually at the root or in /app)
│   └── dockerfile
```

---


### 📁 penguinshop-stack.ts

> Purpose:
Defines the core infrastructure for each environment (dev, qa, prod).

**What it does**:

Creates an ECR repository for Docker images.
Creates an ECS Cluster.
Deploys a Fargate Service (with a public Application Load Balancer) that runs containers from the ECR repo.
Tags resources for cost tracking and cleanup.

### 📁 penguinshop-pipeline-stack.ts

> Purpose: Defines the CI/CD pipeline using AWS CodePipeline.

**What it does:**

References the ECR repo and VPC.
Sets up a CodePipeline with:
Source Stage: Pulls code from GitHub.
Build Stage: Builds Docker images using CodeBuild and pushes to ECR.
Deploy Stages: For each environment (dev, qa, prod):
Looks up the ECS service.
Deploys the new image to ECS using ECS Deploy Action.
For prod, adds a manual approval step before deployment.
Instantiates a traffic shift Lambda for blue/green deployments (see below).

### 📁 penguinshop-trafficshift-lambda.ts

> Purpose: Defines a Lambda construct for shifting traffic between target groups (blue/green deployment).

**What it does:**

Creates a Lambda function from the code in lambda/traffic-shift.
Passes ALB listener and target group ARNs as environment variables.
Grants the Lambda permissions to modify and describe ALB listeners.

### 📁 index.ts

> Purpose: Implements the Lambda function logic for shifting traffic.

What it does:

Reads ALB listener and target group ARNs from environment variables.
Calls modifyListener on the ALB to split traffic (e.g., 50/50) between blue and green target groups.

## How They Work Together (Architecture & Flow)

1. **Infrastructure Setup**
    `PenguinshopStack` provisions the ECR repo, ECS cluster, and Fargate service with a public ALB for each environment.

2. **Pipeline Setup**
    `PenguinshopPipelineStack` creates a CodePipeline:
- Source: Pulls code from GitHub.
- Build: Builds Docker images and pushes to ECR.
- Deploy: For each environment:
    - Looks up the ECS service and deploys the new image.
    - Instantiates a `PenguinshopTrafficShiftLambda` for blue/green traffic shifting.
    - For prod, requires manual approval before deployment.
- Traffic Shifting
The `PenguinshopTrafficShiftLambda` construct deploys a Lambda function (code in `index.ts`) that can update the ALB listener to shift traffic between blue and green target groups, enabling blue/green deployments.

## Order of What Is Built
ECR, ECS, ALB, and Fargate Service (per environment) via PenguinshopStack.
CI/CD Pipeline via PenguinshopPipelineStack:
Source → Build → Deploy (dev, qa, prod).
Deploys new Docker images to ECS.
Sets up traffic shift Lambda for blue/green deployments.
Traffic Shift Lambda is deployed and can be invoked to update ALB listener rules for blue/green traffic shifting.

