import express from "express";
import { scrapeHelitraderController } from "../controllers/helitrader.controller.js";

const router = express.Router();

router.get("/", scrapeHelitraderController);

export default router;
