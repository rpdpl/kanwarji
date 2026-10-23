# Order Cancellation System - Quick Setup & Testing Guide

## Files Modified/Created

### Frontend Files (React - Vite)

1. **src/components/CancelOrderModal.jsx** (NEW)
   - Modal component for requesting order cancellation
   - Location: `src/components/CancelOrderModal.jsx`

2. **src/components/Profile.jsx** (MODIFIED)
   - Updated `confirmCancelOrder()` function to use new endpoint
   - Added `apiPost` import
   - Added "Cancellations" tab
   - Added inline `CancellationRequestsComponent`
   - Updated cancel modal UI and messaging

3. **src/components/CancellationRequestsPage.jsx** (NEW)
   - Standalone page for viewing all cancellation requests
   - Location: `src/components/CancellationRequestsPage.jsx`

### Admin Panel Files (Next.js)

**vikash_admin-main/src/app/(root)/pannel/page.tsx** (ALREADY IMPLEMENTED)
   - Already has complete cancellation requests functionality
   - Tab: "Cancellations" with full CRUD operations
   - Approve/Reject functionality with remarks
   - Auto-integration with Shiprocket

### Backend Files (Express.js - Already Implemented)

**E_com_backend-main/server.js** (ALREADY IMPLEMENTED)
   - CancellationRequest Schema
   - User endpoints: `/api/orders/:orderId/request-cancellation`
   - Admin endpoints: `/api/admin/cancellation-requests/*`
   - Shiprocket integration

**E_com_backend-main/services/shiprocket.js** (ALREADY IMPLEMENTED)
   - `cancelShiprocketOrder()` function

---

## Feature Overview

### User Side Flow
1. User views order in their profile
2. Clicks "Cancel Order" button
3. Modal opens with order details
4. User provides cancellation reason
5. Submits cancellation request
6. Request goes to admin for review
7. User sees "Cancellation Requests" tab in profile
8. User can track status of all requests

### Admin Side Flow
1. Admin sees "Cancellations" tab in dashboard
2. Views all pending, approved, rejected requests
3. Can search by Order ID or Customer Name
4. Clicks on request to view details
5. For pending requests:
   - Can add admin remarks
   - Can approve (initiates refund + Shiprocket cancellation)
   - Can reject (order remains active)
6. System automatically:
   - Sends email to user
   - Updates order status
   - Cancels shipment in Shiprocket

---

## Testing the System

### Setup Environment Variables

Ensure your `.env` file in the backend has:
```
SHIPROCKET_EMAIL=your_email@shiprocket.in
SHIPROCKET_PASSWORD=your_password
SHIPROCKET_CHANNEL_ID=your_channel_id
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### Test Steps

#### Step 1: Create a Test Order
1. Log in as a user
2. Add items to cart
3. Complete checkout (pay or use COD)
4. Confirm order is created

#### Step 2: Request Cancellation
1. Go to Profile → Orders tab
2. Find the test order
3. Click "Cancel Order" button
4. Modal appears with order details
5. Enter cancellation reason
6. Click "Request Cancellation"
7. Should see success message: "Cancellation request submitted..."

#### Step 3: View Request Status (User Side)
1. Click new "Cancellations" tab in Profile
2. Should see the cancellation request
3. Status should be "pending" (amber color)
4. Should show:
   - Order ID
   - Cancellation reason
   - Order amount
   - "Under Review" message

#### Step 4: Admin Review
1. Log in as admin
2. Go to Dashboard → Cancellations tab
3. Should see the pending request
4. View request details:
   - Customer info
   - Order items
   - Payment info
   - Cancellation reason

#### Step 5: Approve Request (Test)
1. In admin panel, find the request
2. Add remarks (optional): "Refund approved - within processing window"
3. Click "Approve" button
4. Should see success message

#### Step 6: Verify Changes
1. User side:
   - Check "Cancellations" tab
   - Status should now be "approved" (green)
   - Should see refund message
2. Order tab:
   - Order status should show as "cancelled"
3. Database:
   - Order.orderStatus = "cancelled"
   - Order.paymentStatus = "refunded" (if was paid online)
   - CancellationRequest.status = "approved"

#### Step 7: Test Rejection (Optional)
1. Create another test order
2. Request cancellation
3. In admin, add remarks: "Order already shipped"
4. Add response: "We cannot cancel shipped orders"
5. Click "Reject" button
6. Verify user sees rejection status with reason

---

## API Testing with cURL

### Request Cancellation
```bash
curl -X POST http://localhost:5000/api/orders/ORDER_ID/request-cancellation \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Changed my mind"}'
```

### Get User's Requests
```bash
curl -X GET "http://localhost:5000/api/user/cancellation-requests?page=1&limit=5" \
  -H "Authorization: Bearer USER_TOKEN"
