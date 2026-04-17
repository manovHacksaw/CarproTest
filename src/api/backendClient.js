/**
 * All frontend API calls go through this client.
 * If the backend is down, the app will show errors and block actions.
 */
const BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

async function request(method, path, body = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  const token = localStorage.getItem("carRentalToken");
  if (token) options.headers["Authorization"] = `Bearer ${token}`;
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data.data;
}

// Health
export const checkBackendHealth = () => request("GET", "/health");

// Cars
export const getCars = (params = "") => request("GET", `/api/cars${params}`);
export const getCarById = (id) => request("GET", `/api/cars/${id}`);
export const getCarQuote = (id, pickUpDate, dropOffDate) =>
  request("GET", `/api/cars/${id}/quote?pickUpDate=${pickUpDate}&dropOffDate=${dropOffDate}`);
export const getLocations = () => request("GET", "/api/cars/locations");
export const getAllPrices = () => request("GET", "/api/cars/prices");

// Reservations
export const createReservation = (payload) => request("POST", "/api/reservations", payload);
export const getReservationById = (id) => request("GET", `/api/reservations/${id}`);
export const getReservationsByAddress = (address) =>
  request("GET", `/api/reservations/address/${address}`);
export const confirmReservation = (id, txHash) =>
  request("PATCH", `/api/reservations/${id}/confirm`, { txHash });
export const cancelReservation = (id, renterAddress) =>
  request("DELETE", `/api/reservations/${id}`, { renterAddress });

// Blockchain
export const getBlockchainStatus = () => request("GET", "/api/blockchain/status");
export const getWalletBalance = (address) =>
  request("GET", `/api/blockchain/balance/${address}`);
export const getChainReservations = () => request("GET", "/api/blockchain/reservations");
export const getTxDetails = (hash) => request("GET", `/api/blockchain/tx/${hash}`);

// Pricing
export const getPriceQuote = (carName, pickUpDate, dropOffDate) =>
  request("GET", `/api/pricing/quote?carName=${encodeURIComponent(carName)}&pickUpDate=${pickUpDate}&dropOffDate=${dropOffDate}`);

// Users
export const authenticateWallet = (address, signature, message) =>
  request("POST", "/api/users/auth", { address, signature, message });
export const getUserProfile = (address) => request("GET", `/api/users/${address}`);
export const getUserReservations = (address) =>
  request("GET", `/api/users/${address}/reservations`);

// Analytics
export const getAnalytics = () => request("GET", "/api/analytics");
