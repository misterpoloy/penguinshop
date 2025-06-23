import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as path from 'path';               
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam'; // 👈 Asegúrate de tener esta línea también

export class PenguinshopStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const env = this.node.tryGetContext('env') || 'dev';

    /* ------------------------------------------------------------------
     * 1️⃣ ECR: Repo creation
     * ------------------------------------------------------------------ */
    const repo = new ecr.Repository(this, `PenguinshopRepo-${env}`, {
      repositoryName: `penguinshop-${env}`,
    });

    new cdk.CfnOutput(this, 'PenguinshopRepoNameExport', {
      value: repo.repositoryName,
      exportName: 'penguinshop-dev',
    });

    /* ------------------------------------------------------------------
     * 2️⃣ ECS: Cluster
     * ------------------------------------------------------------------ */
    const cluster = new ecs.Cluster(this, `PenguinshopCluster-${env}`, {
      clusterName: `penguinshop-cluster-${env}`,
    });

    /* ------------------------------------------------------------------
     * 3️⃣ Imagen “Hello World” construida en el *primer* deploy
     * ------------------------------------------------------------------ */
    const image = ecs.ContainerImage.fromAsset(
      path.join(__dirname, '../../app'),
      { platform: Platform.LINUX_AMD64 }
    );

    /* ------------------------------------------------------------------
     * 🛡️ Rol de ejecución para tareas ECS (permite acceso a ECR, logs, etc.)
     * ------------------------------------------------------------------ */
    const executionRole = new iam.Role(this, `TaskExecutionRole-${env}`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    /* ------------------------------------------------------------------
     * 4️⃣ Service Fargate con ALB
     * ------------------------------------------------------------------ */
    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      `PenguinshopService-${env}`,
      {
        cluster,
        publicLoadBalancer: true,
        taskImageOptions: {
          image,
          containerName: 'web',            // ↔️ coincide con buildspec.yml
          containerPort: 3000,
          environment: { NODE_ENV: 'production' },
          executionRole,
        },
        serviceName: `penguinshop-service-${env}`, // ↔️ coincide con CodePipeline
      },
    );

    // Exportar el nombre del servicio para usarlo en el pipeline
    new cdk.CfnOutput(this, `ServiceName-${env}`, {
      value: service.service.serviceName,
      exportName: `penguinshop-service-name-${env}`,
    });

    /* Health-check del ALB hacia /health */
    service.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
    });

    /* Etiquetas */
    cdk.Tags.of(this).add('Workshop', 'PenguinShop');
    cdk.Tags.of(this).add('Environment', env);
  }
}
