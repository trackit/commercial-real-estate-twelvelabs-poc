import express from 'express'
import cors from 'cors'
import path from 'path'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import routes from './routes/index.js'

const app = express()

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}))

app.use(express.json())

app.use('/api', routes)

app.use('/api/output', express.static(path.resolve(env.outputsDir)))

app.use(notFound)
app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`)
})
