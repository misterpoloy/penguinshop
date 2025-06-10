import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';

export class PenguinshopStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const env = this.node.tryGetContext('env') || 'dev';

    // ECR repository
    const repo = new ecr.Repository(this, `PenguinshopRepo-${env}`, {
      repositoryName: `penguinshop-${env}`,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, `PenguinshopCluster-${env}`, {
      clusterName: `penguinshop-cluster-${env}`,
    });

    // Fargate Service with ALB
    new ecsPatterns.ApplicationLoadBalancedFargateService(this, `PenguinshopService-${env}`, {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(repo),
        containerPort: 3000,
      },
      publicLoadBalancer: true,
    });

    // Tags for cleanup + cost tracking
    cdk.Tags.of(this).add('Workshop', 'PenguinShop');
    cdk.Tags.of(this).add('Environment', env);
  }
}
