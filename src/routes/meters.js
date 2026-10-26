import { Router } from "express";

export function createMeterRouter(portal) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const filters = {
        limit: parseOptionalInteger(req.query.limit, "limit", 1, 100),
        offset: parseOptionalInteger(req.query.offset, "offset", 0, 1000000),
        search: typeof req.query.search === "string" ? req.query.search.trim() : undefined
      };
      const data = await portal.listMeters(filters);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/consumption", async (req, res, next) => {
    try {
      const meterId = req.params.id.trim();
      if (!meterId) return res.status(400).json({
        error: { code: "INVALID_METER_ID", message: "Meter id is required." }
      });

      const filters = {
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined
      };
      const data = await portal.getConsumption(meterId, filters);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const meterId = req.params.id.trim();
      if (!meterId) return res.status(400).json({
        error: { code: "INVALID_METER_ID", message: "Meter id is required." }
      });
      const data = await portal.getMeter(meterId);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function parseOptionalInteger(value, name, min, max) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    const error = new Error(`${name} must be an integer between ${min} and ${max}.`);
    error.status = 400;
    error.code = "INVALID_QUERY_PARAMETER";
    throw error;
  }
  return parsed;
}
