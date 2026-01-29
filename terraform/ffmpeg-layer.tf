resource "aws_lambda_layer_version" "ffmpeg" {
  layer_name          = "${local.name_prefix}-ffmpeg"
  description         = "FFmpeg with drawtext filter for video processing"
  compatible_runtimes = ["nodejs18.x", "nodejs20.x"]

  s3_bucket         = aws_s3_bucket.video.id
  s3_key            = "layers/ffmpeg-layer.zip"
  source_code_hash  = filebase64sha256("${path.module}/layers/ffmpeg-layer.zip")

  depends_on = [aws_s3_object.ffmpeg_layer]
}

resource "aws_s3_object" "ffmpeg_layer" {
  bucket = aws_s3_bucket.video.id
  key    = "layers/ffmpeg-layer.zip"
  source = "${path.module}/layers/ffmpeg-layer.zip"
  etag   = filemd5("${path.module}/layers/ffmpeg-layer.zip")
}

locals {
  ffmpeg_layer_arn = aws_lambda_layer_version.ffmpeg.arn
}
