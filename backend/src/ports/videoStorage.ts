export interface VideoStorage {
  downloadVideo(s3Uri: string, localPath: string): Promise<void>;
  putObject(
    bucket: string,
    key: string,
    data: Buffer,
    contentType?: string,
  ): Promise<string>;
}
