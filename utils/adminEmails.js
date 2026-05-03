const DEFAULT_ADMIN_EMAILS = [
  'maosim1991@gmail.com',
  'pnina.matsanov1@gmail.com',
  'nihaarshad5@gmail.com',
];

function getAllowedAdminEmails() {
  const configured = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_ADMIN_EMAILS;
}

function isEmailAllowedAdmin(email) {
  return getAllowedAdminEmails().includes((email || '').trim().toLowerCase());
}

/**
 * @param {import('mongoose').Document} user
 * @param {string} email
 */
async function syncUserAdminRole(user, email) {
  const shouldBeAdmin = isEmailAllowedAdmin(email);
  if (user.isAdmin !== shouldBeAdmin) {
    user.isAdmin = shouldBeAdmin;
    await user.save();
  }
}

module.exports = {
  DEFAULT_ADMIN_EMAILS,
  getAllowedAdminEmails,
  isEmailAllowedAdmin,
  syncUserAdminRole,
};
