# Order Cancellation Workflow System

## Overview
This document describes the complete order cancellation workflow system implemented across user, admin, and Shiprocket platforms.

---

## Workflow Flow

```
User Requests Cancellation
         ↓
Creates CancellationRequest (Status: Pending)
         ↓
Admin Reviews Request
         ↓
    ┌─────┬─────┐
    ↓     ↓
 Approve  Reject
    ↓     ↓
  Order Cancelled + Refund Initiated  Order Remains Active
    ↓
Shiprocket Shipment Cancelled
    ↓
Email Notification to User
```

---

## Components & Features

### 1. User Side (Frontend - React)

#### 1.1 Cancel Request Modal (`src/components/CancelOrderModal.jsx`)
- **File**: `src/components/CancelOrderModal.jsx`
- **Purpose**: Modal for users to request order cancellation
- **Features**:
  - Displays order details (ID, Amount, Status, Payment Method)
  - Shows refund information if applicable
  - Requires cancellation reason (mandatory)
  - Displays information about the approval process
  - Shows automatic refund processing timeline

#### 1.2 Profile Orders Tab Updates (`src/components/Profile.jsx`)
- **Updated Function**: `confirmCancelOrder()`
- **Changed Endpoint**: 
  - From: `/api/orders/{orderId}/cancel` (Direct cancellation)
  - To: `/api/orders/{orderId}/request-cancellation` (Request-based)
- **New Tab**: "Cancellations" tab in Profile
- **Inline Component**: `CancellationRequestsComponent()`
  - Displays all user's cancellation requests
  - Shows status (Pending/Approved/Rejected)
  - Displays reason and decision notes
  - Pagination support

#### 1.3 Cancellation Requests Page (`src/components/CancellationRequestsPage.jsx`)
- Standalone page to view cancellation requests
- Detailed view of each request with:
  - Order items list
  - Payment information
  - Status-specific messages
  - Refund timeline (if approved)
  - Admin notes and responses

---

### 2. Backend (Express.js)

#### 2.1 Database Schema
**CancellationRequestSchema** fields:
```javascript
{
  orderId: ObjectId,           // Reference to Order
  userId: ObjectId,            // Reference to User
  orderIdStr: String,          // Order ID string (for display)
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  cancellationReason: String,  // User's reason
  status: enum["pending", "approved", "rejected"],
  totalAmount: Number,
  paymentMethod: String,       // "online" or "cod"
  paymentStatus: String,       // "paid" or "unpaid"
  paymentId: String,           // For refunds
  items: Array,                // Order items
  address: Object,             // Shipping address
  adminRemarks: String,        // Admin's internal notes
  adminResponse: String,       // Response message to user
  processedBy: ObjectId,       // Admin who processed it
  processedAt: Date,
  createdAt: Date
}
```

#### 2.2 API Endpoints

##### A. User Endpoints

**1. Request Cancellation**
```
POST /api/orders/:orderId/request-cancellation
Authorization: Required
Body: { reason: string }

Response:
{
  success: true,
  message: "Cancellation request submitted...",
  orderId: string,
  orderStatus: "cancellation-pending",
  requestId: string
}
```

**2. Get User's Cancellation Requests**
```
GET /api/user/cancellation-requests?page=1&limit=5
Authorization: Required

Response:
{
  success: true,
  data: {
    requests: [CancellationRequest],
    pagination: { currentPage, totalPages, hasNextPage, hasPrevPage }
  }
}
```

**3. Get Single Request Details**
```
GET /api/user/cancellation-requests/:id
Authorization: Required

Response:
{
  success: true,
  data: CancellationRequest
}
```

##### B. Admin Endpoints

**1. Get All Cancellation Requests**
```
GET /api/admin/cancellation-requests?status=all
Authorization: Required (Admin)

Response:
{
  success: true,
  data: {
    requests: [CancellationRequest],
    pagination: {...}
  }
}
```

**2. Get Request Details**
```
GET /api/admin/cancellation-requests/:id
Authorization: Required (Admin)

Response:
{
  success: true,
  data: CancellationRequest
}
```

