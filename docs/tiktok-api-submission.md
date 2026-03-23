# TikTok API Product & Scope Justifications — Meridian

## Products

**Login Kit** — OAuth 2.0 + PKCE authentication. Creators connect TikTok from Meridian; tokens are encrypted (AES-256-GCM) and stored to authorise all subsequent API calls.

**Content Posting API** — Calls `/v2/post/publish/video/init/` to create a SELF_ONLY draft with a Claude-generated script as the caption. Creator attaches video to complete publishing.

**Share Kit** — Deep-links creators into TikTok to attach their video to the Meridian-initialised draft, completing the repurpose-to-publish flow.

## Scopes

**user.info.basic** — Fetches `open_id` (unique identifier) and `display_name` once at OAuth completion to identify the connected account in Meridian's dashboard.

**user.info.profile** — Fetches `profile_deep_link` and `avatar_url` at OAuth completion; the deep link redirects creators to their TikTok profile after publishing.

**video.publish** — Authorises Content Posting API calls to create draft posts on the creator's behalf.

**video.upload** — Authorises the video file upload step when creators complete a Meridian-initialised draft.
