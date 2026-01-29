variable "aws_region" {
  description = "AWS region for resources - must be us-east-1 for Marengo StartAsyncInvoke"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "cbre-pipeline"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "owner" {
  description = "Owner of the resources for tagging"
  type        = string
}

variable "vector_index_name" {
  description = "S3 Vectors index name"
  type        = string
  default     = "video-embeddings"
}

variable "enable_api_gateway" {
  description = "Whether to create API Gateway resources"
  type        = bool
  default     = true
}

variable "polly_voice_id" {
  description = "AWS Polly voice ID for TTS"
  type        = string
  default     = "Joanna"
}