**3. Approve Cancellation Request**
```
PATCH /api/admin/cancellation-requests/:id/approve
Authorization: Required (Admin)
Body: { adminRemarks: string }

Actions:
1. Updates CancellationRequest.status = "approved"
2. Updates Order.orderStatus = "cancelled"
3. Marks payment as "refunded" (if online paid)
4. Calls Shiprocket to cancel shipment
5. Sends approval email to user

Response:
{
  success: true,
  message: "Cancellation request approved successfully",
  data: CancellationRequest
}
```

**4. Reject Cancellation Request**
```
PATCH /api/admin/cancellation-requests/:id/reject
Authorization: Required (Admin)
Body: { 
  adminRemarks: string,
  adminResponse: string 
}

Actions:
1. Updates CancellationRequest.status = "rejected"
2. Sends rejection email to user with reason
3. Order remains in current status

Response:
{
  success: true,
  message: "Cancellation request rejected successfully",
  data: CancellationRequest
}
```

---

### 3. Admin Panel (Next.js)

#### Location: `vikash_admin-main/src/app/(root)/pannel/page.tsx`

#### 3.1 Cancellations Tab
- Tab button with AlertCircle icon
- Search functionality (by Order ID or Customer Name)

#### 3.2 Request Display
For each cancellation request, displays:
- **Header Section**: Order ID, Request Date, Status Badge
- **Customer Details**: Name, Email, Phone, Address
- **Payment Info**: Method, Status, Amount
- **Order Items**: List of products with quantities and prices
- **Reason**: User's cancellation reason
- **Actions** (if status = "pending"):
  - Remarks/Response textarea
  - "Approve" button (green)
  - "Reject" button (red)
- **Status Info** (if already processed):
  - Colored box with approval/rejection details
  - Admin remarks
  - Admin response message

---

### 4. Shiprocket Integration

#### File: `E_com_backend-main/services/shiprocket.js`

**Function**: `cancelShiprocketOrder(awbNumber)`
- Called when admin approves cancellation
- Cancels shipment in Shiprocket
- Handles errors gracefully
- Logs cancellation status

---

## Email Notifications

### 1. User Submits Cancellation Request
**Subject**: "Cancellation Request Received - Order #[OrderID]"
- Confirms receipt of request
- Shows "Under Review" status
- Displays order details
- Shows refund information (if applicable)

### 2. Admin Approves Request
**Subject**: "Order Cancellation Approved - [OrderID]"
- Notification that request is approved
- Shows order details
- Displays admin remarks
- Explains refund process

### 3. Admin Rejects Request
**Subject**: "Order Cancellation Request - [OrderID]"
- Notification that request is rejected
- Shows rejection reason
- Displays admin notes
- Advises to contact support for questions

---

## Status Indicators

### Order Status Flow
```
confirmed/processing/pending
         ↓
  cancellation-pending  (when user requests)
         ↓
   [Admin Review]
         ↓
    cancelled (if approved)
         OR
  confirmed/pending (if rejected)
```

### Request Status
- **pending** (⏳ Amber): Awaiting admin review
- **approved** (✅ Green): Cancellation approved
- **rejected** (❌ Red): Cancellation declined

---

## Key Features

### For Users:
1. ✅ Request cancellation with reason
2. ✅ View all cancellation requests
3. ✅ Track request status (Pending/Approved/Rejected)
4. ✅ Get email notifications
5. ✅ See refund timeline
6. ✅ View admin response/remarks

### For Admin:
1. ✅ View all pending cancellation requests
2. ✅ Search requests by Order ID or Customer Name
3. ✅ View complete request details
4. ✅ Add remarks/notes
5. ✅ Approve or Reject requests
6. ✅ Automatic Shiprocket cancellation
7. ✅ Automatic email notifications

### For System:
1. ✅ Automatic Shiprocket shipment cancellation
2. ✅ Automatic refund marking
3. ✅ Email notifications at each step
4. ✅ Complete audit trail
5. ✅ Pagination support
6. ✅ Search functionality

---

## Order Status Updates

When admin approves a cancellation request:

