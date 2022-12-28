import {
  App,
  aws_ec2 as ec2,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import { Repository } from 'aws-cdk-lib/aws-ecr';

const pascalCaseToKebabCase = (string: string) => {
  return string.replace(/([a-z0–9])([A-Z])/g, '$1-$2').toLowerCase();
};

export interface SharedInfraStackProps extends StackProps {
  projectName: string;
}

export class SharedInfraStack extends Stack {
  public readonly vpc: ec2.Vpc;
  public readonly repository: Repository;
  constructor(scope: App, id: string, props?: SharedInfraStackProps) {
    super(scope, id, props);
    const repositoryName = pascalCaseToKebabCase(
      props!.projectName + 'Repository',
    );
    this.vpc = new ec2.Vpc(this, 'VPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.1.0.0/16'),
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateIsolatedSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
    this.repository = new Repository(this, 'EcrRepository', {
      repositoryName,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
