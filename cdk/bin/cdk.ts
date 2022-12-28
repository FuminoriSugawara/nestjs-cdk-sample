#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { EcsFargateStack } from "../lib/ecsFargateStack";
import { SharedInfraStack } from "../lib/sharedInfraStack";
import { config } from "dotenv";
import { CloudFrontStack } from "../lib/cloudFrontStack";
import { WebAclStack } from "../lib/webAclStack";
import { RemoteOutputStack } from "../lib/remoteOutputStack";
import { existsSync } from "fs";

const envFile = "../.env";
if (existsSync(envFile)) {
  config({
    path: envFile,
  });
}
const app = new cdk.App();
const projectName = "NestJSCDKSample";

// VPC, ECR
const infra = new SharedInfraStack(app, projectName + "CdkSharedInfraStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  projectName,
});

// WebACL on us-east-1
const webAcl = new WebAclStack(app, projectName + "WebAcl", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
});

// Outputs for cross region references
new cdk.CfnOutput(webAcl, "WebAclArn", { value: webAcl.webAclArn });
const remoteOutput = new RemoteOutputStack(app, projectName + "RemoteOutput", {
  webAcl,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

// CloudFront, ALB, Route53
const cloudFrontStack = new CloudFrontStack(
  app,
  projectName + "CdkCloudFrontStack",
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
    domainName: process.env.DOMAIN_NAME!,
    hostedZoneDomainName: process.env.HOSTED_ZONE_DOMAIN_NAME!,
    vpc: infra.vpc,
    projectName,
    webAclArn: remoteOutput.webAclArn,
  }
);

// ECS
new EcsFargateStack(app, projectName + "CdkFargateStack", {
  targetGroup: cloudFrontStack.targetGroup,
  listener: cloudFrontStack.listener,

  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  vpc: infra.vpc,
  projectName,
  repository: infra.repository,
  alb: cloudFrontStack.alb,
});
