# UST QPass — API Documentation

**Version:** 1.0  
**Base URL:** `http://localhost:5001/api`  
**Production:** `https://ustqpass.ustdev.com/api`

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Pagination](#pagination)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Auth](#auth)
  - [Events](#events)
  - [Bookings](#bookings)
  - [Walk-ins](#walk-ins)
  - [Admin](#admin)
- [Data Models](#data-models)

---

## Overview

UST QPass is a digital event token system with QR-based check-in. The API supports:

- Employee registration and JWT-based authentication (with Azure AD SSO)
- Event creation and management
- Booking with QR code generation
- Real-time QR scanning for check-in
- Walk-in attendee tracking
- Admin dashboards and CSV report exports

**Tech stack:** Express.js, MongoDB/Mongoose, JWT (HS256), Azure AD SSO (RS256/JWKS)

---

## Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are obtained from `/api/auth/sso` (Azure AD SSO) and expire after **7 days**.

### Roles

| Role | Access Level |
|------|-------------|
| `employee` | View active events, create/manage own bookings |
| `volunteer` | Employee access + scan QR codes, manage walk-ins |
| `admin` | Full access — create events, view reports, manage employees |

---

## Error Handling

All errors return JSON with a consistent structure:

```json
{
  "message": "Human-readable error message",
  "requestId": "uuid-v4"
}
```

Validation errors include an additional `errors` array:

```json
{
  "message": "First validation error message",
  "errors": ["Error 1", "Error 2"]
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Resource created |
| `400` | Bad request / validation error |
| `401` | Unauthorized — missing or invalid token |
| `403` | Forbidden — insufficient role |
| `404` | Resource not found |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| Global (`/api/*`) | 5000 req/IP | 1 min |
| SSO | 30 req/IP | 5 min |
| Bookings | 100 req/IP | 1 min |
| Admin | 500 req/IP | 1 min |
| QR Scan | 300 req/IP | 1 min |

Rate limit headers are included in responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

## Pagination

All listing endpoints support pagination via query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-based) |
| `limit` | integer | `20` | Items per page (max 100) |

Paginated responses include a `pagination` object:

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasMore": true
  }
}
```

**Paginated endpoints:** `GET /api/events`, `GET /api/bookings/my`, `GET /api/admin/dashboard`, `GET /api/admin/events/:eventId/bookings`, `GET /api/admin/employees`, `GET /api/walkins/event/:eventId`

---

## Endpoints

### Health

#### `GET /api/health`

Check API server status. No authentication required.

**Response** `200`
```json
{
  "status": "ok",
  "timestamp": "2026-08-10T12:00:00.000Z"
}
```

---

### Auth

#### `POST /api/auth/sso`

Authenticate using an Azure AD ID token (RS256/JWKS).

**Headers**
```
Authorization: Bearer <azure-ad-id-token>
```

**Response** `200` — Same as login. Creates or updates the employee record automatically.

---

#### `GET /api/auth/me`

Get current user's profile. **Requires auth.**

**Response** `200`
```json
{
  "employee": {
    "_id": "64a...",
    "employeeId": "EMP001",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "department": "Engineering",
    "role": "employee",
    "isActive": true
  }
}
```

---

### Events

#### `GET /api/events`

List all events. **Requires auth.**

- Employees see only `active` events.
- Admins see all statuses (`draft`, `active`, `closed`, `completed`).

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Items per page (max 100) |

**Response** `200`
```json
{
  "events": [
    {
      "_id": "64a...",
      "title": "Colours Day 2026",
      "eventDate": "2026-09-15T09:00:00.000Z",
      "venue": "UST Campus Auditorium",
      "status": "active",
      "maxCapacity": 500,
      "bookingCount": 120,
      "checkedInCount": 45,
      "timeSlots": [],
      "foodOptions": []
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

#### `GET /api/events/:id`

Get event details. **Requires auth.**

**Response** `200`
```json
{
  "event": {
    "_id": "64a...",
    "title": "Colours Day 2026",
    "bookingCount": 120,
    "checkedInCount": 45,
    "foodBreakdown": { "Vegetarian": 60, "Non-Vegetarian": 60 },
    "slotCounts": { "Morning": 80, "Afternoon": 40 }
  },
  "userBooking": null
}
```

`userBooking` is the current user's booking for this event, or `null` if not booked.

---

#### `POST /api/events`

Create a new event. **Admin only.**

**Request Body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | Yes | 2-200 chars |
| `eventDate` | ISO 8601 | Yes | Event date/time |
| `venue` | string | Yes | 2-200 chars |
| `location` | string | No | Max 300 chars |
| `registrationStart` | ISO 8601 | Yes | When registration opens |
| `registrationEnd` | ISO 8601 | Yes | When registration closes |
| `maxCapacity` | integer | No | 0 = unlimited |
| `status` | string | No | `draft`, `active`, `completed`, `cancelled` |
| `description` | string | No | Event description |
| `timeSlots` | array | No | See below |
| `foodOptions` | array | No | See below |

**Time Slot Object:**
```json
{ "label": "Morning", "startTime": "09:00", "endTime": "12:00", "maxCapacity": 250 }
```

**Food Option Object:**
```json
{ "name": "Vegetarian", "description": "Pure veg meals", "maxQuantity": 100 }
```

**Response** `201`
```json
{ "event": { ... } }
```

---

#### `PUT /api/events/:id`

Update an event. **Admin only.** All fields are optional.

**Response** `200`

---

#### `DELETE /api/events/:id`

Delete an event and cancel all associated bookings. **Admin only.**

**Response** `200`
```json
{ "message": "Event deleted" }
```

---

### Bookings

#### `POST /api/bookings`

Create a booking for the current user. **Requires auth.**

**Request Body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `eventId` | ObjectId | Yes | Must be an active event |
| `foodPreference` | string | Yes | 1-100 chars |
| `timeSlotId` | ObjectId | No | Required if event has time slots |

**Business Rules:**
- One booking per employee per event
- Event must be `active` with open registration window
- Event-level and slot-level capacity limits are enforced

**Response** `201`
```json
{
  "booking": {
    "_id": "64b...",
    "employee": { "_id": "64a...", "name": "John Doe", "employeeId": "EMP001" },
    "event": { "_id": "64a...", "title": "Colours Day 2026" },
    "foodPreference": "Vegetarian",
    "status": "confirmed",
    "qrCode": "data:image/png;base64,...",
    "qrData": "QPASS-64b...-1723..."
  }
}
```

---

#### `GET /api/bookings/my`

Get all bookings for the current user. **Requires auth.**

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Items per page (max 100) |

**Response** `200`
```json
{
  "bookings": [
    {
      "_id": "64b...",
      "event": {
        "_id": "64a...",
        "title": "Colours Day 2026",
        "eventDate": "2026-09-15T09:00:00.000Z",
        "venue": "UST Campus Auditorium"
      },
      "foodPreference": "Vegetarian",
      "status": "confirmed",
      "qrCode": "data:image/png;base64,..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

#### `GET /api/bookings/:id`

Get a single booking. **Requires auth.**

- Employees can view their own bookings only.
- Admins/volunteers can view any booking.
- QR code is generated on-demand if not present.

---

#### `DELETE /api/bookings/:id`

Cancel a booking. **Requires auth.**

- Employees can cancel their own bookings.
- Admins can cancel any booking.
- Cannot cancel after check-in.

---

#### `POST /api/bookings/scan`

Scan a QR code for check-in. **Admin or Volunteer only.**

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `qrData` | string | Yes (1-500 chars) |

**Response Scenarios:**

| Status | Scenario | Key Fields |
|--------|----------|------------|
| `200` | Successful check-in | `{ valid: true, booking: {...} }` |
| `400` | Walk-in QR detected | `{ message: "walk_in_qr", isWalkInQR: true, qrData }` |
| `400` | Already checked in | `{ message: "Already checked in" }` |
| `400` | Booking cancelled | `{ message: "Booking is cancelled" }` |
| `404` | Invalid QR | `{ message: "Invalid QR code" }` |

---

#### `POST /api/bookings/lookup`

Look up bookings by employee ID. **Admin or Volunteer only.**

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `employeeId` | string | Yes (1-20 chars, alphanumeric) |
| `eventId` | string | No |

---

### Walk-ins

#### `POST /api/walkins`

Register a walk-in attendee. **Admin or Volunteer only.**

**Request Body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `eventId` | ObjectId | Yes | |
| `attendeeType` | string | Yes | `guest`, `staff`, `housekeeping`, `unregistered_employee` |
| `name` | string | No | Max 100 chars |
| `phone` | string | No | Max 20 chars |
| `email` | string | No | Valid email |
| `department` | string | No | Max 100 chars |
| `notes` | string | No | Max 500 chars |
| `employeeId` | string | No | For unregistered employees |
| `foodPreference` | string | No | |
| `timeSlotId` | ObjectId | No | |

**Response** `201`
```json
{
  "message": "Walk-in registered successfully",
  "walkIn": { ... }
}
```

---

#### `POST /api/walkins/scan`

Scan a walk-in category QR code. **Admin or Volunteer only.**

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `qrData` | string | Yes (1-500 chars) |
| `name` | string | No |
| `phone` | string | No |
| `department` | string | No |
| `foodPreference` | string | No |
| `notes` | string | No |

**Response** `201`
```json
{
  "message": "Walk-in registered",
  "walkIn": { ... },
  "typeCount": 5,
  "attendeeType": "guest"
}
```

---

#### `GET /api/walkins/event/:eventId/qrcodes`

Get the 4 walk-in category QR codes for an event. **Admin or Volunteer only.**

Returns one QR code per attendee type (`guest`, `staff`, `housekeeping`, `unregistered_employee`). Print these for check-in stations.

---

#### `GET /api/walkins/event/:eventId`

List walk-in attendees for an event. **Admin or Volunteer only.**

**Query Parameters**

| Param | Description |
|-------|-------------|
| `type` | Filter by attendee type |
| `search` | Search name, phone, email, employee ID |
| `page` | Page number (default: 1) |
| `limit` | Items per page (default: 20, max 100) |

**Response** `200`
```json
{
  "walkIns": [],
  "stats": {
    "total": 25,
    "guest": 12,
    "staff": 8,
    "housekeeping": 3,
    "unregisteredEmployee": 2
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "totalPages": 2,
    "hasMore": true
  }
}
```

---

### Admin

#### `GET /api/admin/dashboard`

Admin dashboard statistics. **Admin only.**

Returns: `totalEmployees`, `totalEvents`, `activeEvents`, `totalBookings`, `totalCheckedIn`, `totalWalkIns`, `walkInStats`, and all events with per-event booking, check-in, and walk-in stats.

> **Note:** The response key for events was changed from `recentEvents` to `events`.

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number (applies to events list) |
| `limit` | integer | `20` | Items per page (max 100) |

**Response** `200`
```json
{
  "stats": {
    "totalEmployees": 150,
    "totalEvents": 5,
    "activeEvents": 2,
    "totalBookings": 320,
    "totalCheckedIn": 180,
    "totalWalkIns": 45
  },
  "events": [
    {
      "_id": "64a...",
      "title": "Colours Day 2026",
      "eventDate": "2026-09-15T09:00:00.000Z",
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

#### `GET /api/admin/events/:eventId/bookings`

Get bookings for an event with filters. **Admin only.**

**Query Parameters**

| Param | Values |
|-------|--------|
| `status` | `confirmed`, `checked_in`, `cancelled` |
| `role` | `employee`, `admin`, `volunteer` |
| `food` | Food preference string |
| `search` | Name or employee ID |
| `slot` | Time slot label |
| `page` | Page number (default: 1) |
| `limit` | Items per page (default: 20, max 100) |

**Response** `200`
```json
{
  "bookings": [
    {
      "_id": "64b...",
      "employee": { "employeeId": "EMP001", "name": "John Doe", "department": "Engineering" },
      "foodPreference": "Vegetarian",
      "status": "confirmed",
      "timeSlotLabel": "Morning"
    }
  ],
  "stats": {
    "total": 120,
    "confirmed": 75,
    "checkedIn": 40,
    "cancelled": 5
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 120,
    "totalPages": 6,
    "hasMore": true
  }
}
```

---

#### `GET /api/admin/events/:eventId/report`

Comprehensive event report. **Admin only.**

Returns: event details, attendee classification (registered vs walk-in), food breakdown, slot breakdown, check-in timeline, and full booking/walk-in lists.

---

#### `GET /api/admin/events/:eventId/report/download`

Download event report as CSV. **Admin only.**

Response: `Content-Type: text/csv` file download.

---

#### `GET /api/admin/employees`

List employees. **Admin only.**

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | | Search by name, email, or employee ID |
| `role` | string | | Filter by role: `employee`, `admin`, `volunteer` |
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Items per page (max 100) |

**Response** `200`
```json
{
  "employees": [
    {
      "_id": "64a...",
      "employeeId": "EMP001",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "department": "Engineering",
      "role": "employee",
      "isActive": true
    }
  ],
  "total": 150,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasMore": true
  }
}
```

---

#### `PATCH /api/admin/employees/:id/role`

Update an employee's role. **Admin only.**

**Request Body**
```json
{ "role": "volunteer" }
```

Allowed values: `employee`, `admin`, `volunteer`

---

#### `GET /api/admin/role-users`

List pre-assigned role users (admin/volunteer whitelist). **Admin only.**

---

#### `POST /api/admin/role-users`

Add a role user to the whitelist. **Admin only.**

**Request Body**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes (valid email) |
| `role` | string | Yes (`admin` or `volunteer`) |
| `name` | string | No (max 100 chars) |

If email already exists, the role is updated (returns `200` instead of `201`).

---

#### `DELETE /api/admin/role-users/:id`

Remove a role user from the whitelist. **Admin only.**

---

## Data Models

### Employee

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `employeeId` | string | Unique, uppercase, max 20 |
| `name` | string | Max 100 |
| `email` | string | Unique, lowercase |
| `department` | string | Max 100 |
| `phone` | string | Max 20 |
| `role` | enum | `employee` / `admin` / `volunteer` |
| `isActive` | boolean | Default `true` |
| `createdAt` | Date | Auto |
| `updatedAt` | Date | Auto |

> Authentication is handled via Azure AD SSO — no passwords are used in production.

### Event

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `title` | string | |
| `description` | string | |
| `eventDate` | Date | |
| `venue` | string | |
| `location` | string | |
| `registrationStart` | Date | |
| `registrationEnd` | Date | |
| `maxCapacity` | number | 0 = unlimited |
| `timeSlots` | array | `{ label, startTime, endTime, maxCapacity }` |
| `foodOptions` | array | `{ name, description, maxQuantity }` |
| `status` | enum | `draft` / `active` / `closed` / `completed` |
| `createdBy` | ObjectId | Ref: Employee |
| `bannerImage` | string | |

### Booking

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `employee` | ObjectId | Ref: Employee |
| `event` | ObjectId | Ref: Event |
| `timeSlot` | ObjectId | Slot ID within event |
| `timeSlotLabel` | string | Denormalized label |
| `slotColor` | string | Hex color for UI |
| `foodPreference` | string | |
| `qrCode` | string | Base64 data URL |
| `qrData` | string | Unique, `QPASS-{id}-{timestamp}` |
| `status` | enum | `confirmed` / `cancelled` / `checked_in` |
| `checkedInAt` | Date | Set on check-in |
| `checkedInBy` | ObjectId | Ref: Employee |

> Unique compound index on `(employee, event)` — one booking per person per event.

### WalkIn

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `event` | ObjectId | Ref: Event |
| `attendeeType` | enum | `guest` / `staff` / `housekeeping` / `unregistered_employee` |
| `name` | string | |
| `phone` | string | |
| `email` | string | |
| `department` | string | |
| `employeeId` | string | |
| `foodPreference` | string | |
| `notes` | string | |
| `checkedInAt` | Date | Auto-set on creation |
| `checkedInBy` | ObjectId | Ref: Employee |

### RoleUser

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `email` | string | Unique, lowercase |
| `name` | string | |
| `role` | enum | `admin` / `volunteer` |
| `isActive` | boolean | Default `true` |
| `addedBy` | string | |

---

## Postman Collection

Import the included `UST-QPass-API.postman_collection.json` file into Postman to get a ready-to-use collection with:

- All 29 endpoints organized by category
- Pre-configured request bodies with sample data
- Auto-save scripts that store tokens, event IDs, and booking IDs
- Example responses for each endpoint
- Collection-level Bearer auth (override per-request for admin endpoints)

### Quick Start

1. **Import** the `.json` file into Postman
2. **Set** `baseUrl` variable (default: `http://localhost:5001/api`)
3. **Run** "SSO Login (Azure AD)" with a valid Azure AD token — the JWT is auto-saved to `authToken` (and `adminToken` if the user has admin role)
4. **Create an Event** — the event ID is auto-saved
5. **Create a Booking** — the booking ID is auto-saved
6. Explore the remaining endpoints
