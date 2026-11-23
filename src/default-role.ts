import { defineApplicationRole } from 'twenty-sdk/define';

import { APP_DISPLAY_NAME, DEFAULT_ROLE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Least privilege: the app reads people and deals to find who to message and
// never changes or deletes CRM records. (The scaffold default could update and
// soft-delete every record.)
export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: `${APP_DISPLAY_NAME} default function role`,
  description: `${APP_DISPLAY_NAME}: reads people and deals; changes nothing`,
  recordsPermissions: {
    canReadAllRecords: true,
    canUpdateAllRecords: false,
    canSoftDeleteAllRecords: false,
    canDestroyAllRecords: false,
  },
  canBeAssignedToUsers: false,
  canBeAssignedToApiKeys: false,
});
