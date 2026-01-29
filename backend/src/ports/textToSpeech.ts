export interface TextToSpeechOptions {
  voiceId?: string;
  speed?: number;
  outputFormat?: 'mp3' | 'ogg_vorbis' | 'pcm';
}

export interface TextToSpeech {
  synthesize(
    text: string,
    outputS3Uri: string,
    options?: TextToSpeechOptions,
  ): Promise<string>;
}
