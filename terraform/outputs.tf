output "video_bucket_name" {
  description = "Name of the S3 bucket for videos"
  value       = aws_s3_bucket.video.id
}

output "video_bucket_arn" {
  description = "ARN of the S3 bucket for videos"
  value       = aws_s3_bucket.video.arn
}

output "state_machine_arn" {
  description = "ARN of the Step Functions state machine"
  value       = aws_sfn_state_machine.video_pipeline.arn
}

output "state_machine_name" {
  description = "Name of the Step Functions state machine"
  value       = aws_sfn_state_machine.video_pipeline.name
}

output "lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda.arn
}

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.video_pipeline.api_endpoint
}

output "task_tokens_table_name" {
  description = "Name of the DynamoDB table for task tokens"
  value       = aws_dynamodb_table.task_tokens.name
}

output "videos_table_name" {
  description = "Name of the DynamoDB table for videos"
  value       = aws_dynamodb_table.videos.name
}

output "lambda_functions" {
  description = "Map of Lambda function names to ARNs"
  value = {
    start_marengo          = aws_lambda_function.start_marengo.arn
    start_pegasus_analysis = aws_lambda_function.start_pegasus_analysis.arn
    start_pegasus_voiceover = aws_lambda_function.start_pegasus_voiceover.arn
    marengo_callback       = aws_lambda_function.marengo_callback.arn
    store_embeddings       = aws_lambda_function.store_embeddings.arn
    select_segments        = aws_lambda_function.select_segments.arn
    synthesize_audio       = aws_lambda_function.synthesize_audio.arn
    process_video          = aws_lambda_function.process_video.arn
  }
}

