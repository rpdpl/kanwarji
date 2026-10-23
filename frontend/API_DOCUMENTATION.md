# Order Cancellation API Documentation

## Base URL
```
http://localhost:5000/api
https://your-api-domain.com/api
```

## Authentication
All endpoints require JWT token in header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## User Endpoints

### 1. Request Order Cancellation

**Endpoint**: `POST /orders/{orderId}/request-cancellation`

**Authentication**: Required (User)

**Parameters**:
- `orderId` (path): Order MongoDB ID or Order ID string

**Request Body**:
```json
{
  "reason": "string (required, max 500 chars)"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Cancellation request submitted successfully. Our admin team will review it shortly.",
  "orderId": "ORD-001",
  "orderStatus": "cancellation-pending",
  "requestId": "507f1f77bcf86cd799439011"
}
```

**Error Responses**:
- 400: Invalid reason or missing parameters
- 400: Order not found or doesn't belong to user
- 400: Order status not cancellable (already delivered/cancelled)
- 400: Cancellation request already pending for this order
- 500: Server error

**Example cURL**:
```bash
curl -X POST http://localhost:5000/api/orders/123456789abc/request-cancellation \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Changed my mind about this product"
  }'
```

---

### 2. Get User's Cancellation Requests

**Endpoint**: `GET /user/cancellation-requests`

**Authentication**: Required (User)

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 5): Items per page
- `status` (optional): Filter by status (pending/approved/rejected)

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "orderId": "507f1f77bcf86cd799439010",
        "orderIdStr": "ORD-001",
        "userId": "507f1f77bcf86cd799439009",
        "customerName": "John Doe",
        "customerEmail": "john@example.com",
        "customerPhone": "9876543210",
        "cancellationReason": "Changed my mind",
        "status": "pending",
        "totalAmount": 2999.99,
        "paymentMethod": "online",
        "paymentStatus": "paid",
        "paymentId": "pay_123456",
        "items": [
          {
            "name": "Fresh Apples",
            "quantity": 2,
            "price": 150
          }
        ],
        "address": {
          "name": "John Doe",
          "phone": "9876543210",
          "address": "123 Main St",
          "city": "Delhi",
          "state": "Delhi",
          "pincode": "110001"
        },
        "adminRemarks": "",
        "adminResponse": "",
        "createdAt": "2024-01-29T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false,
      "totalRequests": 15
    }
  }
}
```

**Error Responses**:
- 401: Unauthorized
- 500: Server error

**Example cURL**:
```bash
curl -X GET "http://localhost:5000/api/user/cancellation-requests?page=1&limit=5" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

### 3. Get Single Cancellation Request

**Endpoint**: `GET /user/cancellation-requests/{requestId}`

**Authentication**: Required (User)

**Parameters**:
- `requestId` (path): Cancellation request MongoDB ID

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "orderId": "507f1f77bcf86cd799439010",
    "orderIdStr": "ORD-001",
    "status": "approved",
    "cancellationReason": "Changed my mind",
    "totalAmount": 2999.99,
    "paymentMethod": "online",
    "paymentStatus": "paid",
    "adminRemarks": "Refund approved - within refund window",
    "adminResponse": "",
    "processedAt": "2024-01-29T11:00:00.000Z",
    "createdAt": "2024-01-29T10:00:00.000Z"
  }
}
```

**Error Responses**:
- 404: Request not found
- 401: Unauthorized
- 500: Server error

---

## Admin Endpoints

### 1. Get All Cancellation Requests

**Endpoint**: `GET /admin/cancellation-requests`

**Authentication**: Required (Admin)

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 10): Items per page
- `status` (optional): Filter by status (pending/approved/rejected/all)
- `search` (optional): Search by order ID or customer name

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "orderId": "507f1f77bcf86cd799439010",
        "orderIdStr": "ORD-001",
        "userId": "507f1f77bcf86cd799439009",
        "customerName": "John Doe",
        "customerEmail": "john@example.com",
        "customerPhone": "9876543210",
        "cancellationReason": "Changed my mind",
        "status": "pending",
        "totalAmount": 2999.99,
        "paymentMethod": "online",
        "paymentStatus": "paid",
        "items": [...],
        "address": {...},
        "createdAt": "2024-01-29T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

**Error Responses**:
- 401: Unauthorized / Not admin
- 500: Server error

---

### 2. Get Request Details (Admin View)

**Endpoint**: `GET /admin/cancellation-requests/{requestId}`

**Authentication**: Required (Admin)

**Parameters**:
- `requestId` (path): Cancellation request MongoDB ID

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "orderIdStr": "ORD-001",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": "9876543210",
    "cancellationReason": "Changed my mind",
    "status": "pending",
    "totalAmount": 2999.99,
    "paymentMethod": "online",
    "paymentStatus": "paid",
    "items": [...],
    "address": {...},
    "userId": {
      "_id": "507f1f77bcf86cd799439009",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210"
    },
    "processedBy": null,
    "createdAt": "2024-01-29T10:00:00.000Z"
  }
}
```

---

### 3. Approve Cancellation Request

**Endpoint**: `PATCH /admin/cancellation-requests/{requestId}/approve`

