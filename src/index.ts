import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import dotenv from "dotenv"
import authRoutes from "./routes/auth.routes"


dotenv.config({path: "../.env"})
const app = express()
const PORT = process.env.PORT

app.use(express.json())
app.use(cookieParser())
app.use(cors({
  origin: [process.env.FRONTEND_ORIGIN || "http://localhost:5173"],
  credentials: true
}))


app.use("/api/auth", authRoutes)

app.get('/api/health', (_req, res) => {
  res.status(200).json({ message: 'Server is running' });
});



app.listen(PORT, ()=>{
    console.log(`Запущен на http://localhost:${PORT}`) 
})