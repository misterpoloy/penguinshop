import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';

export class PenguinshopStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const env = this.node.tryGetContext('env') || 'dev';

    const repo = new ecr.Repository(this, `PenguinshopRepo-${env}`, {
      repositoryName: `penguinshop-${env}`,
    });

    // 👇 Export the ECR repository name
    new cdk.CfnOutput(this, 'PenguinshopRepoNameExport', {
      value: repo.repositoryName,
      exportName: 'penguinshop-dev', // 👈 MUST match what you'll import with
    });

    const cluster = new ecs.Cluster(this, `PenguinshopCluster-${env}`, {
      clusterName: `penguinshop-cluster-${env}`,
    });

    new ecsPatterns.ApplicationLoadBalancedFargateService(this, `PenguinshopService-${env}`, {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('public.ecr.aws/docker/library/nginx:latest'),
        containerPort: 80,
      },
      publicLoadBalancer: true,
    });

    cdk.Tags.of(this).add('Workshop', 'PenguinShop');
    cdk.Tags.of(this).add('Environment', env);
  }
}
