resource "aws_apigatewayv2_api" "video_pipeline" {
  count         = var.enable_api_gateway ? 1 : 0
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "GET", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "x-twelvelabs-key", "x-gemini-key", "x-elevenlabs-key"]
    max_age       = 300
  }

  tags = {
    Name = "${local.name_prefix}-api"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  count       = var.enable_api_gateway ? 1 : 0
  api_id      = aws_apigatewayv2_api.video_pipeline[0].id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs[0].arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      responseLength   = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  tags = {
    Name = "${local.name_prefix}-api-default-stage"
  }
}

resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  count             = var.enable_api_gateway ? 1 : 0
  name              = "/aws/apigateway/${local.name_prefix}"
  retention_in_days = 14

  tags = {
    Name = "${local.name_prefix}-api-logs"
  }
}

resource "aws_lambda_function" "api_get_presigned_url" {
  count            = var.enable_api_gateway ? 1 : 0
  function_name    = "${local.name_prefix}-api-presigned-url"
  runtime          = "nodejs20.x"
  handler          = "handlers/api/getPresignedUrl.handler"
  timeout          = 30
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
    Name = "${local.name_prefix}-api-presigned-url"
  }
}

resource "aws_lambda_function" "api_confirm_upload" {
  count            = var.enable_api_gateway ? 1 : 0
  function_name    = "${local.name_prefix}-api-confirm-upload"
  runtime          = "nodejs20.x"
  handler          = "handlers/api/confirmUpload.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  environment {
    variables = {
      S3_BUCKET_NAME = aws_s3_bucket.video.id
      VIDEOS_TABLE   = aws_dynamodb_table.videos.name
    }
  }

  tags = {
    Name = "${local.name_prefix}-api-confirm-upload"
  }
}

resource "aws_lambda_function" "api_list_videos" {
  count            = var.enable_api_gateway ? 1 : 0
  function_name    = "${local.name_prefix}-api-list-videos"
  runtime          = "nodejs20.x"
  handler          = "handlers/api/listVideos.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  environment {
    variables = {
      VIDEOS_TABLE = aws_dynamodb_table.videos.name
    }
  }

  tags = {
    Name = "${local.name_prefix}-api-list-videos"
  }
}

resource "aws_lambda_function" "api_get_video" {
  count            = var.enable_api_gateway ? 1 : 0
  function_name    = "${local.name_prefix}-api-get-video"
  runtime          = "nodejs20.x"
  handler          = "handlers/api/getVideo.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  environment {
    variables = {
      VIDEOS_TABLE = aws_dynamodb_table.videos.name
    }
  }

  tags = {
    Name = "${local.name_prefix}-api-get-video"
  }
}

resource "aws_lambda_function" "api_start_pipeline" {
  count            = var.enable_api_gateway ? 1 : 0
  function_name    = "${local.name_prefix}-api-start-pipeline"
  runtime          = "nodejs20.x"
  handler          = "handlers/api/startPipeline.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  environment {
    variables = {
      STATE_MACHINE_ARN = aws_sfn_state_machine.video_pipeline.arn
      S3_BUCKET_NAME    = aws_s3_bucket.video.id
      VIDEOS_TABLE      = aws_dynamodb_table.videos.name
    }
  }

  tags = {
    Name = "${local.name_prefix}-api-start-pipeline"
  }
}

resource "aws_lambda_function" "api_get_pipeline_status" {
  count            = var.enable_api_gateway ? 1 : 0
  function_name    = "${local.name_prefix}-api-pipeline-status"
  runtime          = "nodejs20.x"
  handler          = "handlers/api/getPipelineStatus.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  environment {
    variables = {
      STATE_MACHINE_ARN = aws_sfn_state_machine.video_pipeline.arn
    }
  }

  tags = {
    Name = "${local.name_prefix}-api-pipeline-status"
  }
}

resource "aws_lambda_function" "api_list_voices" {
  count            = var.enable_api_gateway ? 1 : 0
  function_name    = "${local.name_prefix}-api-list-voices"
  runtime          = "nodejs20.x"
  handler          = "handlers/api/listVoices.handler"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  tags = {
    Name = "${local.name_prefix}-api-list-voices"
  }
}

resource "aws_lambda_function" "api_get_output_video" {
  count            = var.enable_api_gateway ? 1 : 0
  function_name    = "${local.name_prefix}-api-get-output-video"
  runtime          = "nodejs20.x"
  handler          = "handlers/api/getOutputVideo.handler"
  timeout          = 30
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
    Name = "${local.name_prefix}-api-get-output-video"
  }
}

resource "aws_lambda_function" "api_get_insights" {
  count            = var.enable_api_gateway ? 1 : 0
  function_name    = "${local.name_prefix}-api-get-insights"
  runtime          = "nodejs20.x"
  handler          = "handlers/api/getInsights.handler"
  timeout          = 60
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  role             = aws_iam_role.lambda.arn

  tags = {
    Name = "${local.name_prefix}-api-get-insights"
  }
}

