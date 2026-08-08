const jellyfin = require("../services/jellyfinService");

/** Shared shape for media items returned to the frontend. */
function mapItem(item) {
  return {
    id: item.Id,
    name: item.Name,
    type: item.Type,
    year: item.ProductionYear,
    overview: item.Overview || "",
    poster: `/api/jellyfin/poster/${item.Id}`,
    backdrop: `/api/jellyfin/backdrop/${item.Id}`,
  };
}

function handleError(res, error) {
  console.error(error.response?.data || error.message);

  res.status(500).json({
    status: "error",
    details: error.response?.data || error.message,
  });
}

exports.getServer = async (req, res) => {
  try {
    const info = await jellyfin.getServerInfo();

    res.json({
      status: "success",
      serverName: info.ServerName,
      version: info.Version,
      operatingSystem: info.OperatingSystem,
      localAddress: info.LocalAddress,
    });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await jellyfin.getUsers();

    res.json(users);
  } catch (error) {
    handleError(res, error);
  }
};

exports.getLatest = async (req, res) => {
  try {
    const items = await jellyfin.getLatestMedia();

    res.json({
      status: "success",
      items: items.slice(0, 12).map(mapItem),
    });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getItems = async (req, res) => {
  try {
    const data = await jellyfin.getItems(req.query);

    res.json({
      status: "success",
      items: (data.Items || []).map(mapItem),
      total: data.TotalRecordCount || 0,
    });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getResume = async (req, res) => {
  try {
    const data = await jellyfin.getResume();

    res.json({
      status: "success",
      items: (data.Items || []).slice(0, 12).map(mapItem),
    });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getSessions = async (req, res) => {
  try {
    const sessions = await jellyfin.getSessions();

    const activeSessions = sessions
      .filter((session) => session.NowPlayingItem)
      .map((session) => ({
        id: session.Id,
        user: session.UserName,
        client: session.Client,
        device: session.DeviceName,
        remote: !session.IsActiveIdle,
        item: {
          id: session.NowPlayingItem.Id,
          name: session.NowPlayingItem.Name,
          type: session.NowPlayingItem.Type,
          year: session.NowPlayingItem.ProductionYear,
          poster: `/api/jellyfin/poster/${session.NowPlayingItem.Id}`,
        },
      }));

    res.json({
      status: "success",
      count: activeSessions.length,
      sessions: activeSessions,
    });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getPoster = async (req, res) => {
  try {
    const poster = await jellyfin.getPoster(req.params.id);

    res.setHeader("Content-Type", poster.contentType);

    poster.stream.pipe(res);
  } catch (error) {
    console.error(error.response?.data || error.message);

    res.sendStatus(404);
  }
};

exports.getBackdrop = async (req, res) => {
  try {
    const backdrop = await jellyfin.getBackdrop(req.params.id);

    res.setHeader("Content-Type", backdrop.contentType);

    backdrop.stream.pipe(res);
  } catch (error) {
    console.error(error.response?.data || error.message);

    res.sendStatus(404);
  }
};
