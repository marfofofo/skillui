# Universal links

Both files below are served from the web build (Expo copies `public/` into
`dist/`), which is what makes `idle.app/i/CODE` open the app instead of a browser
tab. An invite link that does not open the app breaks the product's main growth
loop, so this is not cosmetic.

Two values have to be filled in before either works:

| File | Placeholder | Where it comes from |
|---|---|---|
| `apple-app-site-association` | `REPLACE_WITH_TEAM_ID` | Apple Developer → Membership → Team ID |
| `assetlinks.json` | `REPLACE_WITH_SHA256_FINGERPRINT` | `eas credentials` → Android → the upload key's SHA-256 |

Apple's file must be served as `application/json` **without** a `.json`
extension, which is why it has none. Vercel infers the type from the extension,
so `vercel.json` sets the header explicitly.

Verify after deploying:

```bash
curl -sI https://idle.app/.well-known/apple-app-site-association | grep -i content-type
curl -s  https://idle.app/.well-known/assetlinks.json | head
```
