# Order Cancellation System - Visual Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │   Profile Page   │         │  Cancel Modal    │              │
│  │  - Orders Tab    │◄───────►│ (CancelOrderModal)              │
│  │  - Cancellations │         │ - Show Order Info│              │
│  │    Tab           │         │ - Get Reason     │              │
│  └──────────────────┘         │ - Submit Request │              │
│         ▲ │                   └──────────────────┘              │
│         │ │                                                      │
│   Loads │ │ POST /api/orders/:id/request-cancellation         │
│  Request│ │                                                      │
│         │ ▼                                                      │
│  ┌──────────────────┐                                            │
│  │ Cancellations    │                                            │
│  │ Request View     │                                            │
│  │ (inline component)                                            │
│  │ - List requests  │                                            │
│  │ - Filter by      │                                            │
│  │   status         │                                            │
│  └──────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │   Express.js Backend      │
                    │   (Node.js Server)        │
                    └───────────────────────────┘
                      │              │         │
          ┌───────────┼──────────────┼─────────┘
          │           │              │
          ▼           ▼              ▼
    ┌──────────┐ ┌───────────┐ ┌─────────────┐
    │ MongoDB  │ │ Shiprocket│ │ Email       │
    │ Database │ │  Service  │ │ Service     │
    │          │ │           │ │ (Mailer)    │
    │ - Orders │ │ - Cancel  │ │ - Send      │
    │ - Users  │ │   Order   │ │   Emails    │
    │ - Cancellation         │ │   to User   │
    │   Requests             │ └─────────────┘
    └──────────┘ └───────────┘
         │
         │ User Email
         │ Notifications
         ▼
    ┌──────────────┐
    │ User's Email │
    │ (Gmail, etc) │
    └──────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER SIDE FLOW                              │
└─────────────────────────────────────────────────────────────────┘

  User in Profile
       │
       ├─ Orders Tab
       │   │
       │   ├─ Views Order: ORD-001
       │   │
       │   └─ Clicks "Cancel Order"
       │       │
       │       ▼
       │   CancelOrderModal Opens
       │   ├─ Shows Order Details
       │   ├─ User Enters Reason
       │   └─ Clicks "Request Cancellation"
       │       │
       │       ▼ POST /api/orders/{id}/request-cancellation
       │   Backend Processes
       │   ├─ Validates Order & User
       │   ├─ Creates CancellationRequest
       │   │  (status: pending)
       │   ├─ Updates Order.status
       │   │  = "cancellation-pending"
       │   └─ Sends Confirmation Email
       │       │
       │       ▼
       │   ✓ Success Message
       │   "Request submitted..."
       │
       └─ Cancellations Tab
           │
           ├─ Views All Requests
           │
           ├─ Sees New Request
           │  Status: pending (🟡)
           │
           └─ Refreshes Page
              Status Updated
              (if admin decided)


┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN SIDE FLOW                              │
└─────────────────────────────────────────────────────────────────┘

  Admin Dashboard
       │
       └─ Cancellations Tab
           │
           ├─ Views All Requests
           │  Status Filter: pending
           │
           ├─ Search: "ORD-001"
           │   Finds Request
           │
           └─ Clicks Request Card
               │
               ├─ Sees Customer Info
               ├─ Sees Order Details
               ├─ Sees Items List
               ├─ Sees Cancellation Reason
               │
               └─ Decision Panel
                   │
                   ├─ Option 1: APPROVE
                   │   │
                   │   ├─ Adds Remarks (optional)
                   │   └─ Clicks "Approve"
                   │       │
                   │       ▼ PATCH /admin/.../approve
                   │       Backend:
                   │       ├─ Updates request.status
                   │       │  = "approved"
                   │       ├─ Updates order.status
                   │       │  = "cancelled"
                   │       ├─ Marks payment
                   │       │  = "refunded"
                   │       ├─ Calls Shiprocket
                   │       │  Cancel Shipment
                   │       ├─ Sends Approval Email
                   │       └─ Records Admin Info
                   │           & Timestamp
                   │
                   └─ Option 2: REJECT
                       │
                       ├─ Adds Remarks
                       ├─ Adds Response Reason
                       └─ Clicks "Reject"
                           │
                           ▼ PATCH /admin/.../reject
                           Backend:
                           ├─ Updates request.status
                           │  = "rejected"
                           ├─ Sends Rejection Email
                           └─ Records Admin Info
                               & Timestamp


┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND PROCESSING FLOW                        │
└─────────────────────────────────────────────────────────────────┘

  POST Request Received
       │
       ├─ Authenticate User
       ├─ Extract Order ID
       ├─ Extract Reason
       │
       └─ Validation Block
           ├─ ✓ Order exists?
           ├─ ✓ Order belongs to user?
           ├─ ✓ Order cancellable?
           │  (pending/confirmed/processing)
           ├─ ✓ No pending request?
           │
           ├─ If Invalid:
           │  └─ Return Error 400
           │
           └─ If Valid:
               │
               ├─ Create CancellationRequest
               │  {
               │    orderId,
               │    userId,
               │    orderIdStr,
               │    cancellationReason,
               │    status: "pending",
               │    totalAmount,
               │    paymentMethod,
               │    paymentStatus,
               │    items,
               │    address
               │  }
               │
               ├─ Save to Database
               │
               ├─ Update Order
               │  order.orderStatus = "cancellation-pending"
               │  order.updatedAt = now
               │
               ├─ Send Email
               │  To: user.email
               │  Subject: "Cancellation Request Received"
               │  Body: HTML template with order info
               │
               └─ Return Success
                  {
                    success: true,
                    requestId,
                    orderStatus: "cancellation-pending"
                  }


  ADMIN APPROVES REQUEST
       │
       ├─ Authenticate Admin
       ├─ Extract Request ID
       ├─ Extract Admin Remarks
       │
       ├─ Get Request from DB
       ├─ Get Order from DB
       ├─ Validate Status = "pending"
       │
       └─ If Valid:
           │
           ├─ Update CancellationRequest
           │  ├─ status = "approved"
           │  ├─ adminRemarks = remarks
           │  ├─ processedBy = admin._id
           │  └─ processedAt = now
           │
           ├─ Update Order
           │  ├─ orderStatus = "cancelled"
           │  ├─ cancelledAt = now
           │  └─ paymentStatus = "refunded" (if paid)
           │
           ├─ Call Shiprocket
           │  ├─ If AWB number exists
           │  └─ cancelOrder(awbNumber)
           │     ├─ Success: Shipment cancelled
           │     └─ Error: Log & continue
           │
           ├─ Send Approval Email
           │  To: user.email
           │  Subject: "Order Cancellation Approved"
           │  Body: HTML with refund info
           │
           └─ Return Success
```

## Request/Response Flow

```
┌─────────────────────────────┐
│  USER REQUEST               │
│  POST /api/orders/.../...   │
│                             │
│  Headers:                   │
│  - Authorization: Bearer... │
│  - Content-Type: app/json   │
│                             │
│  Body:                      │
│  {                          │
│    "reason": "string"       │
│  }                          │
└────────────┬────────────────┘
             │
             ▼
      ┌──────────────┐
      │   Middleware │
      │ - Validate   │
      │ - Auth       │
      └──────┬───────┘
             │
             ▼
      ┌──────────────────────────────┐
      │   Controller Function        │
      │ - Check order exists         │
      │ - Check owner               │
      │ - Check status              │
      │ - Check no pending request   │
      └──────┬───────────────────────┘
             │
             ▼
      ┌──────────────────────────────┐
      │   Database Operations        │
      │ - Create CancellationRequest │
      │ - Update Order status        │
      └──────┬───────────────────────┘
             │
             ▼
      ┌──────────────────────────────┐
      │   Send Email                 │
      │ - Compose HTML email         │
      │ - Send via SMTP              │
      └──────┬───────────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  SUCCESS RESPONSE           │
│  Status: 200 OK             │
│                             │
│  Body:                      │
│  {                          │
│    "success": true,         │
│    "message": "...",        │
│    "orderId": "...",        │
│    "orderStatus":           │
│      "cancellation-pending",│
│    "requestId": "..."       │
│  }                          │
└─────────────────────────────┘
```

## Database Schema Relationships

```
┌──────────────────────────┐
│        USER              │
├──────────────────────────┤
│ _id                      │
│ name                     │
│ email                    │
│ phone                    │
│ userType                 │
│ ...                      │
└────────────┬─────────────┘
             │ 1
             │
             │ References
             │
             │ Many
             ▼
┌──────────────────────────────┐
│        ORDER                 │
├──────────────────────────────┤
│ _id                          │
│ orderId (string)             │
│ userId ──────────────────────┤─ To USER
│ items []                     │
│ address                      │
│ paymentMethod                │
│ paymentStatus                │
│ orderStatus                  │
│ totalAmount                  │
│ awbNumber (Shiprocket)       │
│ createdAt                    │
│ ...                          │
└────────────┬─────────────────┘
             │ 1
             │
             │ References
             │
             │ Many
             ▼
┌────────────────────────────────────┐
│   CANCELLATION REQUEST             │
├────────────────────────────────────┤
│ _id                                │
│ orderId ────────────────────────────┤─ To ORDER
│ userId ─────────────────────────────┤─ To USER
│ orderIdStr (for display)            │
│ customerName / Email / Phone        │
│ cancellationReason                  │
│ status (pending/approved/rejected)  │
│ totalAmount                         │
│ paymentMethod / paymentStatus       │
│ items []                            │
│ address                             │
│ adminRemarks                        │
│ adminResponse                       │
│ processedBy ────────────────────────┤─ To USER (admin)
│ processedAt                         │
│ createdAt                           │
│ updatedAt                           │
└────────────────────────────────────┘
```

## Email Flow

```
Backend Service
       │
       ├─ User Submits Request
       │  │
       │  └─ Send Email Type 1
       │     "Cancellation Request Received"
       │     ├─ Recipient: user.email
       │     ├─ Order ID
       │     ├─ Order Total
       │     ├─ Status: Under Review
       │     └─ Refund Info (if applicable)
       │
       ├─ Admin Approves
       │  │
       │  └─ Send Email Type 2
       │     "Order Cancellation Approved"
       │     ├─ Recipient: user.email
       │     ├─ Order ID
       │     ├─ Approval Confirmation
       │     ├─ Refund Amount
       │     ├─ Refund Timeline (3-5 days)
       │     └─ Admin Remarks
       │
       └─ Admin Rejects
          │
          └─ Send Email Type 3
             "Order Cancellation Request"
             ├─ Recipient: user.email
             ├─ Order ID
             ├─ Rejection Status
             ├─ Rejection Reason
             ├─ Admin Notes
             └─ Support Contact