resource "aws_apigatewayv2_integration" "get_presigned_url" {
  count              = var.enable_api_gateway ? 1 : 0
  api_id             = aws_apigatewayv2_api.video_pipeline[0].id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_get_presigned_url[0].invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "confirm_upload" {
  count              = var.enable_api_gateway ? 1 : 0
  api_id             = aws_apigatewayv2_api.video_pipeline[0].id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_confirm_upload[0].invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "list_videos" {
  count              = var.enable_api_gateway ? 1 : 0
  api_id             = aws_apigatewayv2_api.video_pipeline[0].id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_list_videos[0].invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "get_video" {
  count              = var.enable_api_gateway ? 1 : 0
  api_id             = aws_apigatewayv2_api.video_pipeline[0].id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_get_video[0].invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "start_pipeline" {
  count              = var.enable_api_gateway ? 1 : 0
  api_id             = aws_apigatewayv2_api.video_pipeline[0].id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_start_pipeline[0].invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "get_pipeline_status" {
  count              = var.enable_api_gateway ? 1 : 0
  api_id             = aws_apigatewayv2_api.video_pipeline[0].id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_get_pipeline_status[0].invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "list_voices" {
  count              = var.enable_api_gateway ? 1 : 0
  api_id             = aws_apigatewayv2_api.video_pipeline[0].id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_list_voices[0].invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "get_output_video" {
  count              = var.enable_api_gateway ? 1 : 0
  api_id             = aws_apigatewayv2_api.video_pipeline[0].id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_get_output_video[0].invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "get_insights" {
  count              = var.enable_api_gateway ? 1 : 0
  api_id             = aws_apigatewayv2_api.video_pipeline[0].id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_get_insights[0].invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "get_presigned_url" {
  count     = var.enable_api_gateway ? 1 : 0
  api_id    = aws_apigatewayv2_api.video_pipeline[0].id
  route_key = "POST /upload/presigned"
  target    = "integrations/${aws_apigatewayv2_integration.get_presigned_url[0].id}"
}

resource "aws_apigatewayv2_route" "confirm_upload" {
  count     = var.enable_api_gateway ? 1 : 0
  api_id    = aws_apigatewayv2_api.video_pipeline[0].id
  route_key = "POST /upload/confirm"
  target    = "integrations/${aws_apigatewayv2_integration.confirm_upload[0].id}"
}

resource "aws_apigatewayv2_route" "list_videos" {
  count     = var.enable_api_gateway ? 1 : 0
  api_id    = aws_apigatewayv2_api.video_pipeline[0].id
  route_key = "GET /videos"
  target    = "integrations/${aws_apigatewayv2_integration.list_videos[0].id}"
}

resource "aws_apigatewayv2_route" "get_video" {
  count     = var.enable_api_gateway ? 1 : 0
  api_id    = aws_apigatewayv2_api.video_pipeline[0].id
  route_key = "GET /videos/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.get_video[0].id}"
}

resource "aws_apigatewayv2_route" "start_pipeline" {
  count     = var.enable_api_gateway ? 1 : 0
  api_id    = aws_apigatewayv2_api.video_pipeline[0].id
  route_key = "POST /pipeline/start"
  target    = "integrations/${aws_apigatewayv2_integration.start_pipeline[0].id}"
}

resource "aws_apigatewayv2_route" "get_pipeline_status" {
  count     = var.enable_api_gateway ? 1 : 0
  api_id    = aws_apigatewayv2_api.video_pipeline[0].id
  route_key = "GET /pipeline/status/{executionId}"
  target    = "integrations/${aws_apigatewayv2_integration.get_pipeline_status[0].id}"
}

resource "aws_apigatewayv2_route" "list_voices" {
  count     = var.enable_api_gateway ? 1 : 0
  api_id    = aws_apigatewayv2_api.video_pipeline[0].id
  route_key = "GET /voices"
  target    = "integrations/${aws_apigatewayv2_integration.list_voices[0].id}"
}

resource "aws_apigatewayv2_route" "get_output_video" {
  count     = var.enable_api_gateway ? 1 : 0
  api_id    = aws_apigatewayv2_api.video_pipeline[0].id
  route_key = "GET /output/{videoId}"
  target    = "integrations/${aws_apigatewayv2_integration.get_output_video[0].id}"
}

resource "aws_apigatewayv2_route" "get_insights" {
  count     = var.enable_api_gateway ? 1 : 0
  api_id    = aws_apigatewayv2_api.video_pipeline[0].id
  route_key = "POST /insights"
  target    = "integrations/${aws_apigatewayv2_integration.get_insights[0].id}"
}

resource "aws_lambda_permission" "api_get_presigned_url" {
  count         = var.enable_api_gateway ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_get_presigned_url[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline[0].execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_confirm_upload" {
  count         = var.enable_api_gateway ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_confirm_upload[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline[0].execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_list_videos" {
  count         = var.enable_api_gateway ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_list_videos[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline[0].execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_get_video" {
  count         = var.enable_api_gateway ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_get_video[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline[0].execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_start_pipeline" {
  count         = var.enable_api_gateway ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_start_pipeline[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline[0].execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_get_pipeline_status" {
  count         = var.enable_api_gateway ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_get_pipeline_status[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline[0].execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_list_voices" {
  count         = var.enable_api_gateway ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_list_voices[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline[0].execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_get_output_video" {
  count         = var.enable_api_gateway ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_get_output_video[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline[0].execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_get_insights" {
  count         = var.enable_api_gateway ? 1 : 0
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_get_insights[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline[0].execution_arn}/*/*"
}
