data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/dist"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "start_marengo" {
  function_name    = "${local.name_prefix}-start-marengo"
  runtime          = "nodejs20.x"
  handler          = "handlers/startMarengo/index.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  environment {
    variables = {
      AWS_ACCOUNT_ID   = local.account_id
      S3_BUCKET_NAME   = aws_s3_bucket.video.id
      VECTOR_INDEX     = local.vector_index_name
      TASK_TOKEN_TABLE = aws_dynamodb_table.task_tokens.name
    }
  }

  tags = {
    Name = "${local.name_prefix}-start-marengo"
  }
}

resource "aws_lambda_function" "marengo_callback" {
  function_name    = "${local.name_prefix}-marengo-callback"
  runtime          = "nodejs20.x"
  handler          = "handlers/marengoCallback/index.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  environment {
    variables = {
      STATE_MACHINE_ARN = aws_sfn_state_machine.video_pipeline.arn
      TASK_TOKEN_TABLE  = aws_dynamodb_table.task_tokens.name
      S3_BUCKET_NAME    = aws_s3_bucket.video.id
    }
  }

  tags = {
    Name = "${local.name_prefix}-marengo-callback"
  }
}

resource "aws_lambda_function" "store_embeddings" {
  function_name    = "${local.name_prefix}-store-embeddings"
  runtime          = "nodejs20.x"
  handler          = "handlers/storeEmbeddings/index.handler"
  timeout          = 60
  memory_size      = 512
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  environment {
    variables = {
      AWS_ACCOUNT_ID = local.account_id
      S3_BUCKET_NAME = aws_s3_bucket.video.id
      VECTOR_INDEX   = local.vector_index_name
    }
  }

  tags = {
    Name = "${local.name_prefix}-store-embeddings"
  }
}

resource "aws_lambda_function" "start_pegasus_analysis" {
  function_name    = "${local.name_prefix}-start-pegasus-analysis"
  runtime          = "nodejs20.x"
  handler          = "handlers/startPegasusAnalysis/index.handler"
  timeout          = 120
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  environment {
    variables = {
      AWS_ACCOUNT_ID   = local.account_id
      S3_BUCKET_NAME   = aws_s3_bucket.video.id
      TASK_TOKEN_TABLE = aws_dynamodb_table.task_tokens.name
    }
  }

  tags = {
    Name = "${local.name_prefix}-start-pegasus-analysis"
  }
}

resource "aws_lambda_function" "select_segments" {
  function_name    = "${local.name_prefix}-select-segments"
  runtime          = "nodejs20.x"
  handler          = "handlers/selectSegments/index.handler"
  timeout          = 60
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  environment {
    variables = {
      AWS_ACCOUNT_ID = local.account_id
    }
  }

  tags = {
    Name = "${local.name_prefix}-select-segments"
  }
}

resource "aws_lambda_function" "start_pegasus_voiceover" {
  function_name    = "${local.name_prefix}-start-pegasus-voiceover"
  runtime          = "nodejs20.x"
  handler          = "handlers/startPegasusVoiceover/index.handler"
  timeout          = 120
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  environment {
    variables = {
      AWS_ACCOUNT_ID   = local.account_id
      S3_BUCKET_NAME   = aws_s3_bucket.video.id
      TASK_TOKEN_TABLE = aws_dynamodb_table.task_tokens.name
    }
  }

  tags = {
    Name = "${local.name_prefix}-start-pegasus-voiceover"
  }
}

resource "aws_lambda_function" "synthesize_audio" {
  function_name    = "${local.name_prefix}-synthesize-audio"
  runtime          = "nodejs20.x"
  handler          = "handlers/synthesizeAudio/index.handler"
  timeout          = 60
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  environment {
    variables = {
      S3_BUCKET_NAME = aws_s3_bucket.video.id
    }
  }

  tags = {
    Name = "${local.name_prefix}-synthesize-audio"
  }
}

resource "aws_lambda_function" "process_video" {
  function_name    = "${local.name_prefix}-process-video"
  runtime          = "nodejs20.x"
  handler          = "handlers/processVideo/index.handler"
  timeout          = 900
  memory_size      = 3008
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  layers = [local.ffmpeg_layer_arn]

  environment {
    variables = {
      S3_BUCKET_NAME = aws_s3_bucket.video.id
      VECTOR_INDEX   = local.vector_index_name
    }
  }

  tags = {
    Name = "${local.name_prefix}-process-video"
  }
}

resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = toset([
    aws_lambda_function.start_marengo.function_name,
    aws_lambda_function.start_pegasus_analysis.function_name,
    aws_lambda_function.start_pegasus_voiceover.function_name,
    aws_lambda_function.marengo_callback.function_name,
    aws_lambda_function.store_embeddings.function_name,
    aws_lambda_function.select_segments.function_name,
    aws_lambda_function.synthesize_audio.function_name,
    aws_lambda_function.process_video.function_name,
  ])

  name              = "/aws/lambda/${each.value}"
  retention_in_days = 14

  tags = {
    Name = "${each.value}-logs"
  }
}
