import SwiftUI

struct Profile: Codable, Identifiable {
    let id: UUID
    var name: String
    var email: String?
    var followers: Int
}

enum ProfileError: Error {
    case missingName
    case badEmail(String)
}

protocol ProfileStore {
    func load(id: UUID) async throws -> Profile
}

final class ProfileModel: ObservableObject {
    @Published var profile: Profile?
    @Published var message = ""
    private let store: ProfileStore

    init(store: ProfileStore) {
        self.store = store
    }

    func refresh(id: UUID) async {
        do {
            profile = try await store.load(id: id)
        } catch {
            message = "Could not load the profile"
        }
    }

    func validate(_ p: Profile) throws {
        guard !p.name.isEmpty else { throw ProfileError.missingName }
        if let email = p.email, !email.contains("@") {
            throw ProfileError.badEmail(email)
        }
    }
}

struct ProfileView: View {
    @ObservedObject var model: ProfileModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let p = model.profile {
                Text(p.name).font(.title)
                Text(p.email ?? "No email given")
                Text("\(p.followers) followers")
            } else {
                Text(model.message)
            }
        }
        .padding()
    }
}
