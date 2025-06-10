#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PenguinshopStack } from '../lib/penguinshop-stack';
import { PenguinshopPipelineStack } from '../lib/penguinshop-pipeline-stack';
import * as dotenv from 'dotenv';

// Load .env if running locally
dotenv.config();

const app = new cdk.App();
const env = app.node.tryGetContext('env') || 'dev';

// Prefer explicit environment variables; fallback to CDK defaults
const account = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION;

new PenguinshopStack(app, `PenguinshopStack-${env}`, {
  env: { account, region },
});

new PenguinshopPipelineStack(app, `PenguinshopPipelineStack-${env}`, {
  env: { account, region },
});
