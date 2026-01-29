export interface ConfigOptions {
  awsRegion?: string;
  accountId?: string;
  s3BucketName?: string;
  vectorIndexName?: string;
  stateMachineArn?: string;
  pollyVoiceId?: string;
}

export class Config {
  readonly awsRegion: string;
  readonly accountId: string;
  readonly s3BucketName: string;
  readonly vectorIndexName: string;
  readonly stateMachineArn: string;
  readonly pollyVoiceId: string;

  constructor(options: ConfigOptions = {}) {
    this.awsRegion = options.awsRegion ?? process.env.AWS_REGION ?? 'us-east-1';
    this.accountId = options.accountId ?? process.env.AWS_ACCOUNT_ID ?? '';
    this.s3BucketName = options.s3BucketName ?? process.env.S3_BUCKET_NAME ?? '';
    this.vectorIndexName = options.vectorIndexName ?? process.env.VECTOR_INDEX ?? '';
    this.stateMachineArn = options.stateMachineArn ?? process.env.STATE_MACHINE_ARN ?? '';
    this.pollyVoiceId = options.pollyVoiceId ?? process.env.POLLY_VOICE_ID ?? 'Joanna';
  }

  getMarengoModelId(): string {
    return 'twelvelabs.marengo-embed-3-0-v1:0';
  }

  getPegasusModelId(): string {
    return 'global.twelvelabs.pegasus-1-2-v1:0';
  }

  getNovaModelId(): string {
    return 'us.amazon.nova-pro-v1:0';
  }
}
