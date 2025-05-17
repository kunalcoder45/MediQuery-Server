import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());
const PORT = process.env.PORT || 3000;

// Get lat/lon from Nominatim
async function getLatLong(location) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.length === 0) return null;
  return { lat: data[0].lat, lon: data[0].lon };
}

// Multiple Overpass endpoints for fallback
const overpassEndpoints = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter'
];

// Try Overpass endpoints with fallback
async function getMedicalStores(lat, lon) {
  const radius = 10000;
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="pharmacy"](around:${radius},${lat},${lon});
      node["healthcare"="pharmacy"](around:${radius},${lat},${lon});
      way["amenity"="pharmacy"](around:${radius},${lat},${lon});
      way["healthcare"="pharmacy"](around:${radius},${lat},${lon});
    );
    out center tags;
  `;

  for (const endpoint of overpassEndpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain' },
      });

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        console.warn(`Invalid JSON from ${endpoint}`);
        continue;
      }

      if (!data.elements) continue;

      return data.elements.map((el) => ({
        id: el.id,
        name: el.tags.name || 'Unknown',
        phone: el.tags.phone || el.tags['contact:phone'] || 'N/A',
        lat: el.lat || el.center?.lat,
        lon: el.lon || el.center?.lon,
      }));
    } catch (err) {
      console.warn(`Overpass request failed for ${endpoint}:`, err.message);
    }
  }

  // If all endpoints fail
  return [];
}

app.get("/", (req, res) => {
  res.send("MediQuery backend running");
});


// API Route
app.post('/api/medical-stores', async (req, res) => {
  try {
    const { location } = req.body;
    if (!location) return res.status(400).json({ error: 'Location is required' });

    const coords = await getLatLong(location);
    if (!coords) return res.status(404).json({ error: 'Location not found' });

    const stores = await getMedicalStores(coords.lat, coords.lon);
    return res.json({ stores });
  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'Server error occurred' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
