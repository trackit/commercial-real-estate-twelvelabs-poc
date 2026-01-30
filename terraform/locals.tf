data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

locals {
  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.name
  name_prefix = "${var.project_name}-${var.environment}"

  aws_region        = "us-east-1"
  vector_index_name = "video-embeddings"

  common_tags = {
    Owner   = var.owner
    Project = "CBRE-Pipeline"
  }
}
