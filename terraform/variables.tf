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