```

## Status Transitions

```
Order Status Flow:
  ┌─────────────┐
  │  pending    │
  │ confirmed   │◄──── Initial States
  │ processing  │
  └──────┬──────┘
         │
         │ User Requests Cancellation
         │
         ▼
  ┌──────────────────────┐
  │ cancellation-pending │◄──── Awaiting Admin Review
  └──────┬───────────────┘
         │
    ┌────┴────┐
    │          │
    │          │ Admin Rejects
    │          │
    │          ▼
    │    ┌──────────────┐
    │    │ confirmed    │◄──── Order Remains Active
    │    │ pending      │
    │    │ processing   │
    │    └──────────────┘
    │
    │ Admin Approves
    │
    ▼
  ┌──────────┐
  │ cancelled│◄──── Order Cancelled, Refund Processing
  └──────────┘


CancellationRequest Status Flow:
  
  (User Creates)
  ┌─────────┐
  │ pending │◄──── Awaiting Admin Review
  └────┬────┘
       │
   ┌───┴────┐
   │         │
   │         │ Admin Rejects
   │         │
   │         ▼
   │    ┌──────────┐
   │    │ rejected │◄──── Request Declined
   │    └──────────┘
   │
   │ Admin Approves
   │
   ▼
  ┌──────────┐
  │ approved │◄──── Request Approved, Order Cancelled
  └──────────┘
```

## Component Tree

```
App
└── Profile
    ├── Profile Overview Tab
    ├── Profile Orders Tab
    │   ├── Order List
    │   ├── CancelOrderModal (when user clicks Cancel)
    │   │   ├── Order Details Display
    │   │   ├── Refund Info
    │   │   ├── Reason Input
    │   │   └── Submit/Cancel Buttons
    │   │
    │   └── Order Pagination
    │
    ├── Profile Cancellations Tab (NEW)
    │   └── CancellationRequestsComponent
    │       ├── Request List
    │       │   ├── Request Card
    │       │   │   ├─ Order ID & Date
    │       │   │   ├─ Status Badge
    │       │   │   ├─ Reason Display
    │       │   │   └─ Status-specific Message
    │       │   │
    │       │   └── For Each Status:
    │       │       ├─ Pending: "Under Review"
    │       │       ├─ Approved: "Approved, Refund Processing"
    │       │       └─ Rejected: "Rejected, Details..."
    │       │
    │       └── Pagination Controls
    │
    └── Settings Tab
        └── Edit Profile
            └── Settings Options
```

## Deployment Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Production Environment               │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐    │
│  │          │      │          │      │          │    │
│  │ Frontend │      │  Admin   │      │ Backend  │    │
│  │ (React)  │      │ (Next.js)│      │(Express) │    │
│  │          │      │          │      │          │    │
│  └────┬─────┘      └────┬─────┘      └────┬─────┘    │
│       │ HTTPS           │ HTTPS            │ HTTPS    │
│       └────────────┬────┴────────┬─────────┘          │
│                    │             │                    │
│                    ▼             ▼                    │
│              ┌──────────────────────┐               │
│              │   Load Balancer      │               │
│              └──────────┬───────────┘               │
│                         │                           │
│                         ▼                           │
│            ┌──────────────────────────┐            │
│            │   API Gateway / Proxy    │            │
│            └──────────┬───────────────┘            │
│                       │                             │
│                       ▼                             │
│        ┌──────────────────────────────┐           │
│        │   Express.js Server (Node)   │           │
│        │  - Cancellation Endpoints    │           │
│        │  - Order Routes              │           │
│        │  - User Routes               │           │
│        └──────────┬────────────────────┘           │
│                   │                                │
│       ┌───────────┼───────────┐                   │
│       │           │           │                   │
│       ▼           ▼           ▼                   │
│    ┌────────┐ ┌───────┐ ┌──────────┐            │
│    │MongoDB │ │SMTP   │ │Shiprocket│            │
│    │Database│ │Service│ │  API     │            │
│    └────────┘ └───────┘ └──────────┘            │
│       │           │           │                   │
│       └─────┬─────┴─────┬─────┘                  │
│             │           │                        │
│             ▼ External Services                  │
│      ┌────────────────────────┐                 │
│      │  External APIs         │                 │
│      │  - Email Service       │                 │
│      │  - Payment Gateway     │                 │
│      │  - Shiprocket          │                 │
│      └────────────────────────┘                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

**Last Updated**: January 29, 2026
**Diagram Version**: 1.0
