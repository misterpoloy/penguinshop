import { ELBv2 } from 'aws-sdk';

const elbv2 = new ELBv2();

export const handler = async (event: any) => {
  const listenerArn = process.env.LISTENER_ARN!;
  const blueTargetGroupArn = process.env.BLUE_TG_ARN!;
  const greenTargetGroupArn = process.env.GREEN_TG_ARN!;

  console.log('Shifting traffic...');
  
  // Example: 50% blue, 50% green
  const params = {
    ListenerArn: listenerArn,
    DefaultActions: [
      {
        Type: 'forward',
        ForwardConfig: {
          TargetGroups: [
            { TargetGroupArn: blueTargetGroupArn, Weight: 50 },
            { TargetGroupArn: greenTargetGroupArn, Weight: 50 },
          ],
        },
      },
    ],
  };

  await elbv2.modifyListener(params).promise();

  console.log('Traffic shifted successfully!');
};
