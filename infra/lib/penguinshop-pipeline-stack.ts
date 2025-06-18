import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PenguinshopTrafficShiftLambda } from './penguinshop-trafficshift-lambda';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class PenguinshopPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

     // --- Add this block at the top of your constructor ---
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN must be set in your environment or .env file');
    }
    const githubSecret = new secretsmanager.Secret(this, 'GithubTokenSecret', {
      secretName: 'GITHUB_TOKEN',
      secretStringValue: cdk.SecretValue.unsafePlainText(githubToken),
    });

    const account = process.env.AWS_ACCOUNT_ID || cdk.Stack.of(this).account;
    const region = process.env.AWS_REGION || cdk.Stack.of(this).region;

    // Reference ECR repo
    const importedRepoName = cdk.Fn.importValue('penguinshop-dev');
    const ecrRepo = ecr.Repository.fromRepositoryAttributes(this, 'EcrRepo', {
      repositoryName: importedRepoName,
      repositoryArn: `arn:aws:ecr:us-east-1:400017207288:repository/penguinshop-dev`,
    });

    // Lookup default VPC (or replace with custom VPC if needed)
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // Define CodePipeline artifacts
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    // CodeBuild project for Docker build
    const project = new codebuild.PipelineProject(this, 'DockerBuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true, // needed for Docker
      },
    });

    // Add explicit ECR permissions in case grantPullPush is insufficient
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

    // Grant CodeBuild permission to push to ECR
    ecrRepo.grantPullPush(project);

    // Define pipeline
    const pipeline = new codepipeline.Pipeline(this, 'PenguinshopPipeline', {
      pipelineName: 'penguinshop-cascade-pipeline',
      crossAccountKeys: true,
    });

    // === Source Stage (GitHub) ===
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.GitHubSourceAction({
          actionName: 'GitHub_Source',
          owner: 'misterpoloy', // replace
          repo: 'penguinshop',
          oauthToken: githubSecret.secretValue,
          output: sourceOutput,
          branch: 'main',
        }),
      ],
    });

    // === Build Stage (CodeBuild) ===
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

    // === Deploy Stages ===
    const envs = ['dev', 'qa', 'prod'];
    envs.forEach((env) => {
        const ecsService = ecs.FargateService.fromFargateServiceAttributes(this, `EcsService-${env}`, {
          serviceArn: `arn:aws:ecs:${region}:${account}:service/penguinshop-cluster-${env}/PenguinshopStack-${env}-PenguinshopServicedevService73CD6742-Om918T7ddBHE`,
          cluster: ecs.Cluster.fromClusterAttributes(this, `Cluster-${env}`, {
            clusterName: `penguinshop-cluster-${env}`,
            vpc: vpc,
          }),
        });

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
