import express from "express";
import { scrapeGlobalAirController } from "../controllers/globalair.controller.js";

const router = express.Router();

router.get("/", scrapeGlobalAirController);

export default router;
