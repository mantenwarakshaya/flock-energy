import "dotenv/config";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { readFile } from "node:fs/promises";
import { createPortalClient } from "./portal/client.js";
import { createMeterRouter } from "./routes/meters.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

const port = Number(process.env.PORT || 3000);
const portal = createPortalClient();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "flock-energy-api" });
});

app.use("/api/v1/meters", createMeterRouter(portal));

app.get("/api/v1/hierarchy", async (_req, res, next) => {
  try {
    const result = await portal.getHierarchy();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

try {
  const openapi = JSON.parse(await readFile(new URL("../openapi.json", import.meta.url), "utf8"));
  app.get("/openapi.json", (_req, res) => res.json(openapi));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));
} catch (error) {
  console.error("Could not load openapi.json:", error.message);
}

app.use((req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Route not found: ${req.method} ${req.path}` }
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  res.status(status).json({
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: status === 500 ? "An unexpected error occurred." : error.message
    }
  });
});

app.listen(port, () => {
  console.log(`Flock Energy API listening on http://localhost:${port}`);
});
