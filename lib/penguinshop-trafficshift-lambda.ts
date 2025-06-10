import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class PenguinshopTrafficShiftLambda extends Construct {
  public readonly lambdaFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: {
    listenerArn: string;
    blueTargetGroupArn: string;
    greenTargetGroupArn: string;
  }) {
    super(scope, id);

    this.lambdaFunction = new lambda.Function(this, 'TrafficShiftLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/traffic-shift')),
      environment: {
        LISTENER_ARN: props.listenerArn,
        BLUE_TG_ARN: props.blueTargetGroupArn,
        GREEN_TG_ARN: props.greenTargetGroupArn,
      },
    });

    // Grant permissions to modify the ALB listener
    this.lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['elasticloadbalancing:ModifyListener', 'elasticloadbalancing:DescribeListeners'],
      resources: ['*'],
    }));
  }
}
