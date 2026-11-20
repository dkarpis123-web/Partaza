// Tells the app which country and city the visitor's network is in, from the headers Vercel adds
// to every request. Nothing is stored or logged here.
module.exports = (req, res) => {
  const city = req.headers['x-vercel-ip-city'];
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({
    country: req.headers['x-vercel-ip-country'] || null,
    city: city ? decodeURIComponent(city) : null,
  });
};
