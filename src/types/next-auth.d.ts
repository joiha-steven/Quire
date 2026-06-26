// Module augmentation: carry which OAuth provider a session came from, so a
// commenter's identity (manual | google) is known server-side.
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    provider?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    provider?: string
  }
}
