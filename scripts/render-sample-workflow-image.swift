import AppKit
import CoreGraphics
import Foundation

struct RendererArguments {
  let outputPath: String
  let variant: String
  let title: String
  let label: String
  let sku: String
}

func parseArguments() -> RendererArguments {
  var outputPath = ""
  var variant = "original"
  var title = "Sample Item"
  var label = "TESTING SAMPLE 1"
  var sku = "SAMPLE-SKU"

  var index = 1
  while index < CommandLine.arguments.count {
    let token = CommandLine.arguments[index]
    switch token {
    case "--output":
      index += 1
      outputPath = CommandLine.arguments[index]
    case "--variant":
      index += 1
      variant = CommandLine.arguments[index]
    case "--title":
      index += 1
      title = CommandLine.arguments[index]
    case "--label":
      index += 1
      label = CommandLine.arguments[index]
    case "--sku":
      index += 1
      sku = CommandLine.arguments[index]
    default:
      break
    }
    index += 1
  }

  guard !outputPath.isEmpty else {
    fatalError("Missing --output")
  }

  return RendererArguments(
    outputPath: outputPath,
    variant: variant,
    title: title,
    label: label,
    sku: sku
  )
}

func drawParagraph(_ text: String, rect: CGRect, font: NSFont, color: NSColor, alignment: NSTextAlignment = .left) {
  let paragraphStyle = NSMutableParagraphStyle()
  paragraphStyle.alignment = alignment
  paragraphStyle.lineBreakMode = .byWordWrapping

  let attributes: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: color,
    .paragraphStyle: paragraphStyle,
  ]

  NSString(string: text).draw(with: rect, options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attributes)
}

let args = parseArguments()
let isProcessed = args.variant == "processed"
let width = isProcessed ? 1200 : 1600
let height = isProcessed ? 900 : 1200
let outerPaddingX = isProcessed ? 88 : 130
let outerPaddingY = isProcessed ? 72 : 110
let panelRect = CGRect(
  x: outerPaddingX,
  y: outerPaddingY,
  width: width - (outerPaddingX * 2),
  height: height - (outerPaddingY * 2)
)

let colorSpace = CGColorSpaceCreateDeviceRGB()
let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
guard let context = CGContext(
  data: nil,
  width: width,
  height: height,
  bitsPerComponent: 8,
  bytesPerRow: width * 4,
  space: colorSpace,
  bitmapInfo: bitmapInfo
) else {
  fatalError("Unable to create CGContext")
}

context.translateBy(x: 0, y: CGFloat(height))
context.scaleBy(x: 1, y: -1)

let backgroundColors = [
  NSColor(calibratedRed: 0.15, green: 0.39, blue: 0.92, alpha: 1).cgColor,
  NSColor(calibratedRed: 0.06, green: 0.09, blue: 0.16, alpha: 1).cgColor,
] as CFArray
let backgroundGradient = CGGradient(colorsSpace: colorSpace, colors: backgroundColors, locations: [0, 1])!
context.drawLinearGradient(
  backgroundGradient,
  start: CGPoint(x: 0, y: CGFloat(height)),
  end: CGPoint(x: CGFloat(width), y: 0),
  options: []
)

let graphicsContext = NSGraphicsContext(cgContext: context, flipped: false)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = graphicsContext

let panelPath = NSBezierPath(roundedRect: panelRect, xRadius: isProcessed ? 34 : 46, yRadius: isProcessed ? 34 : 46)
NSColor(calibratedRed: 0.01, green: 0.02, blue: 0.09, alpha: 0.94).setFill()
panelPath.fill()

let strokeRect = panelRect.insetBy(dx: 18, dy: 18)
let strokePath = NSBezierPath(roundedRect: strokeRect, xRadius: isProcessed ? 24 : 34, yRadius: isProcessed ? 24 : 34)
strokePath.lineWidth = 2
NSColor(calibratedRed: 0.20, green: 0.27, blue: 0.33, alpha: 0.65).setStroke()
strokePath.stroke()

let titleRect = CGRect(x: panelRect.minX + 90, y: panelRect.minY + (isProcessed ? 152 : 188), width: panelRect.width - 180, height: isProcessed ? 220 : 260)
drawParagraph(args.title, rect: titleRect, font: NSFont(name: "Helvetica-Bold", size: isProcessed ? 62 : 84) ?? .boldSystemFont(ofSize: isProcessed ? 62 : 84), color: .white)

let labelRect = CGRect(x: panelRect.minX + 90, y: panelRect.minY + (isProcessed ? 406 : 520), width: panelRect.width - 180, height: 80)
drawParagraph(args.label, rect: labelRect, font: NSFont(name: "Helvetica-Bold", size: isProcessed ? 44 : 54) ?? .boldSystemFont(ofSize: isProcessed ? 44 : 54), color: NSColor(calibratedRed: 0.75, green: 0.86, blue: 0.99, alpha: 1))

let skuRect = CGRect(x: panelRect.minX + 90, y: panelRect.minY + (isProcessed ? 484 : 598), width: panelRect.width - 180, height: 56)
drawParagraph("SKU \(args.sku)", rect: skuRect, font: NSFont(name: "Helvetica", size: isProcessed ? 28 : 36) ?? .systemFont(ofSize: isProcessed ? 28 : 36), color: NSColor(calibratedRed: 0.89, green: 0.91, blue: 0.94, alpha: 1))

let footerText = isProcessed
  ? "Processed sample image - 1200x900 - Resolution AV watermark"
  : "Original sample image"
let footerRect = CGRect(x: panelRect.minX + 90, y: panelRect.maxY - (isProcessed ? 122 : 150), width: panelRect.width - 180, height: 50)
drawParagraph(footerText, rect: footerRect, font: NSFont(name: "Helvetica", size: isProcessed ? 26 : 30) ?? .systemFont(ofSize: isProcessed ? 26 : 30), color: NSColor(calibratedRed: 0.80, green: 0.84, blue: 0.88, alpha: 1))

if isProcessed {
  context.saveGState()
  context.translateBy(x: CGFloat(width) / 2, y: CGFloat(height) / 2)
  context.rotate(by: -.pi / 10)
  let watermarkRect = CGRect(x: -360, y: -110, width: 720, height: 220)
  drawParagraph(
    "RESOLUTION AV\nWATERMARKED SAMPLE",
    rect: watermarkRect,
    font: NSFont(name: "Helvetica-Bold", size: 64) ?? .boldSystemFont(ofSize: 64),
    color: NSColor(calibratedRed: 0.58, green: 0.64, blue: 0.72, alpha: 0.28),
    alignment: .center
  )
  context.restoreGState()
}

NSGraphicsContext.restoreGraphicsState()

guard let image = context.makeImage() else {
  fatalError("Unable to create CGImage")
}

let bitmap = NSBitmapImageRep(cgImage: image)
guard let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.92]) else {
  fatalError("Unable to encode JPEG")
}

let outputUrl = URL(fileURLWithPath: args.outputPath)
try data.write(to: outputUrl)
print(outputUrl.path)