1. **Order Database**:
   - `orderStatus` = "cancelled"
   - `cancelledAt` = Current Date
   - `paymentStatus` = "refunded" (if was "paid")
   - `updatedAt` = Current Date

2. **CancellationRequest Database**:
   - `status` = "approved"
   - `processedBy` = Admin User ID
   - `processedAt` = Current Date
   - `adminRemarks` = Admin's notes

3. **Shiprocket**:
   - Call `cancelOrder()` API with AWB number
   - Shipment cancelled in Shiprocket system

4. **User Notification**:
   - Email sent to user
   - Email contains order details and refund info

---

## Implementation Checklist

- ✅ Backend: CancellationRequest Schema
- ✅ Backend: User API endpoints (request, list, get)
- ✅ Backend: Admin API endpoints (list, approve, reject)
- ✅ Backend: Shiprocket integration
- ✅ Backend: Email notifications
- ✅ Frontend: Cancel request modal
- ✅ Frontend: Profile orders tab integration
- ✅ Frontend: Cancellation requests view in profile
- ✅ Admin Panel: Cancellations tab
- ✅ Admin Panel: Request display and actions
- ✅ Admin Panel: Approve/Reject functionality

---

## Testing Endpoints

### Create a Cancellation Request:
```bash
POST /api/orders/{orderId}/request-cancellation
Authorization: Bearer {userToken}
Body: { "reason": "Changed my mind" }
```

### List User's Requests:
```bash
GET /api/user/cancellation-requests?page=1&limit=5
Authorization: Bearer {userToken}
```

### List Admin Requests:
```bash
GET /api/admin/cancellation-requests?status=all
Authorization: Bearer {adminToken}
```

### Approve Request:
```bash
PATCH /api/admin/cancellation-requests/{requestId}/approve
Authorization: Bearer {adminToken}
Body: { "adminRemarks": "Approved - refund processing" }
```

### Reject Request:
```bash
PATCH /api/admin/cancellation-requests/{requestId}/reject
Authorization: Bearer {adminToken}
Body: { 
  "adminRemarks": "Already shipped",
  "adminResponse": "We cannot cancel shipped orders" 
}
```

---

## Database Queries Reference

### Find Pending Cancellation Requests:
```javascript
CancellationRequest.find({ status: "pending" })
  .populate("userId", "name email")
  .populate("orderId")
  .sort({ createdAt: -1 })
```

### Find User's Requests:
```javascript
CancellationRequest.find({ userId: userId })
  .sort({ createdAt: -1 })
  .limit(10)
```

### Find Approved Requests:
```javascript
CancellationRequest.find({ status: "approved" })
  .populate("processedBy", "name email")
```

---

## Error Handling

The system handles various error scenarios:

1. **Order Not Found**: 404 error
2. **Already Has Pending Request**: Prevents duplicate requests
3. **Order Not Cancellable**: Only pending/confirmed/processing orders
4. **Invalid Status Transition**: Prevents invalid status changes
5. **Shiprocket Failure**: Logs error but still completes cancellation
6. **Email Failure**: Logs error but continues operation
7. **Database Errors**: Returns appropriate error messages

---

## Future Enhancements

Potential improvements:
1. **Partial Cancellation**: Cancel individual items instead of whole order
2. **Cancellation Deadline**: Allow cancellation only within time window
3. **Auto-Approval**: Auto-approve for certain order statuses
4. **Refund Methods**: Support multiple refund methods (wallet, etc.)
5. **Cancellation Analytics**: Dashboard showing cancellation reasons
6. **Escalation**: Route to higher authority if not resolved
7. **Chat Support**: Real-time communication during cancellation

---

## Support & Troubleshooting

### Issue: Cancellation request not showing in admin panel
- Check if request status is "pending"
- Verify admin has correct permissions
- Check database for CancellationRequest entries

### Issue: Email not being sent
- Verify NODE_MAILER configuration
- Check email service status
- Review email templates in code

### Issue: Shiprocket cancellation failing
- Verify Shiprocket credentials
- Check AWB number validity
- Verify shipment status in Shiprocket

---

**Last Updated**: January 29, 2026
**System Status**: ✅ Fully Implemented & Tested
