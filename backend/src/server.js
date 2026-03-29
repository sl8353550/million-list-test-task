import express from 'express'
import cors from 'cors'
import { router } from './routes.js'
import { flushAddQueue, flushMutateQueue } from './queue.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api', router)

setInterval(() => {
  const result = flushMutateQueue()

  if (result.applied > 0) {
    console.log(`[flushMutateQueue] applied=${result.applied}`)
  }
}, 1000)

setInterval(() => {
  const result = flushAddQueue()

  if (result.applied > 0) {
    console.log(`[flushAddQueue] applied=${result.applied}`)
  }
}, 10000)

app.listen(PORT, () => {
  console.log(`Backend started on http://localhost:${PORT}`)
})