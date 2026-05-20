import SwiftUI

struct NimbusLaunchView: View {
    @State private var breathe = false
    @State private var spark = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.03, green: 0.06, blue: 0.12),
                    Color(red: 0.07, green: 0.36, blue: 0.42),
                    Color(red: 1.0, green: 0.72, blue: 0.54)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(spacing: 16) {
                ZStack {
                    Cloud()
                        .fill(Color(red: 0.70, green: 0.98, blue: 1.0))
                        .frame(width: 150, height: 92)
                        .shadow(color: .cyan.opacity(0.45), radius: 24)
                        .scaleEffect(breathe ? 1.08 : 0.96)

                    Text("NN")
                        .font(.system(size: 34, weight: .black, design: .rounded))
                        .foregroundStyle(Color(red: 0.02, green: 0.08, blue: 0.15))
                }

                Text("Nimbus Nook")
                    .font(.system(size: 34, weight: .black, design: .rounded))
                    .foregroundStyle(.white)

                Text("breathe, write, reset")
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.82))
            }
            .padding()

            ForEach(0..<10, id: \.self) { index in
                Circle()
                    .fill(index.isMultiple(of: 2) ? Color.cyan : Color.pink)
                    .frame(width: 5 + CGFloat(index % 3) * 3)
                    .position(x: CGFloat(24 + index * 37), y: spark ? CGFloat(120 + (index % 4) * 65) : 760)
                    .opacity(0.62)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 2.2).repeatForever(autoreverses: true)) {
                breathe = true
            }
            withAnimation(.easeOut(duration: 2.8)) {
                spark = true
            }
        }
    }
}

private struct Cloud: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height
        path.move(to: CGPoint(x: w * 0.18, y: h * 0.78))
        path.addCurve(to: CGPoint(x: w * 0.18, y: h * 0.36), control1: CGPoint(x: w * 0.03, y: h * 0.75), control2: CGPoint(x: w * 0.02, y: h * 0.43))
        path.addCurve(to: CGPoint(x: w * 0.43, y: h * 0.18), control1: CGPoint(x: w * 0.24, y: h * 0.17), control2: CGPoint(x: w * 0.36, y: h * 0.11))
        path.addCurve(to: CGPoint(x: w * 0.72, y: h * 0.34), control1: CGPoint(x: w * 0.55, y: h * -0.02), control2: CGPoint(x: w * 0.73, y: h * 0.09))
        path.addCurve(to: CGPoint(x: w * 0.86, y: h * 0.78), control1: CGPoint(x: w * 0.95, y: h * 0.36), control2: CGPoint(x: w * 0.98, y: h * 0.75))
        path.closeSubpath()
        return path
    }
}
