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

    // ✅ Contexto y datos de cuenta/región
    const account = process.env.AWS_ACCOUNT_ID || cdk.Stack.of(this).account;
    const region = process.env.AWS_REGION || cdk.Stack.of(this).region;

    // ✅ Ambiente dinámico desde `-c env=<valor>` (default 'dev')
    const env = this.node.tryGetContext('env') || 'dev';

    // ✅ Nombre dinámico del repositorio ECR (ej. penguinshop-jportiz)
    const repoName = `penguinshop-${env}`;

    // ✅ Referencia al repo ECR por nombre (debe existir previamente)
    const ecrRepo = ecr.Repository.fromRepositoryName(this, 'EcrRepo', repoName);

    // ✅ Red de VPC (default)
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // ✅ Artefactos de Pipeline
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    // ✅ Proyecto de CodeBuild para construir la imagen
    const project = new codebuild.PipelineProject(this, 'DockerBuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true, // necesario para Docker
      },
    });

    // 🔐 Autenticación a ECR: el token SIEMPRE debe ser resource "*"
    project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    );

    // 🔐 Permisos de push/pull al repo dinámico correcto
    ecrRepo.grantPullPush(project);

    // ✅ Pipeline
    const pipeline = new codepipeline.Pipeline(this, 'PenguinshopPipeline', {
      pipelineName: `penguinshop-cascade-pipeline-${env}`,
      crossAccountKeys: true,
    });

    // ✅ Source (GitHub con webhook)
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.GitHubSourceAction({
          actionName: 'GitHub_Source',
          owner: 'misterpoloy', // #replace si aplica
          repo: 'penguinshop',
          oauthToken: cdk.SecretValue.unsafePlainText(githubToken!),
          output: sourceOutput,
          branch: 'main',
          trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
        }),
      ],
    });

    // ✅ Build
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Docker_Build',
          project,
          input: sourceOutput,
          outputs: [buildOutput],
          // Pasamos variables al buildspec para login/tag/push
          environmentVariables: {
            REPO: { value: repoName },
            ACCOUNT: { value: account },
            AWS_DEFAULT_REGION: { value: region },
          },
        }),
      ],
    });

    // ✅ (Opcional) Aprobación manual en prod
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

    // ✅ Importación de ECS Service/Cluster por ambiente (usa nombres consistentes)
    const serviceName = cdk.Fn.importValue(`penguinshop-service-name-${env}`);

    const cluster = ecs.Cluster.fromClusterAttributes(this, `Cluster-${env}`, {
      clusterName: `penguinshop-cluster-${env}`,
      vpc,
    });

    const ecsService = ecs.FargateService.fromFargateServiceAttributes(
      this,
      `EcsService-${env}`,
      {
        serviceName,
        cluster,
      }
    );

    // ✅ Lambda de traffic shifting (rellena los ARN reales antes de deploy)
    const trafficShiftLambda = new PenguinshopTrafficShiftLambda(this, `TrafficShift-${env}`, {
      listenerArn: 'arn:aws:elasticloadbalancing:...', // TODO: listener ARN real
      blueTargetGroupArn: 'arn:aws:elasticloadbalancing:...', // TODO
      greenTargetGroupArn: 'arn:aws:elasticloadbalancing:...', // TODO
    });

    // ✅ Deploy a ECS con imagedefinitions.json producido por build
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

    cdk.Tags.of(this).add('Workshop', 'PenguinShop');
  }
}