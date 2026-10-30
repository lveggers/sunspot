> Update: optional Google account profiles and their synchronization are described in [Google sign-in](23-google-login.md). The browser-local behavior below continues to apply when signed out.

# Profiles without a new sign-up step

Open the avatar beside map search, or in the invitation header. `/profile` lets you save your first name, choose/remove a photo, select a preferred hangout activity, change language and return to your own saved hangouts. Name, photo and activity persist in this browser; language saves immediately. Profiles do not automatically sync across devices or across the private map and public recipient origins. This limitation is visible on the page.

The name migrates from the existing saved hangout name. New invitations and RSVPs use the profile name/photo; the activity preference preselects the creation form. Changing a profile affects subsequent invitations/replies, not snapshots already shared. A guest can open their profile from an invitation and return to that exact invitation. Return paths accept only a local, validated hangout route.

Photos stay local when editing/saving the profile. Choosing a photo supports JPEG/PNG/WebP up to 10MB, crops to a centered square and converts it locally to a small 192px JPEG. Only the thumbnail is sent when hosting or replying. The API bounds its JSON body to 32KB and independently decodes and re-encodes JPEGs, with a pixel limit, metadata removal and a 12KB output cap. It never fetches user-provided image URLs. The shared photo is stored with the hangout record, so extensions retain it and expiry removes it; withdrawing removes the guest photo. No separate storage subscription or account service is required.

The hangout JSON contains photo endpoint paths instead of embedded image data. `/api/hangs/[id]/photo` returns the host thumbnail; the `guest` query identifies a participant. Images are available to anyone with the invitation and use no-store/noindex/nosniff headers. The UI discloses that names, photos and responses are shared with link holders. A broken/missing photo falls back to an initial. Existing hangs without photos still work.

Validation: unit/API tests cover JPEG normalization, metadata removal, invalid payloads, photo endpoints, guest withdrawal, record expiry and safe return navigation. `npm run test:profile` covers mobile upload, storage/reload, name/activity prefilling, separate guest and host photos, removal, invalid type, all three languages and 320px layout. Existing `test:hangs` checks the no-photo path. Physical iPhone camera/photo-picker behavior requires a device check.

Image processing reference: [Sharp output options](https://sharp.pixelplumbing.com/api-output/) and [input pixel limits](https://sharp.pixelplumbing.com/api-constructor/).
