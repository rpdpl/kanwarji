import html2canvas from "html2canvas"
import jsPDF from "jspdf"

export async function generatePdfFromHtml(htmlContent: string, fileName: string): Promise<void> {
  try {
    // Create a temporary container
    const container = document.createElement("div")
    container.innerHTML = htmlContent
    container.style.position = "absolute"
    container.style.left = "-9999px"
    container.style.width = "210mm"
    document.body.appendChild(container)

    // Convert HTML to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
      allowTaint: true,
    })

    // Remove temporary container
    document.body.removeChild(container)

    // Create PDF from canvas
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    // Calculate dimensions to fit page
    const imgWidth = pageWidth - 20
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    const yPosition = 10
    const remainingHeight = imgHeight

    // Handle multi-page PDFs
    const canvasImg = canvas.toDataURL("image/png")
    const pageHeightAvailable = pageHeight - 20

    if (remainingHeight <= pageHeightAvailable) {
      pdf.addImage(canvasImg, "PNG", 10, yPosition, imgWidth, imgHeight)
    } else {
      let heightLeft = imgHeight
      let position = 0

      while (heightLeft > 0) {
        const pageCanvas = document.createElement("canvas")
        const pageContext = pageCanvas.getContext("2d")
        if (!pageContext) return

        pageCanvas.width = canvas.width
        pageCanvas.height =
          Math.min(heightLeft, (pageHeightAvailable * canvas.width) / imgWidth) * (canvas.width / imgWidth)

        pageContext.drawImage(
          canvas,
          0,
          position,
          canvas.width,
          pageCanvas.height,
          0,
          0,
          canvas.width,
          pageCanvas.height,
        )

        const imgData = pageCanvas.toDataURL("image/png")
        pdf.addImage(imgData, "PNG", 10, 10, imgWidth, pageHeightAvailable)

        heightLeft -= pageHeightAvailable
        position += pageCanvas.height

        if (heightLeft > 0) {
          pdf.addPage()
        }
      }
    }

    // Download the PDF
    pdf.save(fileName)
  } catch (error) {
    console.error("Failed to generate PDF:", error)
    throw new Error("Failed to generate PDF")
  }
}
