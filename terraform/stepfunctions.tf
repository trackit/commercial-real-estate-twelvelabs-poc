resource "aws_sfn_state_machine" "video_pipeline" {
  name     = "${local.name_prefix}"
  role_arn = aws_iam_role.step_functions.arn

  definition = templatefile("${path.module}/state-machine.asl.json", {
    StartMarengoLambdaArn          = aws_lambda_function.start_marengo.arn
    StoreEmbeddingsLambdaArn       = aws_lambda_function.store_embeddings.arn
    StartPegasusAnalysisLambdaArn  = aws_lambda_function.start_pegasus_analysis.arn
    SelectSegmentsLambdaArn        = aws_lambda_function.select_segments.arn
    StartPegasusVoiceoverLambdaArn = aws_lambda_function.start_pegasus_voiceover.arn
    SynthesizeAudioLambdaArn       = aws_lambda_function.synthesize_audio.arn
    ProcessVideoLambdaArn          = aws_lambda_function.process_video.arn
  })

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.step_functions_logs.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  tracing_configuration {
    enabled = true
  }

  tags = {
    Name = "${local.name_prefix}-state-machine"
  }
}

resource "aws_cloudwatch_log_group" "step_functions_logs" {
  name              = "/aws/states/${local.name_prefix}"
  retention_in_days = 14

  tags = {
    Name = "${local.name_prefix}-sfn-logs"
  }
}
