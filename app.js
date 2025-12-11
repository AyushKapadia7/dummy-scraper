import express from "express";
import helitraderRoute from "./routes/helitrader.route.js";
import controllerHeliRoute from "./routes/controllerHeli.route.js";
import avPayAeroRoute from "./routes/avpayaero.route.js";
import globalAirRoute from "./routes/globalair.route.js";
import tradeAPlaneRoute from "./routes/tradeAPlane.route.js";

const app = express();

app.use(express.json());

// Your routes:
app.use("/scrape/helitrader", helitraderRoute);
app.use("/scrape/controller", controllerHeliRoute);
app.use("/scrape/avpay", avPayAeroRoute);
app.use("/scrape/trade-a-plane", tradeAPlaneRoute);
app.use("/scrape/globalair", globalAirRoute);

export default app;
