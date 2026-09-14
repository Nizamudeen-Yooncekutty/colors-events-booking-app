async function apiLogin(request, employeeId, password) {
  const res = await request.post('/api/auth/login', {
    data: { employeeId, password },
  });
  return res.json();
}

async function apiGetToken(request, employeeId, password) {
  const body = await apiLogin(request, employeeId, password);
  return body.token;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function apiGet(request, path, token) {
  return request.get(`/api${path}`, { headers: authHeader(token) });
}

async function apiPost(request, path, token, data) {
  return request.post(`/api${path}`, { headers: authHeader(token), data });
}

async function apiPut(request, path, token, data) {
  return request.put(`/api${path}`, { headers: authHeader(token), data });
}

async function apiDelete(request, path, token) {
  return request.delete(`/api${path}`, { headers: authHeader(token) });
}

async function apiPatch(request, path, token, data) {
  return request.patch(`/api${path}`, { headers: authHeader(token), data });
}

async function getEvents(request, token) {
  const res = await apiGet(request, '/events', token);
  const body = await res.json();
  return body.events || body;
}

async function getMyBookings(request, token) {
  const res = await apiGet(request, '/bookings/my', token);
  const body = await res.json();
  return body.bookings || body;
}

async function getBooking(request, id, token) {
  const res = await apiGet(request, `/bookings/${id}`, token);
  const body = await res.json();
  return body.booking || body;
}

module.exports = { apiLogin, apiGetToken, apiGet, apiPost, apiPut, apiDelete, apiPatch, getEvents, getMyBookings, getBooking };
