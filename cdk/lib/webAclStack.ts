import { App, aws_wafv2 as wafv2, Stack, StackProps } from 'aws-cdk-lib';

export interface WebAclStackProps extends StackProps {
  allowedAddresses: string[];
}
export class WebAclStack extends Stack {
  public readonly webAclArn: string;

  constructor(scope: App, id: string, props: WebAclStackProps) {
    super(scope, id, props);

    const allowedListIPSet = new wafv2.CfnIPSet(this, 'AllowedListIPSet', {
      name: 'AllowedListIPSet',
      addresses: props.allowedAddresses,
      ipAddressVersion: 'IPV4',
      scope: 'CLOUDFRONT',
    });

    const allowedListIPSetRuleProperty: wafv2.CfnWebACL.RuleProperty = {
      priority: 1,
      name: 'AllowedIPSetRule',
      action: {
        allow: {},
      },
      statement: {
        ipSetReferenceStatement: {
          arn: allowedListIPSet.attrArn,
        },
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'AllowedListIPSetRule',
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
        allowedListIPSetRuleProperty,
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
