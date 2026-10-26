import axios from "axios";

/**
 * Adapter boundary for the legacy Urja portal.
 * IMPORTANT: Discover the real authentication flow and endpoints in DevTools
 * before implementing login/list/detail/consumption methods.
 *
 * This starter intentionally does not pretend that sample URLs or selectors
 * from the assignment reference have been verified.
 */
export function createPortalClient() {
  const baseURL = process.env.URJA_BASE_URL;
  if (!baseURL) throw new Error("Missing URJA_BASE_URL");

  const http = axios.create({
    baseURL,
    timeout: Number(process.env.REQUEST_TIMEOUT_MS || 10000),
    // Do not follow or blindly replay authentication redirects without checking
    // whether the portal has actually returned a login page.
    validateStatus: (status) => status >= 200 && status < 500
  });

  return {
    


    async listMeters(filters = {}) {
      const limit = filters.limit ?? 20;
      const offset = filters.offset ?? 0;
      const search = filters.search ?? filters.q ?? "";

      const portalPageSize = 20;
      const firstPage = Math.floor(offset / portalPageSize) + 1;
      const lastIndex = offset + limit;
      const lastPage = Math.ceil(lastIndex / portalPageSize);

      const pages = [];

      for (let page = firstPage; page <= lastPage; page++) {
        const response = await http.get("/portal/meters/search", {
          params: { q: search, page },
          headers: process.env.URJA_COOKIE
            ? { Cookie: process.env.URJA_COOKIE }
            : {}
        });

        if (response.status >= 400) {
          const error = new Error(
            `Urja meter search failed with status ${response.status}`
          );
          error.status = response.status;
          throw error;
        }

        pages.push(response.data);
      }

      const allMeters = pages.flatMap(result => result.data ?? []);
      const firstPageData = pages[0] ?? {};

      return {
        data: allMeters.slice(
          offset % portalPageSize,
          (offset % portalPageSize) + limit
        ),
        total: firstPageData.total ?? 0,
        page: firstPage,
        pageSize: limit
      };
    },

    async getMeter(meterId) {
      const response = await http.get(
        `/meters/${encodeURIComponent(meterId)}/__data.json`,
        {
          params: {
            "x-sveltekit-invalidated": "001"
          },
          headers: process.env.URJA_COOKIE
            ? { Cookie: process.env.URJA_COOKIE }
            : {}
        }
      );

      if (response.status >= 400) {
        const error = new Error(
          `Urja meter detail request failed with status ${response.status}`
        );
        error.status = response.status;
        throw error;
      }

      const nodes = response.data?.nodes ?? [];

      const detailNode = nodes.find(
        (node) => node?.type === "data" && Array.isArray(node.data)
      );

      if (!detailNode) {
        // Check whether the portal explicitly indicates that the meter is missing.
        const pageText = JSON.stringify(response.data ?? {}).toLowerCase();

        const meterNotFound =
          response.status === 404 ||
          pageText.includes("meter not found") ||
          pageText.includes("not found");

        if (meterNotFound) {
          const error = new Error("Meter not found.");
          error.status = 404;
          error.code = "METER_NOT_FOUND";
          throw error;
        }

        const error = new Error(
          "Unexpected Urja meter detail response format."
        );
        error.status = 502;
        error.code = "INVALID_PORTAL_RESPONSE";
        throw error;
      }

      const indexedData = detailNode.data;
      const meter = indexedData[0] ?? {};
      const hierarchy = indexedData[meter.hierarchy] ?? {};
      

      // Read the meter's detailed parameter records.
      const detailDataRef = indexedData[meter.detail];

      const detailEntries =
        Array.isArray(detailDataRef?.data) &&
        typeof detailDataRef.data[0] === "number"
          ? detailDataRef.data
          : typeof detailDataRef?.data === "number" &&
              Array.isArray(indexedData[detailDataRef.data])
            ? indexedData[detailDataRef.data]
            : [];

      const detailFields = {};

      for (const entryIndex of detailEntries) {
        const entry = indexedData[entryIndex];

        if (!entry || typeof entry !== "object") continue;

        const name = indexedData[entry.parameterName];
        const value = indexedData[entry.parameterValue];

        if (typeof name === "string") {
          detailFields[name] = value ?? null;
        }
      }     

      const readDetailValue = (name) => detailFields[name] ?? null;

      // Read values referenced by the hierarchy object.
      const readValue = (key) => {
        const index = hierarchy[key];

        return Number.isInteger(index)
          ? indexedData[index] ?? null
          : null;
      };

      return {
        meterId: indexedData[meter.meterId] ?? meterId,
        serialNo: readDetailValue("Serial No"),
        make: readDetailValue("Make"),
        phaseType: readDetailValue("Phase Type"),
        installStatus: readValue("Installation Status"),
        installationType: readValue("Installation Type"),
        hierarchy: {
          zone: readValue("Zone"),
          circle: readValue("Circle"),
          division: readValue("Division"),
          subdivision: readValue("Subdivision"),
          subStation: readValue("Sub Station"),
          feeder: readValue("Feeder"),
          dt: readValue("DT")
        }
      };
    },


    async getHierarchy() {
      const firstPage = await this.listMeters({ limit: 100, offset: 0 });

      const meters = [...(firstPage.data ?? [])];

      for (
        let offset = 100;
        offset < firstPage.total;
        offset += 100
      ) {
        const page = await this.listMeters({ limit: 100, offset });
        meters.push(...(page.data ?? []));
      }
      const hierarchyMap = new Map();

      for (const meter of meters) {
        if (!meter.meterId) continue;

        const details = await this.getMeter(meter.meterId);
        
        const hierarchy = details.hierarchy;

        if (!hierarchy?.zone) continue;

        const key = [
          hierarchy.zone,
          hierarchy.circle,
          hierarchy.division,
          hierarchy.subdivision,
          hierarchy.subStation,
          hierarchy.feeder,
          hierarchy.dt
        ].join("|");

        if (!hierarchyMap.has(key)) {
          hierarchyMap.set(key, hierarchy);
        }
      }

      return {
        count: hierarchyMap.size,
        data: Array.from(hierarchyMap.values())
      };
    },

    async getConsumption(meterId, filters = {}) {
      const response = await http.get(
        `/portal/meters/${encodeURIComponent(meterId)}/energy`,
        {
          headers: process.env.URJA_COOKIE
            ? { Cookie: process.env.URJA_COOKIE }
            : {}
        }
      );

      if (response.status >= 400) {
        const error = new Error(
          response.status === 404
            ? "Meter not found."
            : `Urja consumption request failed with status ${response.status}`
        );

        error.status = response.status;

        if (response.status === 404) {
          error.code = "METER_NOT_FOUND";
        }

        throw error;
      }
      const records = response.data?.data;

      if (!Array.isArray(records)) {
        const error = new Error(
          "Unexpected Urja consumption response format."
        );
        error.status = 502;
        error.code = "INVALID_PORTAL_RESPONSE";
        throw error;
      }

      // The portal returns timestamps as DD/MM/YYYY HH:mm.
      // Parse them explicitly instead of relying on Date.parse().
      const parseTimestamp = (timestamp) => {
        if (typeof timestamp !== "string") return null;

        const match = timestamp.match(
          /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/
        );

        if (!match) return null;

        const [, day, month, year, hour, minute] = match;

        return new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute)
        );
      };

      const from = filters.from ? new Date(filters.from) : null;
      const to = filters.to ? new Date(filters.to) : null;

      if (
        (from && Number.isNaN(from.getTime())) ||
        (to && Number.isNaN(to.getTime()))
      ) {
        const error = new Error(
          "Invalid date filter. Use a valid ISO date or datetime."
        );
        error.status = 400;
        error.code = "INVALID_DATE_FILTER";
        throw error;
      }

      if (from && to && from > to) {
        const error = new Error(
          "'from' must be earlier than or equal to 'to'."
        );
        error.status = 400;
        error.code = "INVALID_DATE_RANGE";
        throw error;
      }

      const filteredRecords = records.filter((record) => {
        const timestamp = parseTimestamp(record.timestamp);

        if (!timestamp) return false;
        if (from && timestamp < from) return false;
        if (to && timestamp > to) return false;

        return true;
      });

      return {
        meterId,
        count: filteredRecords.length,
        data: filteredRecords
      };
    },
    // Exposed only to keep the adapter's HTTP client encapsulated.
    _http: http
  };
}
