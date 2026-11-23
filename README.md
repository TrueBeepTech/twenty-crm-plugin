# TrueBeep for Twenty

Reach your Twenty contacts by **SMS, email and WhatsApp through [TrueBeep](https://truebeep.com)**, right from the CRM, and see TrueBeep activity (messages, replies, opt-outs) on each person's timeline.

The app works with a TrueBeep account and a Twenty workspace (Twenty Cloud or self-hosted, v2.61 or later). It never syncs or changes your CRM records. Contact sync is the job of TrueBeep's own Twenty connector. When that connector is on, the app uses the link it keeps between Twenty people and TrueBeep customers.

## What it adds to Twenty

| Where | What |
|---|---|
| **Person → TrueBeep tab** | The person's TrueBeep customer: which channels can be messaged and why not (no opt-in, opted out, no number), loyalty points, recent activity and campaigns. |
| **Send via TrueBeep** (people, and deals → their point of contact) | Up to 25 selected: pick a channel, a TrueBeep template or your own text, see who can receive it, send. Each person's result is shown. |
| | More than 25, or **select all**: sent as a TrueBeep **campaign**. Pick a template, check the audience and estimated cost, confirm. |
| **Start TrueBeep workflow** (command) | Starts a TrueBeep workflow whose trigger is *Started from the API or Twenty* for the selected people or deals. |
| **Twenty Workflows** | Three steps: **TrueBeep: Send message**, **TrueBeep: Start workflow**, **TrueBeep: Find customer** (returns `canEmail`, `canSms`, `canWhatsapp`, points, to branch on). |
| **Timeline** | A *TrueBeep* entry for every TrueBeep interaction with the person (message sent, reply, purchase…), once the activity feed is on. |
| **Settings → Apps → TrueBeep** | Connection, the TrueBeep API URL, and the activity-feed switch. |

### Rules TrueBeep enforces (not the app)

- Nobody who opted out (STOP, unsubscribe, bounce) is messaged.
- SMS and WhatsApp need a verified number, the same rule as campaigns. WhatsApp also needs WhatsApp verification, and free text only arrives within 24 hours of the customer's last message.
- A person TrueBeep doesn't know yet is **added for email only**. SMS and WhatsApp wait until they opt in through TrueBeep.
- Every message is charged to the TrueBeep plan like a campaign message, and is refused when the balance doesn't cover it.

## Setup

1. **Install** the app in your Twenty workspace. During the pilot it is installed privately; see [Publishing](#publishing).
2. **Connect TrueBeep** in Twenty: **Settings → Apps → TrueBeep → General**, either way:
   - **Sign in (recommended):** under *TrueBeep*, click **Add connection**, sign in to TrueBeep, pick the team and allow. Twenty registers itself with TrueBeep and refreshes the access. Access is limited to what your TrueBeep role allows and can be revoked in TrueBeep.
   - **API key:** create one in TrueBeep (Settings → API keys), then under *TrueBeep (API key)* click **Add connection** and paste it.

   If both exist, the app uses the sign-in. Connect one TrueBeep team per Twenty workspace.
3. Optional: on the **TrueBeep** tab of the same page, click **Show TrueBeep activity on timelines**. The app registers a signed feed with TrueBeep, and new activity starts appearing on timelines.
4. Optional: in TrueBeep, give a workflow the trigger **Started from the API or Twenty** and publish it, so it shows up in *Start TrueBeep workflow*.

The **TrueBeep API URL** variable (Settings → Apps → TrueBeep → Variables) defaults to `https://api.truebeep.com`. Change it only for staging or local development.

## Privacy and permissions

- **What leaves Twenty:** for the people you message or open the TrueBeep tab for, their email, phone, name and Twenty record id go to TrueBeep. Nothing is sent in the background.
- **What comes in:** with the activity feed on, TrueBeep sends each interaction's channel, direction, one-line summary and the customer's email and phone, so the app can find the person. Each delivery is signed with HMAC-SHA256 using a secret created for your workspace, and the app rejects unsigned or stale (over 5 minutes old) requests.
- **App role:** reads people and deals, and creates timeline entries. It cannot change or delete CRM records.
- **Credentials:** the TrueBeep sign-in or key is kept by Twenty's connection store and used only server side. The panels and composers never see it.
- **Scopes (sign-in):** TrueBeep asks to read customers, content, campaigns and workflows, to create and schedule campaigns, to start workflows and to send messages (`messages:send`). Each request is checked against the route's scope.

## How it works

```
Twenty UI ──► app routes (/s/truebeep/*, signed-in user) ──► TrueBeep public API (/v1, OAuth token or API key)
                                                                │
Twenty timeline ◄── /s/truebeep/events (HMAC-signed) ◄──────────┘ customer-interaction events
```

TrueBeep endpoints used (see the TrueBeep API docs): `POST /v1/messages`, `GET /v1/customer/:id/summary`, `GET /v1/customer/email/:email`, `GET /v1/customer/mobile/:phone`, `GET /v1/templates`, `POST /v1/audiences`, `POST /v1/campaigns`, `POST /v1/campaigns/:id/schedule`, `GET /v1/workflows-startable`, `POST /v1/workflows/:id/run`, `PUT|GET|DELETE /v1/integrations/twenty-app`.

| Folder | Contents |
|---|---|
| `src/front-components` | TrueBeep tab, send composer (and campaign mode), start-workflow picker, settings page, timeline item |
| `src/logic-functions` | App routes, Twenty workflow steps, the signed events route |
| `src/lib` | TrueBeep client, person matching, send/bulk/workflow logic, event signature check (unit-tested) |
| `src/command-menu-items`, `src/page-layouts`, `src/settings`, `src/timeline` | Where the app shows up in Twenty |
| `dev/twenty.override.yml` | Settings a local Twenty needs to run app code |

## Development

See [SETUP.md](SETUP.md) for the local stack (Twenty in Docker, the TrueBeep processor, WSL on Windows) and the checks to run.

```bash
yarn lint && yarn typecheck && yarn test:unit
twenty app apply          # sync to the workspace you logged in to
```

## Publishing

- **Private (pilot):** `twenty app publish --private --remote <name>` uploads a build to one Twenty server. Share it from **Settings → Developers → Apps → My apps → Distribution**. Each upload needs a higher `version` in `package.json`.
- **Marketplace (later):** the `Publish` workflow (`.github/workflows/publish.yml`) publishes to npm with provenance. Register this repo as a trusted publisher on npmjs.com, add the `twenty-app` keyword, make the repo public, then claim the app in Twenty with GitHub (an org owner of `TrueBeepTech`).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
