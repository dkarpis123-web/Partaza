// Tells the app which country and city a position is in.
//   /api/geo?lat=54.90&lon=23.90  → looks the rounded position up in OpenStreetMap (Nominatim)
//   /api/geo                      → falls back to the country and city of the visitor's network
// Nothing is stored or logged here.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && req.query.lat !== undefined) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=lt&lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`;
      const answer = await fetch(url, { headers: { 'User-Agent': 'Partaza/1.0 (https://partaza.eu)' } });
      const data = await answer.json();
      const address = data.address || {};
      const country = typeof address.country_code === 'string' ? address.country_code.toUpperCase() : null;
      if (country) {
        res.status(200).json({ country, city: address.city || address.town || address.village || address.municipality || null });
        return;
      }
    } catch (error) {
      // fall through to the network location
    }
  }
  const city = req.headers['x-vercel-ip-city'];
  res.status(200).json({ country: req.headers['x-vercel-ip-country'] || null, city: city ? decodeURIComponent(city) : null });
};
