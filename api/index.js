const CITIES = [
  "Lagos",
  "Abuja",
  "Ibadan",
  "Port Harcourt",
  "Kano",
  "Enugu",
  "Kaduna",
  "Benin",
];

const BUS_NAMES = [
  "CityLink Express",
  "SwiftLine",
  "SkyRide Deluxe",
  "Metro Cruiser",
  "Northern Star",
  "Royal Transit",
];

const routes = [];
const bookings = [];
let nextBookingId = 1;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomRoutes(count = 5) {
  routes.length = 0;
  for (let index = 0; index < count; index += 1) {
    const from = CITIES[randomInt(0, CITIES.length - 1)];
    let to = CITIES[randomInt(0, CITIES.length - 1)];
    while (to === from) {
      to = CITIES[randomInt(0, CITIES.length - 1)];
    }

    const hour = String(randomInt(6, 22)).padStart(2, "0");
    const minute = randomInt(0, 1) === 0 ? "00" : "30";
    const busName = `${BUS_NAMES[randomInt(0, BUS_NAMES.length - 1)]} ${randomInt(101, 999)}`;

    routes.push({
      id: index + 1,
      busName,
      from,
      to,
      departureTime: `${hour}:${minute}`,
      price: randomInt(25, 95),
      seatsAvailable: randomInt(8, 35),
    });
  }
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function getPathname(req) {
  const url = new URL(req.url, "http://localhost");
  return { pathname: url.pathname, searchParams: url.searchParams };
}

if (routes.length === 0) {
  generateRandomRoutes();
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const { pathname, searchParams } = getPathname(req);

  if (req.method === "GET" && pathname === "/api/routes") {
    sendJson(res, 200, routes);
    return;
  }

  if (req.method === "POST" && pathname === "/api/routes/generate") {
    const count = Number(searchParams.get("count"));
    const routeCount = Number.isInteger(count) && count > 0 ? Math.min(count, 12) : 5;
    generateRandomRoutes(routeCount);
    bookings.length = 0;
    nextBookingId = 1;
    sendJson(res, 200, routes);
    return;
  }

  if (req.method === "GET" && pathname === "/api/bookings") {
    sendJson(res, 200, bookings);
    return;
  }

  if (req.method === "POST" && pathname === "/api/bookings") {
    const payload = await readJsonBody(req);
    if (!payload) {
      sendJson(res, 400, { message: "Invalid JSON body." });
      return;
    }

    const { passengerName, routeId, seats } = payload;
    const parsedSeats = Number(seats);
    const route = routes.find((item) => item.id === Number(routeId));

    if (!passengerName || !String(passengerName).trim()) {
      sendJson(res, 400, { message: "Passenger name is required." });
      return;
    }

    if (!route) {
      sendJson(res, 404, { message: "Selected route not found." });
      return;
    }

    if (!Number.isInteger(parsedSeats) || parsedSeats < 1) {
      sendJson(res, 400, { message: "Seat count must be at least 1." });
      return;
    }

    if (parsedSeats > route.seatsAvailable) {
      sendJson(res, 400, { message: "Not enough seats available." });
      return;
    }

    route.seatsAvailable -= parsedSeats;
    const booking = {
      id: nextBookingId++,
      passengerName: String(passengerName).trim(),
      routeId: route.id,
      routeName: route.busName,
      from: route.from,
      to: route.to,
      departureTime: route.departureTime,
      seats: parsedSeats,
      totalPrice: parsedSeats * route.price,
    };
    bookings.push(booking);

    sendJson(res, 201, booking);
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/bookings/")) {
    const bookingId = Number(pathname.split("/").pop());
    const bookingIndex = bookings.findIndex((booking) => booking.id === bookingId);

    if (bookingIndex === -1) {
      sendJson(res, 404, { message: "Booking not found." });
      return;
    }

    const [booking] = bookings.splice(bookingIndex, 1);
    const route = routes.find((item) => item.id === booking.routeId);
    if (route) {
      route.seatsAvailable += booking.seats;
    }

    sendJson(res, 200, { message: "Booking cancelled." });
    return;
  }

  sendJson(res, 404, { message: "Endpoint not found." });
};
