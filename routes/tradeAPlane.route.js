import express from "express";
import { scrapeTradeAPlaneController } from "../controllers/tradeAPlane.controller.js";

const router = express.Router();

router.get("/", scrapeTradeAPlaneController);

export default router;