**Authentication**: Required (Admin)

**Parameters**:
- `requestId` (path): Cancellation request MongoDB ID

**Request Body**:
```json
{
  "adminRemarks": "string (optional, max 500 chars)"
}
```

**Actions Performed**:
1. Updates CancellationRequest status to "approved"
2. Updates Order status to "cancelled"
3. Marks order payment as "refunded" (if online paid)
4. Cancels shipment in Shiprocket (if applicable)
5. Sends approval email to user

**Success Response** (200):
```json
{
  "success": true,
  "message": "Cancellation request approved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "approved",
    "adminRemarks": "Refund approved - within refund window",
    "processedAt": "2024-01-29T11:00:00.000Z",
    "processedBy": "507f1f77bcf86cd799439008"
  }
}
```

**Error Responses**:
- 400: Request not pending
- 404: Request not found
- 401: Unauthorized / Not admin
- 500: Server error

**Example cURL**:
```bash
curl -X PATCH http://localhost:5000/api/admin/cancellation-requests/507f1f77bcf86cd799439011/approve \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "adminRemarks": "Approved for refund - within processing window"
  }'
```

---

### 4. Reject Cancellation Request

**Endpoint**: `PATCH /admin/cancellation-requests/{requestId}/reject`

**Authentication**: Required (Admin)

**Parameters**:
- `requestId` (path): Cancellation request MongoDB ID

**Request Body**:
```json
{
  "adminRemarks": "string (optional)",
  "adminResponse": "string (required - reason for rejection)"
}
```

**Actions Performed**:
1. Updates CancellationRequest status to "rejected"
2. Sends rejection email to user
3. Order remains in current status (not cancelled)

**Success Response** (200):
```json
{
  "success": true,
  "message": "Cancellation request rejected successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "rejected",
    "adminRemarks": "Already in transit",
    "adminResponse": "We cannot cancel orders that are already in transit",
    "processedAt": "2024-01-29T11:00:00.000Z",
    "processedBy": "507f1f77bcf86cd799439008"
  }
}
```

**Error Responses**:
- 400: Request not pending
- 404: Request not found
- 401: Unauthorized / Not admin
- 500: Server error

**Example cURL**:
```bash
curl -X PATCH http://localhost:5000/api/admin/cancellation-requests/507f1f77bcf86cd799439011/reject \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "adminRemarks": "Order already dispatched",
    "adminResponse": "We cannot cancel orders that are already in transit"
  }'
```

---

## Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful operation |
| 400 | Bad Request | Invalid input or invalid state |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Admin-only endpoint, user not admin |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Internal server error |

---

## Data Models

### CancellationRequest Object
```typescript
{
  _id: ObjectId,
  orderId: ObjectId,              // Reference to Order
  userId: ObjectId,               // Reference to User
  orderIdStr: string,             // Display order ID
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  cancellationReason: string,
  status: "pending" | "approved" | "rejected",
  totalAmount: number,
  paymentMethod: "online" | "cod",
  paymentStatus: "paid" | "unpaid",
  paymentId?: string,
  items: OrderItem[],
  address: {
    name: string,
    phone: string,
    address: string,
    city: string,
    state: string,
    pincode: string
  },
  adminRemarks: string,
  adminResponse: string,
  processedBy?: ObjectId,
  processedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### OrderItem Object
```typescript
{
  name: string,
  quantity: number,
  price: number,
  unit?: string,
  variantLabel?: string
}
```

---

## Rate Limiting

Recommended rate limits for production:
- **Request Cancellation**: 5 requests per hour per user
- **Admin Approval/Rejection**: No limit (admin action)

---

## Webhooks (Optional Future Feature)

Could add webhooks for:
- `cancellation.requested`
- `cancellation.approved`
- `cancellation.rejected`
- `refund.processed`

---

## Error Response Format

All error responses follow this format:
```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE" (optional)
}
```

---

## Pagination Format

All paginated responses include:
```json
{
  "data": {
    "requests": [...],
    "pagination": {
      "currentPage": number,
      "totalPages": number,
      "hasNextPage": boolean,
      "hasPrevPage": boolean,
      "totalRequests": number
    }
  }
}
```

---

## Best Practices

1. **Always include reason**: Provide cancellation reason for better tracking
2. **Add admin remarks**: Help track decision rationale
3. **Handle errors gracefully**: Show user-friendly messages
4. **Implement retry logic**: For network failures
5. **Log all actions**: For audit trail
6. **Validate on frontend**: Before sending to backend
7. **Use proper status codes**: For error handling

---

## Webhook Events (Future)

When implemented, events will be:
```json
{
  "event": "cancellation.requested",
  "timestamp": "2024-01-29T10:00:00Z",
  "data": {
    "requestId": "507f1f77bcf86cd799439011",
    "orderId": "ORD-001",
    "userId": "507f1f77bcf86cd799439009"
  }
}
```

---

## Versioning

**Current Version**: v1
**API Version**: /api/v1 (future)

Future changes will use version prefix: `/api/v2/...`

---

**Last Updated**: January 29, 2026
**API Status**: ✅ Production Ready
