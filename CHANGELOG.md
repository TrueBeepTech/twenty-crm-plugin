# Changelog

All notable changes to this application are documented in this file.

## Unreleased

- **Connect TrueBeep with sign-in** (OAuth discovery): Twenty registers with TrueBeep, the user picks the team and approves scopes; preferred over an API key when both exist.
- **Campaign mode**: more than 25 selected, or *select all*, is sent as a TrueBeep campaign (template, audience and cost preview, confirm).
- **Activity feed**: TrueBeep interactions on the person timeline, delivered signed; on/off in the app's settings tab.
- **TrueBeep tab** on people: channels with consent, points, recent activity and campaigns.
- **Send via TrueBeep** on people and deals (point of contact), with a per-person preview and result.
- **Start TrueBeep workflow** command; Twenty workflow steps *Send message*, *Start workflow*, *Find customer*.
- API-key connection; app role reads people and deals, writes only timeline entries.

## 0.1.0

- Initial application scaffolded with `twenty app init`.
