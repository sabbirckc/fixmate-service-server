import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import {MongoClient} from 'mongodb'
dotenv.config()

const app = express()

app.use(cors());
app.use(express.json())

const client = new MongoClient(process.env.MONGODB_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const connectedClient= await connectToMongoDB()
const db = connectedClient.db('fixmate-service')

app.get('/', (req, res) => {
    res.send('Hello World')
})

app.listen(process.env.PORT || 3000, () => {
console.log(`Server is running on port ${process.env.PORT || 3000}`)
})