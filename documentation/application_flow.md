# CI/CD Flow

Here’s a step-by-step explanation of the CI/CD flow from a code change in your app folder to deployment in ECS (dev → qa → prod):

---

## 1. **You make a change in app (e.g., index.js, `public/index.html`, or Dockerfile)**

- This is your Node.js Express app, containerized with the provided Dockerfile.

---

## 2. **You push your changes to GitHub**

- The pipeline is triggered by a push to the `main` branch (see the `GitHubSourceAction` in your pipeline stack).

---

## 3. **CodePipeline: Source Stage**

- **Action:** Pulls the latest code from GitHub.
- **Artifact:** Source code (including the app folder and Dockerfile).

---

## 4. **CodePipeline: Build Stage**

- **Action:** Uses AWS CodeBuild to:
  - Build the Docker image using your Dockerfile in app.
  - Push the built image to the ECR repository (`penguinshop-dev`).
- **Permissions:** CodeBuild is granted permission to push to ECR.

---

## 5. **CodePipeline: Deploy Stages (dev → qa → prod)**

For each environment (`dev`, `qa`, `prod`):

- **ECS Service Lookup:** The pipeline references the correct ECS service for the environment.
- **Deploy Action:** Uses `EcsDeployAction` to update the ECS Fargate service with the new Docker image from ECR.
- **Blue/Green Lambda:** (Optional, if you wire it in) The traffic shift Lambda can be used to shift traffic between old/new versions using ALB target groups.
- **Manual Approval:** For `prod`, a manual approval step is required before deployment.

---

## 6. **ECS Fargate Service**

- The ECS service pulls the new Docker image from ECR and starts new containers.
- The Application Load Balancer (ALB) routes traffic to the new containers.

---

## **Summary Table**

| Step                | What Happens                                                                 |
|---------------------|------------------------------------------------------------------------------|
| Code Change         | You edit code in app                                                      |
| Git Push            | You push to GitHub                                                           |
| Source Stage        | Pipeline pulls latest code                                                    |
| Build Stage         | CodeBuild builds Docker image, pushes to ECR                                 |
| Deploy (dev/qa/prod)| ECS service is updated with new image, traffic is shifted via ALB/Lambda     |
| Manual Approval     | Required for prod before deployment                                          |

---

## **Visual Flow**

```
[You] 
  ↓
[GitHub Repo] 
  ↓ (trigger)
[CodePipeline]
  ├─ Source (GitHub)
  ├─ Build (CodeBuild → Docker build → ECR push)
  └─ Deploy (ECS Deploy Action → Fargate Service → ALB)
        └─ (prod: Manual Approval)
```

---

**In short:**  
Every code change in app flows through GitHub → CodePipeline → CodeBuild (Docker build) → ECR → ECS Fargate → ALB, with blue/green deployment support and manual approval for production.