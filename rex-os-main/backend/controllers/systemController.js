exports.getSystem = (req, res) => {
  res.json({
    cpu: 12,
    ram: 38,
    storage: 52,
    docker: 8,
    temperature: 39,
    uptime: "3 days 12 hours",
  });
};