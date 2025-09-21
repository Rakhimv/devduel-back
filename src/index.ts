import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import authRoutes from "./routes/auth.routes"


dotenv.config({path: "../.env"})
const app = express()
const PORT = process.env.PORT

app.use(express.json())
app.use(cors({origin: "*"}))


app.use("/api/auth", authRoutes)




app.listen(PORT, ()=>{
    console.log(`Запущен на http://localhost:${PORT}`) 
})