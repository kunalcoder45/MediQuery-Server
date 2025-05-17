import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/pharmacies", async (req, res) => {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    const radius = 2000; // meters

    const query = `
[out:json];
(
  node["amenity"="pharmacy"](around:${radius},${lat},${lng});
  way["amenity"="pharmacy"](around:${radius},${lat},${lng});
  relation["amenity"="pharmacy"](around:${radius},${lat},${lng});
);
out center;
`;

    // Backend me nearby.js
    try {
        const response = await axios.post(
            "https://overpass-api.de/api/interpreter",
            query,
            { headers: { "Content-Type": "text/plain" } }
        );
        console.log("Overpass response:", response.data); // check here
        res.json({ pharmacies: response.data.elements });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch pharmacies" });
    }
});

export default router;
