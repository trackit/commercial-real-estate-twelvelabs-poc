resource "aws_cloudwatch_event_rule" "s3_object_created" {
  name        = "${local.name_prefix}-s3-object-created"
  description = "Capture S3 object created events for Bedrock async output"

  event_pattern = jsonencode({
    source      = ["aws.s3"]
    detail-type = ["Object Created"]
    detail = {
      bucket = {
        name = [aws_s3_bucket.video.id]
      }
    }
  })

  tags = {
    Name = "${local.name_prefix}-s3-object-created"
  }
}

resource "aws_cloudwatch_event_target" "bedrock_callback" {
  rule      = aws_cloudwatch_event_rule.s3_object_created.name
  target_id = "bedrock-callback"
  arn       = aws_lambda_function.marengo_callback.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.marengo_callback.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.s3_object_created.arn
}
