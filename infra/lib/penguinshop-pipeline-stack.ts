// ... imports unchanged
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PenguinshopTrafficShiftLambda } from './penguinshop-trafficshift-lambda';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class PenguinshopPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ✅ Validación de entorno
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN must be set in your environment or .env file');
    }

    const account = process.env.AWS_ACCOUNT_ID || cdk.Stack.of(this).account;
    const region = process.env.AWS_REGION || cdk.Stack.of(this).region;

    const importedRepoName = cdk.Fn.importValue('penguinshop-dev');
    const ecrRepo = ecr.Repository.fromRepositoryAttributes(this, 'EcrRepo', {
      repositoryName: importedRepoName,
      repositoryArn: `arn:aws:ecr:us-east-1:400017207288:repository/penguinshop-dev`,
    });

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    const project = new codebuild.PipelineProject(this, 'DockerBuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
      },
    });

    project.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload',
        'ecr:PutImage'
      ],
      resources: [ecrRepo.repositoryArn],
    }));

    ecrRepo.grantPullPush(project);

    const pipeline = new codepipeline.Pipeline(this, 'PenguinshopPipeline', {
      pipelineName: 'penguinshop-cascade-pipeline',
      crossAccountKeys: true,
    });

    // ✅ Aquí usamos directamente githubSecret como plainText
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.GitHubSourceAction({
          actionName: 'GitHub_Source',
          owner: 'misterpoloy', // #replace
          repo: 'penguinshop',
          oauthToken: cdk.SecretValue.unsafePlainText(githubToken!),
          output: sourceOutput,
          branch: 'main',
          trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
        }),
      ],
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Docker_Build',
          project,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    // const envs = ['dev']; Uncomment this if no collision on other AWS accounts
    // For multiple environments, you can use a context variable or similar to define them
    const env = this.node.tryGetContext('env') || 'dev';
    const envs = [env];

    envs.forEach((env) => {
      // Importamos el nombre y el cluster
      const serviceName = cdk.Fn.importValue(`penguinshop-service-name-${env}`);

      const cluster = ecs.Cluster.fromClusterAttributes(this, `Cluster-${env}`, {
        clusterName: `penguinshop-cluster-${env}`,
        vpc,
      });

      // Importamos la Service por nombre, sin ARN largo
      const ecsService = ecs.FargateService.fromFargateServiceAttributes(
        this,
        `EcsService-${env}`,
        {
          serviceName,   // <- nombre fijo
          cluster,
        },
      );

      const trafficShiftLambda = new PenguinshopTrafficShiftLambda(this, `TrafficShift-${env}`, {
        listenerArn: 'arn:aws:elasticloadbalancing:...', // provide actual ALB listener ARN 
        blueTargetGroupArn: 'arn:aws:elasticloadbalancing:...', // provide actual blue TG ARN
        greenTargetGroupArn: 'arn:aws:elasticloadbalancing:...', // provide actual green TG ARN
      });

      if (env === 'prod') {
        pipeline.addStage({
          stageName: 'Approval',
          actions: [
            new codepipeline_actions.ManualApprovalAction({
              actionName: 'Manual_Approval',
            }),
          ],
        });
      }

      pipeline.addStage({
        stageName: `Deploy-${env.toUpperCase()}`,
        actions: [
          new codepipeline_actions.EcsDeployAction({
            actionName: `Deploy_to_${env.toUpperCase()}`,
            service: ecsService,
            input: buildOutput,
          }),
        ],
      });
    });

    cdk.Tags.of(this).add('Workshop', 'PenguinShop');
  }
}
