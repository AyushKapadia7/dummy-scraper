import express from "express";
import { scrapeControllerHeliController } from "../controllers/controllerHeli.controller.js";

const router = express.Router();

router.get("/", scrapeControllerHeliController);

export default router;
