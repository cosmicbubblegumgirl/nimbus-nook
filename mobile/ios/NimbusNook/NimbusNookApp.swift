import SwiftUI

@main
struct NimbusNookApp: App {
    @State private var showLaunch = true
    private let appURL = URL(string: "https://cosmicbubblegumgirl.github.io/nimbus-nook/")!

    var body: some Scene {
        WindowGroup {
            ZStack {
                NimbusNookWebView(url: appURL)
                    .ignoresSafeArea()

                if showLaunch {
                    NimbusLaunchView()
                        .transition(.opacity)
                }
            }
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) {
                    withAnimation(.easeOut(duration: 0.35)) {
                        showLaunch = false
                    }
                }
            }
        }
    }
}
