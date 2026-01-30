resource "aws_apigatewayv2_api" "video_pipeline" {
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
  api_id      = aws_apigatewayv2_api.video_pipeline.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
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
  name              = "/aws/apigateway/${local.name_prefix}"
  retention_in_days = 14

  tags = {
    Name = "${local.name_prefix}-api-logs"
  }
}

resource "aws_lambda_function" "api_get_presigned_url" {
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
  api_id             = aws_apigatewayv2_api.video_pipeline.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_get_presigned_url.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "confirm_upload" {
  api_id             = aws_apigatewayv2_api.video_pipeline.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_confirm_upload.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "list_videos" {
  api_id             = aws_apigatewayv2_api.video_pipeline.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_list_videos.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "get_video" {
  api_id             = aws_apigatewayv2_api.video_pipeline.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_get_video.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "start_pipeline" {
  api_id             = aws_apigatewayv2_api.video_pipeline.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_start_pipeline.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "get_pipeline_status" {
  api_id             = aws_apigatewayv2_api.video_pipeline.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_get_pipeline_status.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "list_voices" {
  api_id             = aws_apigatewayv2_api.video_pipeline.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_list_voices.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "get_output_video" {
  api_id             = aws_apigatewayv2_api.video_pipeline.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_get_output_video.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "get_insights" {
  api_id             = aws_apigatewayv2_api.video_pipeline.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api_get_insights.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "get_presigned_url" {
  api_id    = aws_apigatewayv2_api.video_pipeline.id
  route_key = "POST /upload/presigned"
  target    = "integrations/${aws_apigatewayv2_integration.get_presigned_url.id}"
}

resource "aws_apigatewayv2_route" "confirm_upload" {
  api_id    = aws_apigatewayv2_api.video_pipeline.id
  route_key = "POST /upload/confirm"
  target    = "integrations/${aws_apigatewayv2_integration.confirm_upload.id}"
}

resource "aws_apigatewayv2_route" "list_videos" {
  api_id    = aws_apigatewayv2_api.video_pipeline.id
  route_key = "GET /videos"
  target    = "integrations/${aws_apigatewayv2_integration.list_videos.id}"
}

resource "aws_apigatewayv2_route" "get_video" {
  api_id    = aws_apigatewayv2_api.video_pipeline.id
  route_key = "GET /videos/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.get_video.id}"
}

resource "aws_apigatewayv2_route" "start_pipeline" {
  api_id    = aws_apigatewayv2_api.video_pipeline.id
  route_key = "POST /pipeline/start"
  target    = "integrations/${aws_apigatewayv2_integration.start_pipeline.id}"
}

resource "aws_apigatewayv2_route" "get_pipeline_status" {
  api_id    = aws_apigatewayv2_api.video_pipeline.id
  route_key = "GET /pipeline/status/{executionId}"
  target    = "integrations/${aws_apigatewayv2_integration.get_pipeline_status.id}"
}

resource "aws_apigatewayv2_route" "list_voices" {
  api_id    = aws_apigatewayv2_api.video_pipeline.id
  route_key = "GET /voices"
  target    = "integrations/${aws_apigatewayv2_integration.list_voices.id}"
}

resource "aws_apigatewayv2_route" "get_output_video" {
  api_id    = aws_apigatewayv2_api.video_pipeline.id
  route_key = "GET /output/{videoId}"
  target    = "integrations/${aws_apigatewayv2_integration.get_output_video.id}"
}

resource "aws_apigatewayv2_route" "get_insights" {
  api_id    = aws_apigatewayv2_api.video_pipeline.id
  route_key = "POST /insights"
  target    = "integrations/${aws_apigatewayv2_integration.get_insights.id}"
}

resource "aws_lambda_permission" "api_get_presigned_url" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_get_presigned_url.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_confirm_upload" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_confirm_upload.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_list_videos" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_list_videos.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_get_video" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_get_video.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_start_pipeline" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_start_pipeline.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_get_pipeline_status" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_get_pipeline_status.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_list_voices" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_list_voices.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_get_output_video" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_get_output_video.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_get_insights" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_get_insights.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.video_pipeline.execution_arn}/*/*"
}
