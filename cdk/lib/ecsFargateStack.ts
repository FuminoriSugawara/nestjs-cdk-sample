import {
  App,
  Aws,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_logs as log,
  Stack,
  StackProps
} from "aws-cdk-lib";
import { DockerImageName, ECRDeployment } from "cdk-ecr-deployment";
import { resolve } from "path";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { FargateService } from "aws-cdk-lib/aws-ecs";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";

export interface EcsFargateStackProps extends StackProps {
  vpc: ec2.Vpc;
  projectName: string;
  repository: Repository;
  targetGroup: elbv2.ApplicationTargetGroup;
  listener: elbv2.ApplicationListener;
  alb: elbv2.ApplicationLoadBalancer;
}

export class EcsFargateStack extends Stack {
  public readonly service: FargateService;
  constructor(scope: App, id: string, props: EcsFargateStackProps) {
    super(scope, id, props);
    const imageTag = process.env.IMAGE_TAG;
    const vpc = props.vpc;

    // SecurityGroup

    const securityGroupApp = new ec2.SecurityGroup(this, 'SecurityGroupApp', {
      vpc,
      securityGroupName: 'CdkSecurityGroupApp',
    });
    securityGroupApp.connections.allowFrom(props.alb, ec2.Port.tcp(3000));

    // ECR
    const repository = Repository.fromRepositoryName(
      this,
      'EcrRepository',
      props.repository.repositoryName,
    );

    // Docker Image
    const imageAsset = new DockerImageAsset(this, 'DockerImageAsset', {
      directory: resolve(__dirname, '../..'),
      platform: Platform.LINUX_AMD64,
      target: 'production',
    });
    // Push Docker Image to ECR
    new ECRDeployment(this, 'DeployDockerImage', {
      src: new DockerImageName(imageAsset.imageUri),
      dest: new DockerImageName(
        `${Aws.ACCOUNT_ID}.dkr.ecr.${Aws.REGION}.amazonaws.com/${repository.repositoryName}:${imageTag}`,
      ),
    });

    const image = ecs.ContainerImage.fromEcrRepository(repository, imageTag);

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: props.projectName + 'Cluster',
      containerInsights: true,
    });

    // Fargate Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
    });
    // Container
    const container = taskDefinition.addContainer('AppContainer', {
      image,
      containerName: props.projectName + 'AppContainer',
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'NestApp',
        logRetention: log.RetentionDays.ONE_MONTH,
      }),
      environment: {
        IMAGE_TAG: process.env.IMAGE_TAG!,
      },
    });
    container.addPortMappings({
      containerPort: 3000,
      hostPort: 3000,
    });
    // Fargate Service
    const service = new ecs.FargateService(this, 'Service', {
      serviceName: props.projectName + 'Service',
      cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      securityGroups: [securityGroupApp],
      deploymentController: {
        type: ecs.DeploymentControllerType.CODE_DEPLOY,
      },
    });
    // Add Service to ALB Target group
    props.targetGroup.addTarget(service);
  }
}
