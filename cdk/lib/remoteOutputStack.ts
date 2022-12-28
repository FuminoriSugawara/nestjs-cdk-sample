import { App, Stack, StackProps } from 'aws-cdk-lib';
import { RemoteOutputs } from 'cdk-remote-stack';

export interface RemoteOutputStackProps extends StackProps {
  webAcl: any;
}

export class RemoteOutputStack extends Stack {
  public readonly webAclArn: string;

  constructor(scope: App, id: string, props: RemoteOutputStackProps) {
    super(scope, id, props);

    this.addDependency(props.webAcl);
    const outputs = new RemoteOutputs(this, 'Outputs', { stack: props.webAcl });
    const webAclArn = outputs.get('WebAclArn');

    this.webAclArn = webAclArn;
  }
}
