import { Stack, App, StackProps, aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import { CfnIPSet } from 'aws-cdk-lib/aws-wafv2';

export class WebAclStack extends Stack {
  public readonly webAclArn: string;

  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const whiteListIPSet = new wafv2.CfnIPSet(this, 'WhiteListIPSet', {
      name: 'WhiteListIPSet',
      addresses: ['109.236.7.68/32'],
      ipAddressVersion: 'IPV4',
      scope: 'CLOUDFRONT',
    });

    const whiteListIPSetRuleProperty: wafv2.CfnWebACL.RuleProperty = {
      priority: 1,
      name: 'WhiteListIPSetRule',
      action: {
        allow: {},
      },
      statement: {
        ipSetReferenceStatement: {
          arn: whiteListIPSet.attrArn,
        },
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'WhiteListIPSetRule',
        sampledRequestsEnabled: true,
      },
    };

    const acl = new wafv2.CfnWebACL(this, 'CommonAcl', {
      defaultAction: {
        block: {},
      },
      description: 'CommonAcl',
      name: 'CommonAcl',
      rules: [
        {
          name: 'AWSCommonRule',
          priority: 0,
          overrideAction: {
            none: {},
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RuleWithAWSManagedRulesMetric',
          },
          statement: {
            managedRuleGroupStatement: {
              excludedRules: [],
              name: 'AWSManagedRulesCommonRuleSet',
              vendorName: 'AWS',
            },
          },
        },
        whiteListIPSetRuleProperty,
      ],
      scope: 'CLOUDFRONT',
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'CommonAclMetric',
      },
    });

    this.webAclArn = acl.attrArn;
  }
}