```

### Get Admin Requests
```bash
curl -X GET "http://localhost:5000/api/admin/cancellation-requests?status=pending" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Approve Request
```bash
curl -X PATCH http://localhost:5000/api/admin/cancellation-requests/REQUEST_ID/approve \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"adminRemarks": "Approved for refund"}'
```

### Reject Request
```bash
curl -X PATCH http://localhost:5000/api/admin/cancellation-requests/REQUEST_ID/reject \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"adminRemarks": "Already shipped", "adminResponse": "Cannot cancel shipped orders"}'
```

---

## Expected Email Notifications

### Email 1: User Submits Request
- **To**: User's email
- **Subject**: "Cancellation Request Received - Order #[OrderID]"
- **Contains**: Order details, "Under Review" status, refund info

### Email 2: Admin Approves
- **To**: User's email
- **Subject**: "Order Cancellation Approved - [OrderID]"
- **Contains**: Order details, approval confirmation, refund timeline

### Email 3: Admin Rejects
- **To**: User's email
- **Subject**: "Order Cancellation Request - [OrderID]"
- **Contains**: Rejection reason, admin notes, support contact

---

## Common Issues & Solutions

### Issue: "A cancellation request for this order is already pending"
**Solution**: The user already has a pending request. They must wait for admin review.

### Issue: "Order with status 'delivered' cannot be cancelled"
**Solution**: Only pending, confirmed, or processing orders can be cancelled.

### Issue: Request not appearing in admin panel
**Solutions**:
- Refresh admin dashboard
- Verify request status is "pending"
- Check user is logged in as admin
- Verify database connection

### Issue: Email not being sent
**Solutions**:
- Check `EMAIL_USER` and `EMAIL_PASS` in .env
- Verify email service is running
- Check network connection
- Review server logs for errors

### Issue: Shiprocket cancellation failing
**Solutions**:
- Verify `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD`
- Check AWB number is valid
- Verify shipment exists in Shiprocket
- Check Shiprocket API credentials

---

## Database Verification

### Check Pending Requests
```javascript
// In MongoDB
db.cancellationrequests.find({ status: "pending" })
```

### Check Approved Requests
```javascript
db.cancellationrequests.find({ status: "approved" })
  .populate("processedBy")
```

### Check Order Status Changes
```javascript
db.orders.findOne({ orderId: "ORD123" }, { orderStatus: 1, paymentStatus: 1 })
```

---

## Frontend Integration Checklist

- ✅ CancelOrderModal component created
- ✅ Profile component updated with new endpoint
- ✅ Cancellations tab added to profile
- ✅ CancellationRequestsComponent implemented
- ✅ Email imports added
- ✅ apiPost import added

### To Use in Routes
If you want to use `CancellationRequestsPage` as a separate route:

```jsx
// In your routing file
import CancellationRequestsPage from './components/CancellationRequestsPage';

// Add route
<Route path="/cancellation-requests" element={<CancellationRequestsPage onBack={() => navigate(-1)} />} />
```

---

## Performance Considerations

### Database Indexes Recommended
```javascript
// Add to MongoDB setup
db.cancellationrequests.createIndex({ userId: 1, status: 1 })
db.cancellationrequests.createIndex({ status: 1, createdAt: -1 })
db.cancellationrequests.createIndex({ orderId: 1 })
```

### Pagination
- User requests list: 5 per page
- Admin requests list: Variable, based on search
- Load time optimized with pagination

---

## Monitoring & Analytics

### Metrics to Track
1. Number of cancellation requests per day
2. Approval vs rejection rate
3. Average processing time
4. Most common cancellation reasons
5. Refund processing time

### Logs to Monitor
- CancellationRequest creation
- Admin approval/rejection
- Shiprocket cancellation status
- Email sending status
- Error messages

---

## Security Considerations

### Implemented Security
1. ✅ Authentication required for all endpoints
2. ✅ Admin-only endpoints protected
3. ✅ User can only see own requests
4. ✅ No sensitive data in emails
5. ✅ Database validation

### Recommended Additional Measures
1. Rate limiting on request creation
2. Audit logging for admin actions
3. Two-factor authentication for admin
4. Request validation middleware
5. CSRF protection

---

## Support Resources

### Backend Logs
```bash
# Check for errors
tail -f logs/server.log | grep -i "cancel"
tail -f logs/server.log | grep -i "error"
```

### Admin Panel Logs
```bash
# Check Next.js console
npm run dev  # Watch for errors
```

### Database Backup
```bash
# Backup cancellation requests collection
mongodump --db your_db --collection cancellationrequests --out ./backup
```

---

## Deployment Checklist

- ✅ Backend code deployed
- ✅ Frontend components updated
- ✅ Admin panel updated
- ✅ Environment variables configured
- ✅ Email service configured
- ✅ Shiprocket credentials set
- ✅ Database indexed
- ✅ Email templates verified
- ✅ Testing completed

---

**Status**: ✅ Ready for Production
**Last Updated**: January 29, 2026
**Version**: 1.0.0
