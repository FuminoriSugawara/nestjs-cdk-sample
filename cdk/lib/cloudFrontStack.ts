import {
  App,
  aws_certificatemanager as acm,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_route53 as route53,
  aws_route53_targets as route53Targets,
  Duration,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import {
  CachePolicy,
  Distribution,
  OriginRequestPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { LoadBalancerV2Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { ListenerAction } from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export interface CloudFrontStackProps extends StackProps {
  projectName: string;
  hostedZoneDomainName: string;
  domainName: string;
  vpc: ec2.Vpc;
  webAclArn: string;
}

export class CloudFrontStack extends Stack {
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  public readonly listener: elbv2.ApplicationListener;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  constructor(scope: App, id: string, props: CloudFrontStackProps) {
    super(scope, id, props);
    const { vpc, domainName, hostedZoneDomainName } = props;
    const fromCloudFrontHeaderValue = 'mTHSv8UU1aFwFJSoXi6KgYbdWLSnKOdSe5tz';
    const fromCloudFrontHeaderKey = 'X-From-CloudFront';
    const securityGroupELB = new ec2.SecurityGroup(this, 'SecurityGroupELB', {
      vpc,
    });
    securityGroupELB.addIngressRule(
      ec2.Peer.ipv4('0.0.0.0/0'),
      ec2.Port.tcp(443),
    );

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: hostedZoneDomainName,
    });

    const certCloudFront = new acm.DnsValidatedCertificate(
      this,
      'CertificateCloudFront',
      {
        domainName: `${domainName}`,
        hostedZone,
        region: 'us-east-1',
      },
    );
    const certAlb = new acm.DnsValidatedCertificate(this, 'CertificateAlb', {
      domainName: `${domainName}`,
      hostedZone,
      region: 'ap-northeast-1',
    });

    // ALB

    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      securityGroup: securityGroupELB,
      internetFacing: true,
      loadBalancerName: props.projectName + 'Alb',
    });
    this.alb = alb;

    this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc: vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
      },
    });
    this.listener = alb.addListener('ListenerHTTP', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      open: true,
      certificates: [
        {
          certificateArn: certAlb.certificateArn,
        },
      ],
      defaultAction: ListenerAction.fixedResponse(404),
    });
    this.listener.addTargetGroups('ListenerTarget', {
      priority: 1,
      targetGroups: [this.targetGroup],
      conditions: [
        elbv2.ListenerCondition.httpHeader(fromCloudFrontHeaderKey, [
          fromCloudFrontHeaderValue,
        ]),
      ],
    });

    // CloudFront
    const cloudFront = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new LoadBalancerV2Origin(alb, {
          customHeaders: {
            [fromCloudFrontHeaderKey]: fromCloudFrontHeaderValue,
          },
        }),
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
      },
      certificate: certCloudFront,
      domainNames: [domainName],
      webAclId: props.webAclArn,
    });

    new route53.ARecord(this, `AliasRecordProd`, {
      zone: hostedZone,
      recordName: `${domainName}`,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(cloudFront),
      ),
      ttl: Duration.seconds(300),
    });
  }
}
