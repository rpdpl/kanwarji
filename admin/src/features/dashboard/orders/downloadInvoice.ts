import logo from "../../../../public/logo1.png"
import { fetchInvoiceData } from "@/lib/admin-api"
import type { Order } from "@/features/dashboard/types"

export async function downloadInvoice(order: Order, setError: (msg: string) => void) {
    try {
      const data = await fetchInvoiceData(order.orderId)
      if (data.success) {
        const invoiceData = data.invoiceData

        // Import jsPDF dynamically
        const { jsPDF } = await import('jspdf')
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        })

        // Set base Latin font
        doc.setFont('helvetica')

        // Try loading a Unicode font that supports Devanagari (Hindi)
        // We load TTF at runtime and register it with jsPDF VFS
        const fetchAsBase64 = async (url: string): Promise<string> => {
          const resp = await fetch(url)
          if (!resp.ok) throw new Error(`HTTP ${resp.status} for font`)
          const buf = await resp.arrayBuffer()
          let binary = ''
          const bytes = new Uint8Array(buf)
          const len = bytes.byteLength
          for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i])
          return btoa(binary)
        }

        const loadUnicodeFont = async (): Promise<boolean> => {
          const tryUrls = [
            // Prefer locally hosted copies if present
            '/fonts/NotoSansDevanagari-Regular.ttf',
            '/NotoSansDevanagari-Regular.ttf',
            // Fallback to a public source (GitHub raw)
            'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf',
          ]
          for (const u of tryUrls) {
            try {
              const b64 = await fetchAsBase64(u)
              doc.addFileToVFS('NotoSansDevanagari-Regular.ttf', b64)
              doc.addFont('NotoSansDevanagari-Regular.ttf', 'NotoSansDeva', 'normal')
              return true
            } catch (e) {
              console.warn('Unicode font load failed:', u, e)
            }
          }
          return false
        }

        const unicodeFontLoaded = await loadUnicodeFont()

        let yPos = 20
        const pageWidth = doc.internal.pageSize.getWidth()
        const leftMargin = 20
        const rightMargin = pageWidth - 20
        const contentWidth = rightMargin - leftMargin

        // Header - Logo and Company Name
        let lastLogoHeight = 0
        const addLogo = async (url: string) => {
          const logoWidth = 48
          const logoHeight = 20
          const logoX = (pageWidth - logoWidth) / 2

          try {
            // Use fetch to get the image as blob, then convert to base64
            const imgResponse = await fetch(url)
            const blob = await imgResponse.blob()
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                const result = reader.result as string
                resolve(result)
              }
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })

            doc.addImage(base64, 'PNG', logoX, yPos, logoWidth, logoHeight, undefined, 'FAST')
            lastLogoHeight = logoHeight
            return true
          } catch (err) {
            console.error('Failed to load logo:', err)
            return false
          }
        }

        // Try to load logo - prefer same-origin first, then remote
        let logoLoaded = false
        try {
          const logoSrc = typeof logo === 'string' ? logo : (logo as any)?.src || '/logo2.png'
          logoLoaded = await addLogo(logoSrc)
        } catch (err) {
          console.warn('Local logo load error:', err)
        }
        if (!logoLoaded) {
          try {
            logoLoaded = await addLogo('https://kanwarji.in/logo1.png')
          } catch (err2) {
            console.warn('Remote logo load error:', err2)
          }
        }

        // Leave space below the logo equal to its height plus margin
        if (logoLoaded) {
          yPos += (lastLogoHeight || 20) + 12
        }
        doc.setFontSize(22)
        doc.setFont('helvetica', 'bold')
        if (!logoLoaded) {
          // If still no logo, add minor top padding for balance
          yPos += 6
        }
        doc.text('Kanwarji Bhagirath Mal', pageWidth / 2, yPos, { align: 'center' })
        yPos += 10

        // Order Details Title
        doc.setFontSize(18)
        doc.text('ORDER DETAILS', pageWidth / 2, yPos, { align: 'center' })
        yPos += 8

        doc.setFontSize(14)
        doc.text(`Order ID: ${order.orderId}`, pageWidth / 2, yPos, { align: 'center' })
        yPos += 15

        // Order Info Section
        doc.setFillColor(253, 240, 240)
        doc.rect(leftMargin, yPos - 5, contentWidth, 50, 'F')

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('Date:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(new Date(order.createdAt).toLocaleDateString(), leftMargin + 40, yPos)
        yPos += 7

        doc.setFont('helvetica', 'bold')
        doc.text('Customer:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(invoiceData.customer.name, leftMargin + 40, yPos)
        yPos += 7

        doc.setFont('helvetica', 'bold')
        doc.text('Phone:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(invoiceData.customer.phone, leftMargin + 40, yPos)
        yPos += 7

        doc.setFont('helvetica', 'bold')
        doc.text('Email:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(invoiceData.customer.email, leftMargin + 40, yPos)
        yPos += 7

        doc.setFont('helvetica', 'bold')
        doc.text('Address:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        const addressText = `${invoiceData.customer.address.address}, ${invoiceData.customer.address.city}, ${invoiceData.customer.address.state} - ${invoiceData.customer.address.pincode}`
        const addressLines = doc.splitTextToSize(addressText, contentWidth - 45)
        doc.text(addressLines, leftMargin + 40, yPos)
        yPos += 7 * addressLines.length

        doc.setFont('helvetica', 'bold')
        doc.text('Payment:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(invoiceData.order.paymentMethod.toUpperCase(), leftMargin + 40, yPos)
        yPos += 7

        doc.setFont('helvetica', 'bold')
        doc.text('Status:', leftMargin + 5, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(`${invoiceData.order.paymentStatus.toUpperCase()} / ${invoiceData.order.orderStatus.toUpperCase()}`, leftMargin + 40, yPos)
        yPos += 15

        // Special Requests
        if (order.specialRequests) {
          doc.setFillColor(249, 229, 151)
          doc.rect(leftMargin, yPos - 5, contentWidth, 15, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          doc.text('Special Requests:', leftMargin + 5, yPos)
          yPos += 6
          // Switch to Unicode Devanagari font ONLY if the text has Hindi characters; otherwise keep Latin font
          const hasDevanagari = /[\u0900-\u097F]/.test(order.specialRequests || '')
          if (unicodeFontLoaded && hasDevanagari) {
            doc.setFont('NotoSansDeva', 'normal')
          } else {
            doc.setFont('helvetica', 'normal')
          }
          doc.setFontSize(9)
          // Sanitize: normalize Unicode, drop control chars, replace NBSP with space
          const srRaw = String(order.specialRequests || '')
          const sr = srRaw
            .normalize('NFC')
            .replace(/[\u0000-\u001F\u007F]/g, '')
            .replace(/\u00A0/g, ' ')
          // Wrap text using splitTextToSize (compatible across jsPDF versions)
          const maxWidth = contentWidth - 10
          const wrapped = doc.splitTextToSize(sr, maxWidth)
          doc.text(wrapped as any, leftMargin + 5, yPos)
          const lineHeight = 6
          yPos += (Array.isArray(wrapped) ? wrapped.length : 1) * lineHeight + 8
          // Restore base font for the rest of the document
          doc.setFont('helvetica', 'normal')
        }

        // Table column setup
        const COL = {
          padding: 4,
          totalRight: rightMargin - 4,
          totalWidth: 30,
          priceWidth: 30,
          qtyWidth: 30,
        }
        const totalLeft = COL.totalRight - COL.totalWidth
        const priceRight = totalLeft - 2
        const priceLeft = priceRight - COL.priceWidth
        const qtyRight = priceLeft - 2
        const qtyLeft = qtyRight - COL.qtyWidth
        const itemLeft = leftMargin + COL.padding
        const itemRight = qtyLeft - 2

        const drawTableHeader = () => {
          doc.setFillColor(252, 220, 220)
          doc.rect(leftMargin, yPos, contentWidth, 12, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.text('Item', itemLeft, yPos + 8)
          doc.text('Qty', qtyRight, yPos + 8, { align: 'right' })
          doc.text('Price', priceRight, yPos + 8, { align: 'right' })
          doc.text('Total', COL.totalRight, yPos + 8, { align: 'right' })
          yPos += 14
          doc.setDrawColor(230)
          doc.line(leftMargin, yPos, leftMargin, yPos - 14)
          doc.line(itemRight, yPos, itemRight, yPos - 14)
          doc.line(qtyRight + 1, yPos, qtyRight + 1, yPos - 14)
          doc.line(priceRight + 1, yPos, priceRight + 1, yPos - 14)
          doc.line(COL.totalRight + 1, yPos, COL.totalRight + 1, yPos - 14)
          doc.line(leftMargin + contentWidth, yPos, leftMargin + contentWidth, yPos - 14)
        }

        drawTableHeader()

        // Items
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        const lineHeight = 6

        invoiceData.order.items.forEach((item: any) => {
          const variant = item.variantLabel || item.unit
          const itemName = `${item.name}${variant ? ` (${variant})` : ''}`
          const qtyText = String(item.quantity)
          const priceText = `Rs ${Number(item.price).toFixed(2)}`
          const totalText = `Rs ${(item.price * item.quantity).toFixed(2)}`

          const wrappedName = doc.splitTextToSize(itemName, itemRight - itemLeft - 2)
          const rowHeight = Math.max(lineHeight, wrappedName.length * lineHeight)

          if (yPos + rowHeight > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage()
            yPos = 20
            drawTableHeader()
          }

          const startY = yPos - (lineHeight - 2)
          const boxH = rowHeight + 3
          doc.setFillColor(255, 245, 245)
          doc.rect(leftMargin, startY, contentWidth, boxH, 'F')
          doc.setDrawColor(235)
          doc.rect(leftMargin, startY, itemRight - leftMargin, boxH)
          doc.rect(itemRight, startY, qtyRight - itemRight, boxH)
          doc.rect(qtyRight, startY, priceRight - qtyRight, boxH)
          doc.rect(priceRight, startY, COL.totalRight - priceRight, boxH)

          doc.setTextColor(0, 0, 0)
          doc.text(wrappedName as any, itemLeft, yPos)
          doc.text(qtyText, qtyRight, yPos, { align: 'right' })
          doc.text(priceText, priceRight, yPos, { align: 'right' })
          doc.text(totalText, COL.totalRight, yPos, { align: 'right' })

          doc.setDrawColor(220)
          doc.line(leftMargin, startY + boxH, leftMargin + contentWidth, startY + boxH)

          yPos += rowHeight + 2
        })

        yPos += 5

        // Compute convenience fee + 18% GST and updated total
        const convBase = Number(invoiceData.order.convenienceFee || 0)
        const convGst = Number((convBase * 0.18).toFixed(2))
        const convTotal = Number((convBase + convGst).toFixed(2))
        const updatedTotalForPdf = Number(((Number(invoiceData.order.totalAmount || 0)) + convTotal).toFixed(2))

        // Totals Section
        doc.setFillColor(260, 260, 260)
        const totalsHeight = 25
        doc.rect(leftMargin, yPos, contentWidth, totalsHeight, 'F')

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        yPos += 7
        doc.text('Subtotal:', leftMargin + 110, yPos)
        doc.text(`Rs ${invoiceData.order.subtotal?.toFixed(2) || '0.00'}`, rightMargin - 5, yPos, { align: 'right' })
        yPos += 6

        const dFee = Number(invoiceData.order.deliveryFee || invoiceData.order.shiprocketFee || 0)
        if (dFee > 0) {
          doc.text('Delivery / Shipping Fee:', leftMargin + 110, yPos)
          doc.text(`Rs ${dFee.toFixed(2)}`, rightMargin - 5, yPos, { align: 'right' })
        } else {
          doc.setFontSize(8)
          doc.text('Local delivery charges payable at time of delivery', leftMargin + 110, yPos)
          doc.setFontSize(10)
        }
        yPos += 6

        if (Number(invoiceData.order.taxAmount) > 0) {
          doc.text('Tax:', leftMargin + 110, yPos)
          doc.text(`Rs ${Number(invoiceData.order.taxAmount).toFixed(2)}`, rightMargin - 5, yPos, { align: 'right' })
          yPos += 6
        } else {
          yPos += 2
        }

        if (convTotal > 0) {
          // Show single combined Convenience Fee (including GST)
          doc.text('Convenience Fee:', leftMargin + 110, yPos)
          doc.text(`Rs ${convTotal.toFixed(2)}`, rightMargin - 5, yPos, { align: 'right' })
          yPos += 8
        } else {
          yPos += 2
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text('Total Amount:', leftMargin + 110, yPos)
        const finalTotal = updatedTotalForPdf.toFixed(2)
        doc.text(`Rs ${finalTotal}`, rightMargin - 5, yPos, { align: 'right' })
        yPos += 15

        // Footer
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        yPos = doc.internal.pageSize.getHeight() - 25
        doc.text('Kanwarji Bhagirath Mal', pageWidth / 2, yPos, { align: 'center' })
        yPos += 5
        doc.text('1972, Chandni Chowk, Delhi- 110006. Delhi. Bharat (India)', pageWidth / 2, yPos, { align: 'center' })
        yPos += 5
        doc.text('Email: kanwarji@rpdindia.com | Phone: +91-9811049585', pageWidth / 2, yPos, { align: 'center' })
        yPos += 5
        doc.text('Thank you for shopping with us!', pageWidth / 2, yPos, { align: 'center' })

        // Save the PDF
        doc.save(`Kanwarji-order-details-${order.orderId}.pdf`)
      }
    } catch (error) {
      console.error("Failed to download invoice:", error)
      setError("Failed to download invoice")
    }
}
