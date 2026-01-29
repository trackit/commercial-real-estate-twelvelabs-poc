resource "aws_s3_bucket" "video" {
  bucket = "${local.name_prefix}-${local.account_id}"

  tags = {
    Name = "${local.name_prefix}-video"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "video" {
  bucket = aws_s3_bucket.video.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "video" {
  bucket = aws_s3_bucket.video.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "video" {
  bucket = aws_s3_bucket.video.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "video" {
  bucket = aws_s3_bucket.video.id

  rule {
    id     = "cleanup-temp-files"
    status = "Enabled"

    filter {
      prefix = "temp/"
    }

    expiration {
      days = 1
    }
  }

  rule {
    id     = "transition-old-videos"
    status = "Enabled"

    filter {
      prefix = "output/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_policy" "video_bedrock_access" {
  bucket = aws_s3_bucket.video.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowBedrockServiceAccess"
        Effect    = "Allow"
        Principal = { Service = "bedrock.amazonaws.com" }
        Action    = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.video.arn,
          "${aws_s3_bucket.video.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_s3_bucket_notification" "video_eventbridge" {
  bucket      = aws_s3_bucket.video.id
  eventbridge = true
}
