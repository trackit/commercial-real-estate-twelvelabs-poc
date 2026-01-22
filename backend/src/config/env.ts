import dotenv from 'dotenv'

dotenv.config()

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  scriptPath: process.env.SCRIPT_PATH || '../scripts/script.sh',
  insightsScriptPath: process.env.INSIGHTS_SCRIPT_PATH || '../scripts/insights.sh',
  uploadsDir: process.env.UPLOADS_DIR || './uploads',
  outputsDir: process.env.OUTPUTS_DIR || './outputs',
} as const
