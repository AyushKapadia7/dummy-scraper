import express from "express";
import { scrapeAvPayAeroController } from "../controllers/avpayaero.controller.js";

const router = express.Router();

router.get("/", scrapeAvPayAeroController);

export default router;
