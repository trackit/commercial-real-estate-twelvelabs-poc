resource "aws_dynamodb_table" "task_tokens" {
  name         = "${local.name_prefix}-task-tokens"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "${local.name_prefix}-task-tokens"
  }
}

resource "aws_dynamodb_table" "videos" {
  name         = "${local.name_prefix}-videos"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "${local.name_prefix}-videos"
  }
}
