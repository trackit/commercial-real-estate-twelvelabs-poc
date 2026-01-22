import { Router } from 'express'
import configRouter from './config.js'
import uploadRouter from './upload.js'
import pipelineRouter from './pipeline.js'
import insightsRouter from './insights.js'
import voicesRouter from './voices.js'

const router = Router()

router.use('/config', configRouter)
router.use('/', uploadRouter)
router.use('/pipeline', pipelineRouter)
router.use('/insights', insightsRouter)
router.use('/voices', voicesRouter)

export default router
